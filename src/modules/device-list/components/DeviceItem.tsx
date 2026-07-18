import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Colors from '../../../common/constants/Colors';
import { Strings } from '../../../common/constants/Strings';
import type { BleDeviceInfo, ConnectionStatus } from '../types';

interface DeviceItemProps {
    device: BleDeviceInfo;
    onPress: (device: BleDeviceInfo) => void;
    onConnect: (id: string) => void;
    onDisconnect: (id: string) => void;
    lastConnectedTime: { [key: string]: number };
    index: number;
}

function getRssiColor(rssi: number | null): string {
    if (rssi === null) return Colors.light.textSecondary;
    if (rssi >= -60) return Colors.light.rssiStrong;
    if (rssi >= -80) return Colors.light.rssiMedium;
    return Colors.light.rssiWeak;
}

function getRssiBars(rssi: number | null): number {
    if (rssi === null) return 0;
    if (rssi >= -50) return 4;
    if (rssi >= -65) return 3;
    if (rssi >= -80) return 2;
    return 1;
}

function formatLastConnected(timestamp: number | null): string {
    if (timestamp === null) return Strings.never;
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hrs ago`;
    return new Date(timestamp).toLocaleDateString();
}

function getConnectionStatusColor(status: ConnectionStatus): string {
    switch (status) {
        case 'connected': return Colors.light.success;
        case 'connecting': return Colors.light.warning;
        default: return Colors.light.textSecondary;
    }
}

export const DeviceItem: React.FC<DeviceItemProps> = React.memo(({
    device,
    onPress,
    onConnect,
    onDisconnect,
    lastConnectedTime,
    index,
}) => {
    const displayName = device.name || device.localName || 'Unknown Device';
    const rssiBars = getRssiBars(device.rssi);
    const lastConnected = lastConnectedTime[device.id] ?? device.lastConnected;

    return (
        <Pressable
            style={[styles.container, index % 2 === 0 && styles.containerEven]}
            onPress={() => onPress(device)}
        >
            <View style={styles.mainContent}>
                <View style={styles.nameSection}>
                    <Text style={styles.name} numberOfLines={1}>
                        {displayName}
                    </Text>
                    <Text style={styles.id} numberOfLines={1}>
                        {Strings.deviceId}: {device.id}
                    </Text>
                </View>

                <View style={styles.rightSection}>
                    <View style={styles.rssiSection}>
                        <View style={styles.rssiBars}>
                            {[1, 2, 3, 4].map(bar => (
                                <View
                                    key={bar}
                                    style={[
                                        styles.rssiBar,
                                        {
                                            backgroundColor: bar <= rssiBars
                                                ? getRssiColor(device.rssi)
                                                : Colors.light.border,
                                        },
                                    ]}
                                />
                            ))}
                        </View>
                        <Text style={[styles.rssiText, { color: getRssiColor(device.rssi) }]}>
                            {device.rssi !== null ? `${device.rssi} dBm` : 'N/A'}
                        </Text>
                    </View>

                    <View style={[
                        styles.statusBadge,
                        { backgroundColor: getConnectionStatusColor(device.connectionStatus) + '20' },
                    ]}>
                        <View style={[
                            styles.statusDot,
                            { backgroundColor: getConnectionStatusColor(device.connectionStatus) },
                        ]} />
                        <Text style={[
                            styles.statusText,
                            { color: getConnectionStatusColor(device.connectionStatus) },
                        ]}>
                            {device.connectionStatus === 'connected'
                                ? Strings.connected
                                : device.connectionStatus === 'connecting'
                                    ? Strings.connecting
                                    : Strings.disconnected}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.lastConnected}>
                    {Strings.lastConnected}: {formatLastConnected(lastConnected)}
                </Text>

                <View style={styles.actionButtons}>
                    {device.connectionStatus === 'connected' ? (
                        <Pressable
                            style={[styles.actionBtn, styles.disconnectBtn]}
                            onPress={() => onDisconnect(device.id)}
                        >
                            <Text style={styles.disconnectBtnText}>Disconnect</Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            style={[styles.actionBtn, styles.connectBtn]}
                            onPress={() => onConnect(device.id)}
                        >
                            <Text style={styles.connectBtnText}>Connect</Text>
                        </Pressable>
                    )}
                    <Pressable
                        style={[styles.actionBtn, styles.dataBtn]}
                        onPress={() => onPress(device)}
                    >
                        <Text style={styles.dataBtnText}>Data</Text>
                    </Pressable>
                </View>
            </View>
        </Pressable>
    );
});

DeviceItem.displayName = 'DeviceItem';

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.light.surface,
        borderRadius: 12,
        marginHorizontal: 16,
        marginVertical: 6,
        padding: 14,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
    },
    containerEven: {
        backgroundColor: '#FAFAFC',
    },
    mainContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    nameSection: {
        flex: 1,
        marginRight: 12,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.light.text,
        marginBottom: 2,
    },
    id: {
        fontSize: 11,
        color: Colors.light.textSecondary,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    rightSection: {
        alignItems: 'flex-end',
        gap: 6,
    },
    rssiSection: {
        alignItems: 'flex-end',
    },
    rssiBars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 2,
        height: 16,
    },
    rssiBar: {
        width: 4,
        borderRadius: 1,
    },
    rssiText: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: Colors.light.border,
    },
    lastConnected: {
        fontSize: 12,
        color: Colors.light.textSecondary,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 8,
    },
    connectBtn: {
        backgroundColor: Colors.light.primary + '18',
    },
    connectBtnText: {
        color: Colors.light.primary,
        fontSize: 13,
        fontWeight: '600',
    },
    disconnectBtn: {
        backgroundColor: Colors.light.error + '18',
    },
    disconnectBtnText: {
        color: Colors.light.error,
        fontSize: 13,
        fontWeight: '600',
    },
    dataBtn: {
        backgroundColor: Colors.light.success + '18',
    },
    dataBtnText: {
        color: Colors.light.success,
        fontSize: 13,
        fontWeight: '600',
    },
});

