declare function atob(s: string): string;
declare function btoa(s: string): string;

import { NativeModules, NativeEventEmitter, PermissionsAndroid, Platform, Permission } from 'react-native';
import type { BleDeviceInfo, ConnectionStatus } from '../types';

const { BleNativeModule } = NativeModules;
const bleEmitter = BleNativeModule ? new NativeEventEmitter(BleNativeModule) : null;

function assertMethod(name: keyof typeof BleNativeModule): NonNullable<typeof BleNativeModule> {
  if (!BleNativeModule || typeof BleNativeModule[name] !== 'function') {
    throw new Error(`BleNativeModule.${String(name)} is not available`);
  }
  return BleNativeModule;
}

const deviceStore = new Map<string, BleDeviceInfo>();
let subscription: { remove: () => void } | null = null;
let activeCallbacks: {
  onDeviceFound?: (device: BleDeviceInfo) => void;
  onDeviceUpdated?: (device: BleDeviceInfo) => void;
  onScanStopped?: () => void;
  onError?: (error: Error) => void;
} = {};

function ensureSubscribed() {
  if (subscription || !bleEmitter) return;

  const onDeviceFound = (event: { device: any }) => {
    const info = toDeviceInfo(event.device);
    deviceStore.set(info.id, info);
    console.log('----------- Device found:', info);
    activeCallbacks.onDeviceFound?.(info);
  };

  const onDeviceUpdated = (event: { device: any }) => {
    const info = toDeviceInfo(event.device);
    const existing = deviceStore.get(info.id);
    if (existing) {
      const merged = { ...existing, ...info };
      deviceStore.set(info.id, merged);
      console.log('----------- Device updated:', merged);
      activeCallbacks.onDeviceUpdated?.(merged);
    } else {
      deviceStore.set(info.id, info);
      console.log('----------- Device added:', info);
      activeCallbacks.onDeviceUpdated?.(info);
    }
  };

  const onConnectionStateChanged = (event: { deviceId: string; status: ConnectionStatus }) => {
    const info = deviceStore.get(event.deviceId);
    if (info) {
      const updated = {
        ...info,
        connectionStatus: event.status,
        lastConnected: event.status === 'connected' ? Date.now() : info.lastConnected,
      };
      deviceStore.set(event.deviceId, updated);
      console.log('----------- Connection state changed:', updated);
      activeCallbacks.onDeviceUpdated?.(updated);
    }
  };

  const onScanStopped = () => {
    activeCallbacks.onScanStopped?.();
  };

  const onError = (event: { message: string }) => {
    const error = new Error(event.message);
    console.error('BLE Error:', event.message);
    activeCallbacks.onError?.(error);
  };

  subscription = {
    remove: () => {
      bleEmitter.removeAllListeners('BleDeviceFound');
      bleEmitter.removeAllListeners('BleDeviceUpdated');
      bleEmitter.removeAllListeners('BleConnectionStateChanged');
      bleEmitter.removeAllListeners('BleScanStopped');
      bleEmitter.removeAllListeners('BleError');
      activeCallbacks = {};
    },
  };

  bleEmitter.addListener('BleDeviceFound', onDeviceFound);
  bleEmitter.addListener('BleDeviceUpdated', onDeviceUpdated);
  bleEmitter.addListener('BleConnectionStateChanged', onConnectionStateChanged);
  bleEmitter.addListener('BleScanStopped', onScanStopped);
  bleEmitter.addListener('BleError', onError);
}

function toDeviceInfo(nativeDevice: any): BleDeviceInfo {
  return {
    id: nativeDevice.id,
    name: nativeDevice.name ?? null,
    rssi: nativeDevice.rssi ?? null,
    connectionStatus: nativeDevice.connectionStatus ?? 'disconnected',
    lastConnected: nativeDevice.lastConnected ?? null,
    localName: nativeDevice.localName ?? undefined,
    serviceUUIDs: nativeDevice.serviceUUIDs ?? [],
  };
}

function base64ToHex(base64: string): string {
  try {
    const binaryString = atob(base64);
    let hex = '';
    for (let i = 0; i < binaryString.length; i++) {
      const charCode = binaryString.charCodeAt(i);
      hex += charCode.toString(16).padStart(2, '0');
    }
    return hex;
  } catch {
    return '';
  }
}

