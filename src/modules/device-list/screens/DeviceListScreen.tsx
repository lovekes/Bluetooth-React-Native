import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    RefreshControl,
    TextInput,
    ScrollView,
    Modal,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Routes } from '../../../common/constants/Routes';
import Colors from '../../../common/constants/Colors';
import { Strings } from '../../../common/constants/Strings';
import { ScanButton } from '../components/ScanButton';
import { SearchInput } from '../components/SearchInput';
import { SortMenu } from '../components/SortMenu';
import { DeviceItem } from '../components/DeviceItem';
import { useDeviceList } from '../hooks/useDeviceList';
import type { BleDeviceInfo } from '../types';
import { cleanup } from '../services/deviceListService';

type RootStackParamList = {
    DeviceList: undefined;
    DeviceSettings: { devices?: BleDeviceInfo[] };
};

interface DeviceListScreenProps {
    navigation?: NativeStackNavigationProp<RootStackParamList, 'DeviceList'>;
}

const SERVICE_UUID = '0000FFF0-0000-1000-8000-00805F9B34FB';
const CHAR_UUID = '0000FFF1-0000-1000-8000-00805F9B34FB';

export const DeviceListScreen: React.FC<DeviceListScreenProps> = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const [selectedDevice, setSelectedDevice] = useState<BleDeviceInfo | null>(null);
    const [writeText, setWriteText] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [readResult, setReadResult] = useState<string | null>(null);
    const {
        devices,
        allDevices,
        isScanning,
        searchQuery,
        sortConfig,
        loadingRead,
        loadingWrite,
        error,
        handleToggleScan,
        handleRefresh,
        handleSearchChange,
        handleSetSortOption,
        handleConnect,
        handleDisconnect,
        handleReadData,
        handleWriteData,
        handleDismissError,
    } = useDeviceList();

    const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (error) {
            errorTimeoutRef.current = setTimeout(() => {
                handleDismissError();
            }, 5000);
        }
        return () => {
            if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
        };
    }, [error, handleDismissError]);

    useFocusEffect(
        useCallback(() => {
            return () => {
                cleanup();
            };
        }, [])
    );

    useEffect(() => {
        return () => {
            cleanup();
        };
    }, []);

    const handleDevicePress = useCallback((device: BleDeviceInfo) => {
        setSelectedDevice(device);
        setWriteText('');
        setReadResult(null);
        setModalVisible(true);
    }, []);

    const handleConnectFromModal = useCallback(async () => {
        if (!selectedDevice) return;
        if (selectedDevice.connectionStatus === 'connected') {
            await handleDisconnect(selectedDevice.id);
        } else {
            await handleConnect(selectedDevice.id);
        }
        const updated = devices.find(d => d.id === selectedDevice.id);
        if (updated) setSelectedDevice(updated);
    }, [selectedDevice, devices, handleConnect, handleDisconnect]);

    const handleReadFromModal = useCallback(async () => {
        if (!selectedDevice) return;
        const result = await handleReadData(selectedDevice.id, SERVICE_UUID, CHAR_UUID);
        console.log("======= Read Result:", result);
        if (result !== null) {
            setReadResult(result);
        }
    }, [selectedDevice, handleReadData]);

    const handleWriteFromModal = useCallback(async () => {
        if (!selectedDevice || !writeText.trim()) return;
        const success = await handleWriteData(selectedDevice.id, SERVICE_UUID, CHAR_UUID, writeText.trim());
        console.log("======= Write Result:", success);
        if (success) {
            setWriteText('');
            setReadResult(null);
        }
    }, [selectedDevice, writeText, handleWriteData]);

    const handleCloseModal = useCallback(() => {
        setModalVisible(false);
        setSelectedDevice(null);
        setWriteText('');
        setReadResult(null);
    }, []);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar barStyle="dark-content" backgroundColor={Colors.light.background} />

            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                <View style={styles.titleRow}>
                    <Text style={styles.title}>{Strings.appTitle}</Text>
                    <View style={styles.headerActions}>
                        <Pressable
                            style={styles.settingsBtn}
                            hitSlop={12}
                            onPress={() => navigation?.navigate(Routes.DeviceSettings, { devices: allDevices })}
                            testID="openSettings"
                        >
                            <Text style={styles.settingsBtnText}>⚙</Text>
                        </Pressable>
                        <ScanButton isScanning={isScanning} onPress={handleToggleScan} />
                    </View>
                </View>

                <SearchInput value={searchQuery} onChangeText={handleSearchChange} />
                <SortMenu sortConfig={sortConfig} onSelect={handleSetSortOption} />
            </View>

            {error && (
                <Pressable style={styles.errorBanner} onPress={handleDismissError}>
                    <Text style={styles.errorText}>{error}</Text>
                </Pressable>
            )}

            <FlatList
                data={devices}
                renderItem={({ item, index }) => (
                    <DeviceItem
                        device={item}
                        onPress={handleDevicePress}
                        onConnect={handleConnect}
                        onDisconnect={handleDisconnect}
                        lastConnectedTime={{}}
                        index={index}
                    />
                )}
                keyExtractor={item => item.id}
                contentContainerStyle={[
                    styles.listContent,
                    devices.length === 0 && styles.listContentEmpty,
                ]}
                ListEmptyComponent={<EmptyListComponent isScanning={isScanning} />}
                refreshControl={
                    <RefreshControl
                        refreshing={isScanning}
                        onRefresh={handleRefresh}
                        tintColor={Colors.light.primary}
                        colors={[Colors.light.primary]}
                    />
                }
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={ListSeparatorComponent}
                initialNumToRender={10}
                maxToRenderPerBatch={5}
                windowSize={5}
            />

            {isScanning && (
                <View style={[styles.scanningBar, { paddingBottom: insets.bottom + 8 }]}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.scanningText}>{Strings.scanning}</Text>
                </View>
            )}

            <Modal
                visible={modalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={handleCloseModal}
            >
                <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {selectedDevice?.name || selectedDevice?.localName || 'Unknown Device'}
                        </Text>
                        <Pressable onPress={handleCloseModal} style={styles.modalCloseBtn}>
                            <Text style={styles.modalCloseText}>✕</Text>
                        </Pressable>
                    </View>

                    {selectedDevice && (
                        <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
                            <View style={styles.modalInfoRow}>
                                <Text style={styles.modalLabel}>{Strings.deviceId}:</Text>
                                <Text style={styles.modalValue} selectable>
                                    {selectedDevice.id}
                                </Text>
                            </View>
                            <View style={styles.modalInfoRow}>
                                <Text style={styles.modalLabel}>{Strings.rssi}:</Text>
                                <Text style={styles.modalValue}>
                                    {selectedDevice.rssi !== null ? `${selectedDevice.rssi} dBm` : 'N/A'}
                                </Text>
                            </View>
                            <View style={styles.modalInfoRow}>
                                <Text style={styles.modalLabel}>{Strings.connected}:</Text>
                                <View style={[
                                    styles.statusBadge,
                                    {
                                        backgroundColor:
                                            selectedDevice.connectionStatus === 'connected'
                                                ? Colors.light.success + '20'
                                                : Colors.light.textSecondary + '20',
                                    },
                                ]}>
                                    <View style={[
                                        styles.statusDot,
                                        {
                                            backgroundColor: selectedDevice.connectionStatus === 'connected'
                                                ? Colors.light.success
                                                : Colors.light.textSecondary
                                        },
                                    ]} />
                                    <Text style={[
                                        styles.statusText,
                                        {
                                            color: selectedDevice.connectionStatus === 'connected'
                                                ? Colors.light.success
                                                : Colors.light.textSecondary
                                        },
                                    ]}>
                                        {selectedDevice.connectionStatus === 'connected'
                                            ? Strings.connected
                                            : Strings.disconnected}
                                    </Text>
                                </View>
                            </View>
                            {selectedDevice.serviceUUIDs && selectedDevice.serviceUUIDs.length > 0 && (
                                <View style={styles.modalInfoRow}>
                                    <Text style={styles.modalLabel}>Services:</Text>
                                    <Text style={styles.modalValue} selectable>
                                        {selectedDevice.serviceUUIDs.join(', ')}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.modalDivider} />

                            <View style={styles.modalActions}>
                                <Pressable
                                    style={[
                                        styles.modalBtn,
                                        selectedDevice.connectionStatus === 'connected'
                                            ? styles.modalBtnDisconnect
                                            : styles.modalBtnConnect,
                                    ]}
                                    onPress={handleConnectFromModal}
                                >
                                    <Text style={[
                                        styles.modalBtnText,
                                        selectedDevice.connectionStatus === 'connected'
                                            ? styles.modalBtnTextDisconnect
                                            : styles.modalBtnTextConnect,
                                    ]}>
                                        {selectedDevice.connectionStatus === 'connected'
                                            ? 'Disconnect'
                                            : Strings.connecting}
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={[
                                        styles.modalBtn,
                                        styles.modalBtnRead,
                                        (selectedDevice.connectionStatus !== 'connected' || loadingRead === selectedDevice.id) &&
                                        styles.modalBtnDisabled,
                                    ]}
                                    onPress={handleReadFromModal}
                                    disabled={selectedDevice.connectionStatus !== 'connected' || !!loadingRead}
                                >
                                    <Text style={styles.modalBtnTextRead}>
                                        {loadingRead === selectedDevice.id ? 'Reading...' : Strings.readData}
                                    </Text>
                                </Pressable>
                            </View>

                            <View style={styles.writeSection}>
                                <Text style={styles.writeLabel}>{Strings.enterDataToWrite}:</Text>
                                <TextInput
                                    style={styles.writeInput}
                                    value={writeText}
                                    onChangeText={setWriteText}
                                    placeholder="hex or text"
                                    placeholderTextColor={Colors.light.textSecondary}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <Pressable
                                    style={[
                                        styles.modalBtn,
                                        styles.modalBtnWrite,
                                        (selectedDevice.connectionStatus !== 'connected' || loadingWrite === selectedDevice.id) &&
                                        styles.modalBtnDisabled,
                                    ]}
                                    onPress={handleWriteFromModal}
                                    disabled={selectedDevice.connectionStatus !== 'connected' || !!loadingWrite}
                                >
                                    <Text style={styles.modalBtnTextWrite}>
                                        {loadingWrite === selectedDevice.id ? 'Writing...' : Strings.writeData}
                                    </Text>
                                </Pressable>
                            </View>

                            {(readResult !== null) && (
                                <View style={styles.readResultBox}>
                                    <Text style={styles.readResultLabel}>{Strings.dataReceived}:</Text>
                                    <Text style={styles.readResultValue} selectable>
                                        {readResult}
                                    </Text>
                                </View>
                            )}
                        </ScrollView>
                    )}
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

interface EmptyListProps {
    isScanning: boolean;
}

const EmptyListComponent: React.FC<EmptyListProps> = React.memo(({ isScanning }) => {
    if (isScanning) {
        return (
            <View style={styles.emptyContainer}>
                <View style={styles.scanningIndicator}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.emptyTitle}>{Strings.scanning}</Text>
                </View>
                <Text style={styles.emptySubtext}>Looking for nearby BLE devices...</Text>
            </View>
        );
    }
    return (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>📡</Text>
            </View>
            <Text style={styles.emptyTitle}>{Strings.noDevicesFound}</Text>
            <Text style={styles.emptySubtext}>{Strings.noDevicesSubtext}</Text>
        </View>
    );
});

EmptyListComponent.displayName = 'EmptyListComponent';

const ListSeparatorComponent = React.memo(() => (
    <View style={styles.separator} />
));

ListSeparatorComponent.displayName = 'ListSeparatorComponent';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    header: {
        backgroundColor: Colors.light.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
        paddingBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 4,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    settingsBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.primary + '12',
    },
    settingsBtnText: {
        fontSize: 20,
        color: Colors.light.primary,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.light.text,
        letterSpacing: -0.5,
    },
    listContent: {
        paddingVertical: 8,
        flexGrow: 1,
    },
    listContentEmpty: {
        justifyContent: 'center',
    },
    separator: {
        height: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        paddingVertical: 60,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.light.primary + '12',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyIconText: {
        fontSize: 36,
    },
    scanningIndicator: {
        alignItems: 'center',
        gap: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.light.text,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        color: Colors.light.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    pulseDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.light.scanPulse,
    },
    errorBanner: {
        backgroundColor: Colors.light.error + '15',
        marginHorizontal: 16,
        marginVertical: 8,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.light.error + '40',
    },
    errorText: {
        color: Colors.light.error,
        fontSize: 13,
        fontWeight: '500',
    },
    scanningBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        backgroundColor: Colors.light.surface,
        borderTopWidth: 1,
        borderTopColor: Colors.light.border,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    scanningText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.light.primary,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
    },
    modalTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: Colors.light.text,
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        backgroundColor: Colors.light.border,
    },
    modalCloseText: {
        fontSize: 16,
        color: Colors.light.textSecondary,
        fontWeight: '600',
    },
    modalBody: {
        flex: 1,
    },
    modalBodyContent: {
        padding: 16,
    },
    modalInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        gap: 8,
    },
    modalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.light.textSecondary,
        minWidth: 80,
    },
    modalValue: {
        flex: 1,
        fontSize: 14,
        color: Colors.light.text,
        fontFamily: 'Menlo',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        gap: 5,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    modalDivider: {
        height: 1,
        backgroundColor: Colors.light.border,
        marginVertical: 16,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBtnConnect: {
        backgroundColor: Colors.light.primary,
    },
    modalBtnDisconnect: {
        backgroundColor: Colors.light.error,
    },
    modalBtnRead: {
        backgroundColor: Colors.light.success,
    },
    modalBtnWrite: {
        backgroundColor: Colors.light.primary,
        marginTop: 10,
    },
    modalBtnDisabled: {
        opacity: 0.5,
    },
    modalBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    modalBtnTextConnect: {
        color: '#FFFFFF',
    },
    modalBtnTextDisconnect: {
        color: '#FFFFFF',
    },
    modalBtnTextRead: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    modalBtnTextWrite: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    writeSection: {
        marginBottom: 16,
    },
    writeLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.light.textSecondary,
        marginBottom: 8,
    },
    writeInput: {
        backgroundColor: Colors.light.surface,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        color: Colors.light.text,
    },
    readResultBox: {
        backgroundColor: Colors.light.success + '12',
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: Colors.light.success + '30',
    },
    readResultLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.light.success,
        marginBottom: 6,
    },
    readResultValue: {
        fontSize: 13,
        color: Colors.light.text,
        fontFamily: 'Menlo',
    },
});
