package com.bletaskapp

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.pm.PackageManager
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothManager
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.UUID

class BleNativeModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val bluetoothManager =
    reactContext.getSystemService(android.content.Context.BLUETOOTH_SERVICE) as? BluetoothManager
  private val bluetoothAdapter: BluetoothAdapter? = bluetoothManager?.adapter
  private val scanner: BluetoothLeScanner?
    get() = bluetoothAdapter?.bluetoothLeScanner

  private fun isConnected(gatt: BluetoothGatt?): Boolean {
    if (gatt == null || bluetoothManager == null) return false
    return bluetoothManager.getConnectionState(gatt.device, android.bluetooth.BluetoothProfile.STATE_CONNECTED) ==
      android.bluetooth.BluetoothProfile.STATE_CONNECTED
  }

  private fun hasBlePermissions(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val scan = reactContext.checkSelfPermission(android.Manifest.permission.BLUETOOTH_SCAN)
    val connect = reactContext.checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT)
    return scan == PackageManager.PERMISSION_GRANTED && connect == PackageManager.PERMISSION_GRANTED
  }

  private var scanning = false
  private val devices = HashMap<String, BluetoothDevice>()
  private val gatts = HashMap<String, BluetoothGatt>()
  private val pendingCharacteristics = HashMap<String, BluetoothGattCharacteristic>()
  private val rssiRunnables = HashMap<String, Runnable>()
  private val connectPromises = HashMap<String, Promise>()
  private val readPromises = HashMap<String, Promise>()
  private val writePromises = HashMap<String, Promise>()

  override fun getName(): String = "BleNativeModule"

  override fun getConstants(): MutableMap<String, Any> = HashMap()

  private val scanCallback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) {
      handleScanResult(result)
    }

    override fun onBatchScanResults(results: MutableList<ScanResult>) {
      for (result in results) {
        handleScanResult(result)
      }
    }

    override fun onScanFailed(errorCode: Int) {
      scanning = false
      sendEvent("BleScanStopped", Arguments.createMap())
      emitError("Scan failed with error code: $errorCode")
    }
  }

  private fun handleScanResult(result: ScanResult) {
    val device = result.device
    val address = device.address ?: return
    android.util.Log.d("BleNativeModule", "onScanResult: ${device.name} ($address) rssi=${result.rssi}")
    val isNew = !devices.containsKey(address)
    devices[address] = device
    val rssi = result.rssi
    emitDeviceUpdated(device, rssi)
    if (isNew) {
      emitDeviceFound(device, rssi)
    }
  }

  @ReactMethod
  fun startScan(services: ReadableArray, promise: Promise) {
    android.util.Log.d("BleNativeModule", "startScan called, scanning=$scanning")
    val adapter = bluetoothAdapter
    val leScanner = scanner

    if (adapter == null || leScanner == null) {
      promise.reject("BLE_UNAVAILABLE", "Bluetooth is not available")
      return
    }
    if (!adapter.isEnabled) {
      promise.reject("BLE_POWERED_OFF", "Bluetooth is not powered on")
      return
    }
    if (!hasBlePermissions()) {
      promise.reject("BLE_PERMISSION_DENIED", "Bluetooth scan/connect permission not granted")
      return
    }

    scanning = true
    val settings = ScanSettings.Builder()
      .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
      .build()
    try {
      leScanner.startScan(null, settings, scanCallback)
      promise.resolve(null)
    } catch (error: Throwable) {
      scanning = false
      promise.reject("BLE_START_SCAN_ERROR", error)
    }
  }

  @ReactMethod
  fun stopScan(promise: Promise) {
    stopScanInternal()
    promise.resolve(null)
  }

  private fun stopScanInternal() {
    if (!scanning) return
    scanning = false
    try {
      scanner?.stopScan(scanCallback)
    } catch (_: Throwable) {
    }
    rssiRunnables.values.forEach { mainHandler.removeCallbacks(it) }
    rssiRunnables.clear()
    sendEvent("BleScanStopped", Arguments.createMap())
  }

  @ReactMethod
  fun connect(deviceId: String, promise: Promise) {
    val device = devices[deviceId]
    if (device == null) {
      promise.reject("BLE_DEVICE_NOT_FOUND", "Device not found: $deviceId")
      return
    }
    connectPromises[deviceId] = promise
    emitConnectionState(deviceId, "connecting")
    val gatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      device.connectGatt(reactContext, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    } else {
      device.connectGatt(reactContext, false, gattCallback)
    }
    if (gatt != null) {
      gatts[deviceId] = gatt
    } else {
      connectPromises.remove(deviceId)
      emitConnectionState(deviceId, "disconnected")
      promise.reject("BLE_CONNECT_ERROR", "Unable to connect to device")
    }
  }

  @ReactMethod
  fun disconnect(deviceId: String, promise: Promise) {
    rssiRunnables[deviceId]?.let { mainHandler.removeCallbacks(it) }
    rssiRunnables.remove(deviceId)
    gatts[deviceId]?.let { gatt ->
      if (isConnected(gatt)) gatt.disconnect()
      gatt.close()
    }
    gatts.remove(deviceId)
    emitConnectionState(deviceId, "disconnected")
    promise.resolve(null)
  }

  @ReactMethod
  fun readCharacteristic(deviceId: String, serviceUUID: String, characteristicUUID: String, promise: Promise) {
    val gatt = gatts[deviceId]
    if (gatt == null || !isConnected(gatt)) {
      promise.reject("BLE_NOT_CONNECTED", "Device is not connected: $deviceId")
      return
    }
    val characteristic = findCharacteristic(gatt, serviceUUID, characteristicUUID)
    if (characteristic == null) {
      promise.reject("BLE_CHAR_NOT_FOUND", "Characteristic not found")
      return
    }
    readPromises[deviceId] = promise
    if (!gatt.readCharacteristic(characteristic)) {
      readPromises.remove(deviceId)
      promise.reject("BLE_READ_ERROR", "Failed to initiate read")
    }
  }

  @ReactMethod
  fun writeCharacteristic(deviceId: String, serviceUUID: String, characteristicUUID: String, valueBase64: String, promise: Promise) {
    val gatt = gatts[deviceId]
    if (gatt == null || !isConnected(gatt)) {
      promise.reject("BLE_NOT_CONNECTED", "Device is not connected: $deviceId")
      return
    }
    val characteristic = findCharacteristic(gatt, serviceUUID, characteristicUUID)
    if (characteristic == null) {
      promise.reject("BLE_CHAR_NOT_FOUND", "Characteristic not found")
      return
    }
    val bytes = try {
      Base64.decode(valueBase64, Base64.NO_WRAP)
    } catch (error: Throwable) {
      promise.reject("BLE_INVALID_VALUE", "Invalid base64 write value", error)
      return
    }
    characteristic.value = bytes
    writePromises[deviceId] = promise
    if (!gatt.writeCharacteristic(characteristic)) {
      writePromises.remove(deviceId)
      promise.reject("BLE_WRITE_ERROR", "Failed to initiate write")
    }
  }

  @ReactMethod
  fun isBluetoothEnabled(promise: Promise) {
    promise.resolve(bluetoothAdapter?.isEnabled == true)
  }

  private val gattCallback = object : BluetoothGattCallback() {
    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
      val deviceId = gatt.device.address
      if (newState == BluetoothGatt.STATE_CONNECTED) {
        emitConnectionState(deviceId, "connected")
        connectPromises.remove(deviceId)?.resolve(null)
        gatt.discoverServices()
        startRssiPolling(gatt)
      } else if (newState == BluetoothGatt.STATE_DISCONNECTED) {
        emitConnectionState(deviceId, "disconnected")
        rssiRunnables[deviceId]?.let { mainHandler.removeCallbacks(it) }
        rssiRunnables.remove(deviceId)
        if (status != BluetoothGatt.GATT_SUCCESS) {
          connectPromises.remove(deviceId)?.reject("BLE_CONNECT_FAILED", "Connection lost (status $status)")
        }
        gatt.close()
        gatts.remove(deviceId)
      }
    }

    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
      if (status != BluetoothGatt.GATT_SUCCESS) {
        emitError("Service discovery failed: $status")
        return
      }
      for (service in gatt.services) {
        for (characteristic in service.characteristics) {
          val key = "${gatt.device.address}|${service.uuid}|${characteristic.uuid}"
          pendingCharacteristics[key] = characteristic
        }
      }
    }

    override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
      val deviceId = gatt.device.address
      val promise = readPromises.remove(deviceId) ?: return
      if (status == BluetoothGatt.GATT_SUCCESS) {
        promise.resolve(Base64.encodeToString(value, Base64.NO_WRAP))
      } else {
        emitError("Read failed: $status")
        promise.resolve(Base64.encodeToString(value, Base64.NO_WRAP))
      }
    }

    @Deprecated("Deprecated in Java")
    override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
      val deviceId = gatt.device.address
      val promise = readPromises.remove(deviceId) ?: return
      val value = characteristic.value ?: byteArrayOf()
      if (status == BluetoothGatt.GATT_SUCCESS) {
        promise.resolve(Base64.encodeToString(value, Base64.NO_WRAP))
      } else {
        emitError("Read failed: $status")
        promise.resolve(Base64.encodeToString(value, Base64.NO_WRAP))
      }
    }

    override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
      val deviceId = gatt.device.address
      val promise = writePromises.remove(deviceId) ?: return
      if (status == BluetoothGatt.GATT_SUCCESS) {
        promise.resolve(null)
      } else {
        emitError("Write failed: $status")
        promise.reject("BLE_WRITE_ERROR", "Write failed with status $status")
      }
    }

    override fun onReadRemoteRssi(gatt: BluetoothGatt, rssi: Int, status: Int) {
      if (status == BluetoothGatt.GATT_SUCCESS) {
        emitDeviceUpdated(gatt.device, rssi)
      }
    }
  }

  private fun startRssiPolling(gatt: BluetoothGatt) {
    val deviceId = gatt.device.address
    val runnable = object : Runnable {
      override fun run() {
        if (isConnected(gatt)) {
          gatt.readRemoteRssi()
          mainHandler.postDelayed(this, 2000)
        }
      }
    }
    rssiRunnables[deviceId] = runnable
    mainHandler.postDelayed(runnable, 2000)
  }

  private fun findCharacteristic(gatt: BluetoothGatt, serviceUUID: String, characteristicUUID: String): BluetoothGattCharacteristic? {
    val service = gatt.services.firstOrNull { it.uuid == UUID.fromString(serviceUUID) } ?: return null
    return service.characteristics.firstOrNull { it.uuid == UUID.fromString(characteristicUUID) }
  }

  private fun emitDeviceFound(device: BluetoothDevice, rssi: Int) {
    val payload = buildDevicePayload(device, rssi)
    val wrapper = Arguments.createMap()
    wrapper.putMap("device", payload)
    sendEvent("BleDeviceFound", wrapper)
  }

  private fun emitDeviceUpdated(device: BluetoothDevice, rssi: Int?) {
    val payload = buildDevicePayload(device, rssi)
    val wrapper = Arguments.createMap()
    wrapper.putMap("device", payload)
    sendEvent("BleDeviceUpdated", wrapper)
  }

  private fun buildDevicePayload(device: BluetoothDevice, rssi: Int?): WritableMap {
    val deviceMap = Arguments.createMap()
    deviceMap.putString("id", device.address)
    deviceMap.putString("name", device.name)
    if (rssi != null) {
      deviceMap.putInt("rssi", rssi)
    } else {
      deviceMap.putNull("rssi")
    }
    deviceMap.putString("connectionStatus", "disconnected")
    deviceMap.putNull("lastConnected")
    deviceMap.putString("localName", device.name)
    deviceMap.putArray("serviceUUIDs", Arguments.createArray())
    return deviceMap
  }

  private fun emitConnectionState(deviceId: String, status: String) {
    val payload = Arguments.createMap().apply {
      putString("deviceId", deviceId)
      putString("status", status)
    }
    sendEvent("BleConnectionStateChanged", payload)
  }

  private fun emitError(message: String) {
    val payload = Arguments.createMap().apply {
      putString("message", message)
    }
    sendEvent("BleError", payload)
  }

  private fun sendEvent(eventName: String, payload: WritableMap) {
    reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, payload)
  }
}