function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const sdk = Platform.Version as number;
  const permissions: Permission[] = [];

  if (sdk >= 31) {
    permissions.push(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    );
  } else {
    permissions.push(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    );
  }

  try {
    const granted = await PermissionsAndroid.requestMultiple(permissions);

    return Object.values(granted).every(
      status => status === PermissionsAndroid.RESULTS.GRANTED,
    );
  } catch (error) {
    console.error(error);
    return false;
  }
}

export async function startScan(
  services: string[] = [],
  onDeviceFound: (device: BleDeviceInfo) => void,
  onDeviceUpdated: (device: BleDeviceInfo) => void,
  onScanStopped: () => void,
  onError: (error: Error) => void,
): Promise<void> {
  activeCallbacks = { onDeviceFound, onDeviceUpdated, onScanStopped, onError };

  if (!BleNativeModule) {
    onError(new Error('BleNativeModule is not available'));
    return;
  }

  try {
    ensureSubscribed();
    const module = assertMethod('isBluetoothEnabled');
    const enabled = await module.isBluetoothEnabled();
    console.log('----------- Bluetooth enabled:', enabled);
    if (!enabled) {
      onError(new Error('Bluetooth is not powered on'));
      return;
    }
    const granted = await requestBlePermissions();
    if (!granted) {
      onError(new Error('Bluetooth permissions not granted'));
      return;
    }
    deviceStore.clear();
    console.log('----------- Starting scan... ', services);
    await assertMethod('startScan').startScan(services);
  } catch (err) {
    console.error('----------- Scan failed:', err);
    onError(err instanceof Error ? err : new Error('Scan failed'));
  }
}

export function stopScan(): void {
  if (!BleNativeModule) return;
  if (typeof BleNativeModule.stopScan !== 'function') return;
  console.log('----------- Stopping scan...');
  BleNativeModule.stopScan().catch(() => { });
}

export async function connect(
  deviceId: string,
  onConnectionChange: (id: string, status: BleDeviceInfo['connectionStatus']) => void
): Promise<void> {
  if (!BleNativeModule) {
    throw new Error('BleNativeModule is not available');
  }
  try {
    console.log('----------- Connecting to device:', deviceId);
    await assertMethod('connect').connect(deviceId);
  } catch (err) {
    console.error('----------- Failed to connect to device:', deviceId);
    onConnectionChange(deviceId, 'disconnected');
    throw err;
  }
}

export async function disconnect(
  deviceId: string,
  onConnectionChange: (id: string, status: BleDeviceInfo['connectionStatus']) => void
): Promise<void> {
  if (!BleNativeModule) {
    throw new Error('BleNativeModule is not available');
  }
  try {
    await assertMethod('disconnect').disconnect(deviceId);
    onConnectionChange(deviceId, 'disconnected');
  } catch (err) {
    onConnectionChange(deviceId, 'disconnected');
    throw err;
  }
}

export async function readCharacteristic(
  deviceId: string,
  serviceUUID: string,
  characteristicUUID: string
): Promise<string | null> {
  if (!BleNativeModule) {
    throw new Error('BleNativeModule is not available');
  }
  try {
    const base64 = await assertMethod('readCharacteristic').readCharacteristic(deviceId, serviceUUID, characteristicUUID);
    return base64ToHex(base64);
  } catch (err) {
    throw new Error(`Failed to read characteristic: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function writeCharacteristic(
  deviceId: string,
  serviceUUID: string,
  characteristicUUID: string,
  value: string
): Promise<void> {
  if (!BleNativeModule) {
    throw new Error('BleNativeModule is not available');
  }
  try {
    const base64Value = hexToBase64(value);
    await assertMethod('writeCharacteristic').writeCharacteristic(deviceId, serviceUUID, characteristicUUID, base64Value);
  } catch (err) {
    throw new Error(`Failed to write characteristic: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

const DEVICES_API_URL = 'https://mocki.io/v1/9fbaf35c-9547-44af-9433-747352d7ad61';

export async function fetchDevices(): Promise<BleDeviceInfo[]> {
  const response = await fetch(DEVICES_API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch devices: ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Invalid devices response');
  }
  return data.map(toDeviceInfo);
}

export function getDevices(): BleDeviceInfo[] {
  return Array.from(deviceStore.values());
}

export function getDevice(id: string): BleDeviceInfo | undefined {
  return deviceStore.get(id);
}

export function cleanup(): void {
  stopScan();
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
  deviceStore.clear();
}

export { BleNativeModule };
