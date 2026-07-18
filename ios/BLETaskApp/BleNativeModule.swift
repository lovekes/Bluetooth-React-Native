import Foundation
import CoreBluetooth
import React

@objc(BleNativeModule)
class BleNativeModule: RCTEventEmitter {
  private var centralManager: CBCentralManager?
  private var isScanning = false
  private var scanResolver: RCTPromiseResolveBlock?
  private var scanRejecter: RCTPromiseRejectBlock?
  private var connectResolvers: [String: RCTPromiseResolveBlock] = [:]
  private var connectRejecters: [String: RCTPromiseRejectBlock] = [:]
  private var readResolvers: [String: RCTPromiseResolveBlock] = [:]
  private var readRejecters: [String: RCTPromiseRejectBlock] = [:]
  private var writeResolvers: [String: RCTPromiseResolveBlock] = [:]
  private var writeRejecters: [String: RCTPromiseRejectBlock] = [:]
  private var peripherals: [UUID: CBPeripheral] = [:]
  private var discoveredCharacteristics: [String: CBCharacteristic] = [:]
  private var pendingOperations: [String: PendingOperation] = [:]
  private var rssiTimers: [UUID: Timer] = [:]
  private var pendingRssiReads: Set<UUID> = []
  private let queue = DispatchQueue(label: "com.bletaskapp.central")

  private struct PendingOperation {
    let peripheral: CBPeripheral
    let serviceUUID: String
    let characteristicUUID: String
    let type: OperationType
  }

  private enum OperationType {
    case read
    case write(String)
  }

  override init() {
    super.init()
    centralManager = CBCentralManager(delegate: self, queue: queue)
  }

  override static func moduleName() -> String! {
    "BleNativeModule"
  }

  override static func requiresMainQueueSetup() -> Bool { false }

  override func supportedEvents() -> [String]! {
    ["BleDeviceFound", "BleDeviceUpdated", "BleScanStopped", "BleConnectionStateChanged", "BleError"]
  }

  override func constantsToExport() -> [AnyHashable: Any]! {
    [:]
  }

