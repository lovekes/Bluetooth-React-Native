import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DeviceListScreen } from '../modules/device-list';
import { DeviceSettingsScreen } from '../modules/device-settings';
import type { BleDeviceInfo } from '../modules/device-list/types';
import { Routes } from '../common/constants/Routes';

export type RootStackParamList = {
  [Routes.DeviceList]: undefined;
  [Routes.DeviceSettings]: { devices?: BleDeviceInfo[] };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={Routes.DeviceList}
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
          contentStyle: { backgroundColor: '#F2F2F7' },
        }}
      >
        <Stack.Screen
          name={Routes.DeviceList}
          component={DeviceListScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name={Routes.DeviceSettings}
          component={DeviceSettingsScreen}
          options={{ gestureEnabled: true }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
