import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import Colors from '../../../common/constants/Colors';
import { Strings } from '../../../common/constants/Strings';

interface ScanButtonProps {
  isScanning: boolean;
  onPress: () => void;
}

export const ScanButton: React.FC<ScanButtonProps> = React.memo(({ isScanning, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.button, isScanning ? styles.buttonStop : styles.buttonStart]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {isScanning ? (
        <View style={styles.scanningContent}>
          <ActivityIndicator size="small" color={Colors.light.surface} />
          <Text style={styles.buttonText}>{Strings.stopScan}</Text>
        </View>
      ) : (
        <Text style={styles.buttonText}>{Strings.startScan}</Text>
      )}
    </TouchableOpacity>
  );
});

ScanButton.displayName = 'ScanButton';

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonStart: {
    backgroundColor: Colors.light.primary,
  },
  buttonStop: {
    backgroundColor: Colors.light.error,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  scanningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