  @objc(startScan:resolver:rejecter:)
  func startScan(_ services: [String], resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard let central = centralManager else {
      rejecter("BLE_UNAVAILABLE", "Bluetooth is not available", nil)
      return
    }
    guard central.state == .poweredOn else {
      rejecter("BLE_POWERED_OFF", "Bluetooth is not powered on", nil)
      return
    }

    scanResolver = resolver
    scanRejecter = rejecter

    let uuids = services.compactMap { CBUUID(string: $0) }
    isScanning = true
    central.scanForPeripherals(withServices: uuids.isEmpty ? nil : uuids, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
  }

  @objc(stopScan:rejecter:)
  func stopScan(_ resolve: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    stopScanInternal()
    resolve(nil)
  }

  private func stopScanInternal() {
    guard let central = centralManager, isScanning else { return }
    central.stopScan()
    isScanning = false
    rssiTimers.values.forEach { $0.invalidate() }
    rssiTimers.removeAll()
    sendEvent(withName: "BleScanStopped", body: [:])
    scanResolver?(nil)
    scanResolver = nil
    scanRejecter = nil
  }

  @objc(connect:resolver:rejecter:)
  func connect(_ deviceId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard let uuid = UUID(uuidString: deviceId), let peripheral = peripherals[uuid] else {
      rejecter("BLE_DEVICE_NOT_FOUND", "Device not found: \(deviceId)", nil)
      return
    }
    connectResolvers[deviceId] = resolver
    connectRejecters[deviceId] = rejecter
    emitConnectionState(deviceId, "connecting")
    centralManager?.connect(peripheral, options: nil)
  }

  @objc(disconnect:resolver:rejecter:)
  func disconnect(_ deviceId: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    if let uuid = UUID(uuidString: deviceId), let peripheral = peripherals[uuid] {
      rssiTimers[uuid]?.invalidate()
      rssiTimers[uuid] = nil
      if peripheral.state == .connected {
        centralManager?.cancelPeripheralConnection(peripheral)
      }
    }
    emitConnectionState(deviceId, "disconnected")
    resolver(nil)
  }

  @objc(readCharacteristic:serviceUUID:characteristicUUID:resolver:rejecter:)
  func readCharacteristic(_ deviceId: String, serviceUUID: String, characteristicUUID: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard let uuid = UUID(uuidString: deviceId), let peripheral = peripherals[uuid], peripheral.state == .connected else {
      rejecter("BLE_NOT_CONNECTED", "Device is not connected: \(deviceId)", nil)
      return
    }
    readResolvers[deviceId] = resolver
    readRejecters[deviceId] = rejecter
    queue.async {
      self.discoverAndPerform(deviceId: deviceId, serviceUUID: serviceUUID, characteristicUUID: characteristicUUID, type: .read)
    }
  }

  @objc(writeCharacteristic:serviceUUID:characteristicUUID:valueBase64:resolver:rejecter:)
  func writeCharacteristic(_ deviceId: String, serviceUUID: String, characteristicUUID: String, valueBase64: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard let uuid = UUID(uuidString: deviceId), let peripheral = peripherals[uuid], peripheral.state == .connected else {
      rejecter("BLE_NOT_CONNECTED", "Device is not connected: \(deviceId)", nil)
      return
    }
    writeResolvers[deviceId] = resolver
    writeRejecters[deviceId] = rejecter
    queue.async {
      self.discoverAndPerform(deviceId: deviceId, serviceUUID: serviceUUID, characteristicUUID: characteristicUUID, type: .write(valueBase64))
    }
  }

  @objc(isBluetoothEnabled:rejecter:)
  func isBluetoothEnabled(resolve: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    resolve(centralManager?.state == .poweredOn)
  }

  private func discoverAndPerform(deviceId: String, serviceUUID: String, characteristicUUID: String, type: OperationType) {
    guard let uuid = UUID(uuidString: deviceId), let peripheral = peripherals[uuid] else { return }
    peripheral.delegate = self
    // peripheral.discoverServices(nil)
    let key = "\(deviceId)|\(serviceUUID)|\(characteristicUUID)"
    pendingOperations[key] = PendingOperation(peripheral: peripheral, serviceUUID: serviceUUID, characteristicUUID: characteristicUUID, type: type)
    subscribeCharacteristic(peripheral: peripheral, deviceId: deviceId, serviceUUID: serviceUUID, characteristicUUID: characteristicUUID)
  }

  /// Subscribe to a characteristic
  private func subscribeCharacteristic(peripheral: CBPeripheral, deviceId: String, serviceUUID: String, characteristicUUID: String) {
      let serviceCBUUID = CBUUID(string: serviceUUID)
      let characteristicCBUUID = CBUUID(string: characteristicUUID)

      guard let service = peripheral.services?.first(where: {
          $0.uuid == serviceCBUUID
      }) else {
          print("Service not found")
          peripheral.discoverServices([serviceCBUUID])
          return
      }

      guard let characteristic = service.characteristics?.first(where: {
          $0.uuid == characteristicCBUUID
      }) else {
          print("Characteristic not found")
          peripheral.discoverCharacteristics([characteristicCBUUID], for: service)
          return
      }

      if characteristic.properties.contains(.notify) ||
         characteristic.properties.contains(.indicate) {
          peripheral.setNotifyValue(true, for: characteristic)
      } else {
          print("Characteristic doesn't support notify")
      }
  }
  
  private func emitDevice(_ peripheral: CBPeripheral, advertisementData: [String: Any]?, rssi: NSNumber?) {
    let name = peripheral.name
      ?? (advertisementData?[CBAdvertisementDataLocalNameKey] as? String)
    let serviceUUIDs = (advertisementData?[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID])?
      .map { $0.uuidString } ?? []
    var payload: [String: Any] = [
      "id": peripheral.identifier.uuidString,
      "name": name as Any,
      "connectionStatus": connectionStatusString(peripheral.state),
      "lastConnected": NSNull(),
      "localName": name as Any,
      "serviceUUIDs": serviceUUIDs
    ]
    if let rssi = rssi {
      payload["rssi"] = rssi.intValue
    } else {
      payload["rssi"] = NSNull()
    }
    if let data = advertisementData, let mfg = data[CBAdvertisementDataManufacturerDataKey] as? Data {
      payload["manufacturerData"] = mfg.base64EncodedString()
    }
    sendEvent(withName: "BleDeviceUpdated", body: ["device": payload])
  }

  private func connectionStatusString(_ state: CBPeripheralState) -> String {
    switch state {
    case .connected: return "connected"
    case .connecting: return "connecting"
    default: return "disconnected"
    }
  }

  private func emitConnectionState(_ deviceId: String, _ status: String) {
    sendEvent(withName: "BleConnectionStateChanged", body: ["deviceId": deviceId, "status": status])
  }

  private func emitError(_ message: String) {
    sendEvent(withName: "BleError", body: ["message": message])
  }
}

extension BleNativeModule: CBCentralManagerDelegate {
  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    if central.state != .poweredOn && isScanning {
      stopScanInternal()
    }
  }

