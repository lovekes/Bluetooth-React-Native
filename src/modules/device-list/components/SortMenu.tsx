import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import Colors from '../../../common/constants/Colors';
import { Strings } from '../../../common/constants/Strings';
import type { SortOption, SortConfig } from '../types';

interface SortMenuProps {
  sortConfig: SortConfig;
  onSelect: (option: SortOption) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'rssi', label: Strings.sortRssi },
  { value: 'name', label: Strings.sortName },
  { value: 'lastConnected', label: Strings.sortLastConnected },
];

export const SortMenu: React.FC<SortMenuProps> = React.memo(({ sortConfig, onSelect }) => {
  const [visible, setVisible] = useState(false);

  const getLabel = () => {
    const found = SORT_OPTIONS.find(o => o.value === sortConfig.option);
    return found ? `${Strings.sortBy}: ${found.label}` : Strings.sortBy;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.trigger} onPress={() => setVisible(true)}>
        <Text style={styles.triggerText}>{getLabel()}</Text>
        <Text style={styles.directionArrow}>
          {sortConfig.direction === 'asc' ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.menu}>
            {SORT_OPTIONS.map(option => {
              const isActive = sortConfig.option === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.option,
                    isActive && styles.optionActive,
                  ]}
                  onPress={() => {
                    onSelect(option.value);
                    setVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isActive && styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isActive && (
                    <Text style={styles.checkMark}>
                      {sortConfig.direction === 'asc' ? '▲' : '▼'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
});

SortMenu.displayName = 'SortMenu';

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  triggerText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '500',
  },
  directionArrow: {
    fontSize: 12,
    color: Colors.light.primary,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    width: 260,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  optionActive: {
    backgroundColor: Colors.light.primary + '15',
  },
  optionText: {
    fontSize: 15,
    color: Colors.light.text,
  },
  optionTextActive: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  checkMark: {
    fontSize: 12,
    color: Colors.light.primary,
    fontWeight: '700',
  },
});
