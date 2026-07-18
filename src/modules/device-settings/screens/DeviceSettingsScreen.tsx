import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  Pressable,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Colors from '../../../common/constants/Colors';
import { Strings } from '../../../common/constants/Strings';
import type { BleDeviceInfo } from '../../device-list/types';
import {
  DeviceSettings,
  NotificationPreference,
  DEFAULT_DEVICE_SETTINGS,
  loadDeviceSettings,
  saveDeviceSettings,
} from '../services/deviceSettingsService';

type DeviceSettingsRouteParamList = {
  DeviceSettings: { devices?: BleDeviceInfo[] };
};

interface DeviceSettingsScreenProps {
  navigation?: NativeStackNavigationProp<DeviceSettingsRouteParamList, 'DeviceSettings'>;
  route?: RouteProp<DeviceSettingsRouteParamList, 'DeviceSettings'>;
}

const TIMEOUT_OPTIONS = [5000, 10000, 20000, 30000];

const NOTIFICATION_OPTIONS: { value: NotificationPreference; label: string }[] = [
  { value: 'all', label: Strings.settingsNotificationAll },
  { value: 'important', label: Strings.settingsNotificationImportant },
  { value: 'none', label: Strings.settingsNotificationNone },
];

export const DeviceSettingsScreen: React.FC<DeviceSettingsScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<DeviceSettings>({ ...DEFAULT_DEVICE_SETTINGS });
  const [saved, setSaved] = useState(false);
  const devices = route?.params?.devices ?? [];
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadDeviceSettings().then(loaded => {
      if (mounted) setSettings(loaded);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const update = useCallback(<K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const selectedDevice = devices.find(d => d.id === settings.preferredDeviceId);
  const selectedLabel =
    selectedDevice?.name ?? selectedDevice?.localName ?? settings.preferredDeviceName ?? '';

  const handleSelectDevice = useCallback((device: BleDeviceInfo) => {
    update('preferredDeviceId', device.id);
    update('preferredDeviceName', device.name ?? device.localName ?? '');
    setPickerVisible(false);
  }, [update]);

  const handleSave = useCallback(async () => {
    await saveDeviceSettings(settings);
    setSaved(true);
  }, [settings]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={styles.backBtn}
          hitSlop={12}
          onPress={() => navigation?.goBack()}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{Strings.settingsTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{Strings.settingsAutoConnect}</Text>
              <Text style={styles.rowDesc}>{Strings.settingsAutoConnectDesc}</Text>
            </View>
            <Switch
              value={settings.autoConnect}
              onValueChange={value => update('autoConnect', value)}
              trackColor={{ false: Colors.light.border, true: Colors.light.primary }}
              thumbColor={Colors.light.surface}
              testID="autoConnectSwitch"
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{Strings.settingsPreferredName}</Text>
            <Pressable
              style={[styles.input, styles.dropdownTrigger]}
              onPress={() => setPickerVisible(true)}
              testID="preferredDeviceTrigger"
            >
              <Text
                style={selectedLabel ? styles.dropdownValue : styles.dropdownPlaceholder}
                numberOfLines={1}
              >
                {selectedLabel || Strings.settingsPreferredNamePlaceholder}
              </Text>
              <Text style={styles.dropdownCaret}>▾</Text>
            </Pressable>
          </View>
        </View>

        <Modal
          visible={pickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setPickerVisible(false)}
          >
            <View style={[styles.pickerSheet, { marginBottom: insets.bottom }]}>
              <Text style={styles.pickerTitle}>{Strings.settingsPreferredName}</Text>
              {devices.length === 0 ? (
                <Text style={styles.pickerEmpty}>{Strings.noDevicesFound}</Text>
              ) : (
                <FlatList
                  data={devices}
                  keyExtractor={item => item.id}
                  style={styles.pickerList}
                  renderItem={({ item }) => {
                    const label = item.name ?? item.localName ?? item.id;
                    const selected = item.id === settings.preferredDeviceId;
                    return (
                      <Pressable
                        style={[styles.pickerItem, selected && styles.pickerItemSelected]}
                        onPress={() => handleSelectDevice(item)}
                      >
                        <View style={styles.pickerItemText}>
                          <Text
                            style={[styles.pickerItemName, selected && styles.pickerItemNameSelected]}
                            numberOfLines={1}
                          >
                            {label}
                          </Text>
                          <Text style={styles.pickerItemId} numberOfLines={1}>
                            {item.id}
                          </Text>
                        </View>
                        {selected && <Text style={styles.pickerItemCheck}>✓</Text>}
                      </Pressable>
                    );
                  }}
                />
              )}
            </View>
          </Pressable>
        </Modal>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>{Strings.settingsConnectionTimeout}</Text>
          <Text style={styles.rowDesc}>{Strings.settingsConnectionTimeoutDesc}</Text>
          <View style={styles.chipRow}>
            {TIMEOUT_OPTIONS.map(ms => {
              const selected = settings.connectionTimeoutMs === ms;
              return (
                <Pressable
                  key={ms}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => update('connectionTimeoutMs', ms)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {ms / 1000}s
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>{Strings.settingsNotificationPref}</Text>
          <View style={styles.segment}>
            {NOTIFICATION_OPTIONS.map((option, index) => {
              const selected = settings.notificationPreference === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[
                    styles.segmentItem,
                    index > 0 && styles.segmentDivider,
                    selected && styles.segmentItemSelected,
                  ]}
                  onPress={() => update('notificationPreference', option.value)}
                >
                  <Text
                    style={[styles.segmentText, selected && styles.segmentTextSelected]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {saved && <Text style={styles.savedText}>{Strings.settingsSaved}</Text>}
        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>{Strings.settingsSave}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 28,
    fontWeight: '600',
    color: Colors.light.primary,
    lineHeight: 32,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: Colors.light.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  headerSpacer: {
    width: 32,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  rowDesc: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 16,
  },
  field: {
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: Colors.light.text,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownValue: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
  },
  dropdownPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  dropdownCaret: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerEmpty: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  pickerList: {
    maxHeight: 360,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 8,
  },
  pickerItemSelected: {
    backgroundColor: Colors.light.primary + '12',
    borderColor: Colors.light.primary,
  },
  pickerItemText: {
    flex: 1,
    marginRight: 8,
  },
  pickerItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  pickerItemNameSelected: {
    color: Colors.light.primary,
  },
  pickerItemId: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  pickerItemCheck: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  chipSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  segment: {
    flexDirection: 'row',
    marginTop: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentDivider: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.light.border,
  },
  segmentItemSelected: {
    backgroundColor: Colors.light.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  segmentTextSelected: {
    color: '#FFFFFF',
  },
  footer: {
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  savedText: {
    textAlign: 'center',
    color: Colors.light.success,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  saveBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnPressed: {
    opacity: 0.85,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