  func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi: NSNumber) {
    let isNew = peripherals[peripheral.identifier] == nil
    peripherals[peripheral.identifier] = peripheral
    emitDevice(peripheral, advertisementData: advertisementData, rssi: rssi)

    if isNew {
      let name = peripheral.name ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String)
      let foundPayload: [String: Any] = [
        "id": peripheral.identifier.uuidString,
        "name": name as Any,
        "rssi": rssi.intValue,
        "connectionStatus": "disconnected",
        "lastConnected": NSNull(),
        "localName": name as Any,
        "serviceUUIDs": (advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID])?.map { $0.uuidString } ?? []
      ]
      sendEvent(withName: "BleDeviceFound", body: ["device": foundPayload])
    }

    guard rssiTimers[peripheral.identifier] == nil else { return }
    
    // Capture the specific peripheral weakly or strongly depending on your architecture
    // Using [weak peripheral] or holding a reference ensures no retain cycles
    let timer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak peripheral] _ in
      peripheral?.readRSSI()
    }
    rssiTimers[peripheral.identifier] = timer
  }

  func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    let deviceId = peripheral.identifier.uuidString
    emitConnectionState(deviceId, "connected")
    connectResolvers[deviceId]?(nil)
    connectResolvers[deviceId] = nil
    connectRejecters[deviceId] = nil
    peripheral.delegate = self
    peripheral.discoverServices(nil)
  }

  func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    let deviceId = peripheral.identifier.uuidString
    emitConnectionState(deviceId, "disconnected")
    connectRejecters[deviceId]?("BLE_CONNECT_FAILED", error?.localizedDescription ?? "Failed to connect", error)
    connectResolvers[deviceId] = nil
    connectRejecters[deviceId] = nil
  }

  func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    let deviceId = peripheral.identifier.uuidString
    emitConnectionState(deviceId, "disconnected")
    rssiTimers[peripheral.identifier]?.invalidate()
    rssiTimers[peripheral.identifier] = nil
  }
}

extension BleNativeModule: CBPeripheralDelegate {
  func peripheral(_ peripheral: CBPeripheral, didReadRSSI rssi: NSNumber, error: Error?) {
    guard error == nil else { return }
    emitDevice(peripheral, advertisementData: nil, rssi: rssi)
  }

  func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    if let error = error {
      emitError("Discover services failed: \(error.localizedDescription)")
      return
    }
    for service in peripheral.services ?? [] {
      peripheral.discoverCharacteristics(nil, for: service)
    }
  }

  func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    if let error = error {
      emitError("Discover characteristics failed: \(error.localizedDescription)")
      return
    }
    let deviceId = peripheral.identifier.uuidString
    for characteristic in service.characteristics ?? [] {
      let key = "\(deviceId)|\(service.uuid.uuidString)|\(characteristic.uuid.uuidString)"
      if characteristic.properties.contains(.notify) {
        peripheral.setNotifyValue(true, for: characteristic)
      }
      discoveredCharacteristics[key] = characteristic
      if let op = pendingOperations.removeValue(forKey: key) {
        performOperation(op)
      }
    }
  }

  func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
    let deviceId = peripheral.identifier.uuidString
    guard let resolver = readResolvers.removeValue(forKey: deviceId) else { return }
    readRejecters.removeValue(forKey: deviceId)
    if let error = error {
      emitError("Read failed: \(error.localizedDescription)")
      resolver(nil)
      return
    }
    let value = characteristic.value ?? Data()
    print("==== \( value.count)")
    if value.count > 36 {
      let id = extractString(from: value, range: 4..<40)      // "OFP_B5CB1C1613CDE1F91957327D2F4F36"
      let model = extractString(from: value, range: 63..<70)   // "CPH2495"
      let name = extractString(from: value, range: 74..<87)    // "OPPO A78 5G"
      
      print(" ID: \(id)\n Model: \(model)\n Name: \(name.trimmingCharacters(in: .whitespacesAndNewlines))")
      //resolver("ID: \(id) Model: \(model)")
    }
    resolver(value.base64EncodedString())
  }

  // Helper to extract text from a range
  func extractString(from data: Data, range: Range<Int>) -> String {
      let subData = data.subdata(in: range)
      return String(data: subData, encoding: .ascii) ?? ""
  }
  
  func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
    let deviceId = peripheral.identifier.uuidString
    guard let resolver = writeResolvers.removeValue(forKey: deviceId) else { return }
    writeRejecters.removeValue(forKey: deviceId)
    if let error = error {
      emitError("Write failed: \(error.localizedDescription)")
      return
    }
    resolver(nil)
  }

  private func performOperation(_ op: PendingOperation) {
    let key = "\(op.peripheral.identifier.uuidString)|\(op.serviceUUID)|\(op.characteristicUUID)"
    guard let characteristic = discoveredCharacteristics[key] else {
      emitError("Characteristic not found: \(op.characteristicUUID)")
      return
    }
    switch op.type {
    case .read:
      op.peripheral.readValue(for: characteristic)
    case .write(let base64):
      if let data = Data(base64Encoded: base64) {
        op.peripheral.writeValue(data, for: characteristic, type: .withResponse)
      } else {
        emitError("Invalid base64 write value")
      }
    }
  }
}
