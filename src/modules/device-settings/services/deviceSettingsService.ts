import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationPreference = 'all' | 'important' | 'none';

export interface DeviceSettings {
  autoConnect: boolean;
  preferredDeviceId: string;
  preferredDeviceName: string;
  connectionTimeoutMs: number;
  notificationPreference: NotificationPreference;
}

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  autoConnect: false,
  preferredDeviceId: '',
  preferredDeviceName: '',
  connectionTimeoutMs: 10000,
  notificationPreference: 'important',
};

const STORAGE_KEY = 'ble_device_settings';

function coerce(raw: unknown): DeviceSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_DEVICE_SETTINGS };
  const value = raw as Partial<DeviceSettings>;
  const notification = value.notificationPreference;
  const validNotification: NotificationPreference =
    notification === 'all' || notification === 'important' || notification === 'none'
      ? notification
      : DEFAULT_DEVICE_SETTINGS.notificationPreference;
  const timeout = Number(value.connectionTimeoutMs);
  const deviceId = typeof value.preferredDeviceId === 'string' ? value.preferredDeviceId : '';
  return {
    autoConnect: Boolean(value.autoConnect),
    preferredDeviceId: deviceId,
    preferredDeviceName:
      typeof value.preferredDeviceName === 'string' ? value.preferredDeviceName : '',
    connectionTimeoutMs:
      Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_DEVICE_SETTINGS.connectionTimeoutMs,
    notificationPreference: validNotification,
  };
}

export async function loadDeviceSettings(): Promise<DeviceSettings> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    console.log('Loaded device settings:', json);
    if (!json) return { ...DEFAULT_DEVICE_SETTINGS };
    return coerce(JSON.parse(json));
  } catch {
    return { ...DEFAULT_DEVICE_SETTINGS };
  }
}

export async function saveDeviceSettings(settings: DeviceSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    console.log('Saved device settings:', settings);
  } catch {
    // ignore persistence failures
  }
}
