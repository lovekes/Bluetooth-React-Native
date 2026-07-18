import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import Colors from '../../../common/constants/Colors';
import { Strings } from '../../../common/constants/Strings';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
}

export const SearchInput: React.FC<SearchInputProps> = React.memo(({ value, onChangeText }) => {
  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder={Strings.searchPlaceholder}
          placeholderTextColor={Colors.light.textSecondary}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
    </View>
  );
});

SearchInput.displayName = 'SearchInput';

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}),
  },
});
