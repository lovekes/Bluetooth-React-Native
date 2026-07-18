export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface BleDeviceInfo {
  id: string;
  name: string | null;
  rssi: number | null;
  connectionStatus: ConnectionStatus;
  lastConnected: number | null;
  localName?: string;
  serviceUUIDs?: string[];
}

export type SortOption = 'rssi' | 'name' | 'lastConnected';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  option: SortOption;
  direction: SortDirection;
}

export interface BleState {
  devices: Map<string, BleDeviceInfo>;
}

export interface ScanResult {
  device: BleDeviceInfo;
  eventType: 'didDiscover' | 'didUpdate';
}
