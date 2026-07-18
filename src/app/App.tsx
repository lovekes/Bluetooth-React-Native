import React, { useEffect } from 'react';
import { StatusBar, useColorScheme, AppState, AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './AppNavigator';
import { BleNativeModule } from '../modules/device-list/services/deviceListService';

const App: React.FC = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && BleNativeModule && typeof BleNativeModule.isBluetoothEnabled === 'function') {
        BleNativeModule.isBluetoothEnabled().then((enabled: boolean) => {
          if (!enabled) {
            console.warn('Bluetooth is not powered on');
          }
        }).catch(() => {});
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <AppNavigator />
    </SafeAreaProvider>
  );
};

export default App;
