import type { ConnectionStatus } from '../types';

export interface NativeBleDevice {
  id: string;
  name: string | null;
  rssi: number | null;
  connectionStatus: ConnectionStatus;
  lastConnected: number | null;
  localName: string | null;
  serviceUUIDs: string[];
}

export interface BleNativeBridge {
  startScan(services: string[]): Promise<void>;
  stopScan(): void;
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  readCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
  ): Promise<string>;
  writeCharacteristic(
    deviceId: string,
    serviceUUID: string,
    characteristicUUID: string,
    valueBase64: string,
  ): Promise<void>;
  isBluetoothEnabled(): Promise<boolean>;
}

export type BleNativeEventName =
  | 'BleDeviceFound'
  | 'BleDeviceUpdated'
  | 'BleScanStopped'
  | 'BleConnectionStateChanged'
  | 'BleError';

export interface BleNativeEventMap {
  BleDeviceFound: { device: NativeBleDevice };
  BleDeviceUpdated: { device: NativeBleDevice };
  BleScanStopped: Record<string, never>;
  BleConnectionStateChanged: {
    deviceId: string;
    status: ConnectionStatus;
  };
  BleError: { message: string };
}
