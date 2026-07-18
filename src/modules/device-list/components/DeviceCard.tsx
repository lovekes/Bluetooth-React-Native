import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../../../common/constants/Colors';

interface DeviceCardProps {
    device: {
        name: string | null;
        rssi: number | null;
        id: string;
    };
}

export const DeviceCard: React.FC<DeviceCardProps> = React.memo(({ device }) => {
    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.deviceName} numberOfLines={1}>
                    {device.name || 'Unknown Device'}
                </Text>
                <View style={styles.rssiIndicator}>
                    <Text style={styles.rssiValue}>
                        {device.rssi !== null ? `${device.rssi} dBm` : 'N/A'}
                    </Text>
                </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.deviceId} numberOfLines={1}>
                {device.id}
            </Text>
        </View>
    );
});

DeviceCard.displayName = 'DeviceCard';

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.light.surface,
        borderRadius: 12,
        padding: 16,
        marginVertical: 6,
        marginHorizontal: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    deviceName: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: Colors.light.text,
        marginRight: 12,
    },
    rssiIndicator: {
        backgroundColor: Colors.light.primary + '15',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    rssiValue: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.light.primary,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.light.border,
        marginVertical: 8,
    },
    deviceId: {
        fontSize: 11,
        color: Colors.light.textSecondary,
        fontFamily: 'Menlo',
    },
});

