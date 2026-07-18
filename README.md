This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Architecture

BLETaskApp is a React Native app for scanning, connecting to, and reading/writing Bluetooth Low Energy (BLE) devices. It uses a **custom native bridge** (no third-party BLE plugin) so the exact scan, connection, and GATT behavior is fully under our control on both platforms.

## High-level data flow

```
React UI (screens/hooks)
        │  JS method calls + event callbacks
        ▼
deviceListService (TS)  ── NativeModules API ──►  BleNativeModule (Kotlin / Swift)
        ▲                                            │
        │            NativeEventEmitter              │  CoreBluetooth / Android Bluetooth LE
        └──────────── BleDeviceFound / Updated / ────┘
                       ConnectionStateChanged / Error
```

- **Native layer** performs the actual BLE work and emits events back to JS (`BleDeviceFound`, `BleDeviceUpdated`, `BleConnectionStateChanged`, `BleScanStopped`, `BleError`).
- **Service layer** (`deviceListService.ts`) wraps `NativeModules.BleNativeModule`, normalizes events into `BleDeviceInfo`, keeps an in-memory `deviceStore`, and exposes promise-based `startScan` / `connect` / `readCharacteristic` / `writeCharacteristic` helpers.
- **Hooks** (`useDeviceList`) hold React state (device list, scanning flag, search, sort, errors) and bind service callbacks to UI updates.
- **Screens** (`DeviceListScreen`, `DeviceSettingsScreen`) render the list, a device detail sheet with connect/read/write controls, and persisted preferences.

## Module layout

```
src/
├── app/                      App root + navigator (native stack)
├── common/constants/         Colors, Strings, Routes
└── modules/
    ├── device-list/
    │   ├── bridge/           BleNativeBridge.ts (typed native module wrapper)
    │   ├── components/       DeviceItem, ScanButton, SearchInput, SortMenu, ...
    │   ├── hooks/            useDeviceList.ts (state + actions)
    │   ├── screens/          DeviceListScreen.tsx
    │   ├── services/         deviceListService.ts (native bridge + helpers)
    │   └── types.ts          BleDeviceInfo, ConnectionStatus, SortConfig
    └── device-settings/
        ├── screens/          DeviceSettingsScreen.tsx
        └── services/         deviceSettingsService.ts (AsyncStorage persistence)
```

## Native modules

- **Android** — `BleNativeModule.kt`: uses `BluetoothManager` / `BluetoothLeScanner` for scanning (`ScanSettings.SCAN_MODE_LOW_LATENCY`), `BluetoothGatt` for connect/discover/read/write, and polls RSSI every 2s via `Handler`. Characteristic values are exchanged as Base64.
- **iOS** — `BleNativeModule.swift`: `CBCentralManager` on a private serial queue, `CBPeripheral` for GATT ops, RSSI polling via `Timer`, and `setNotifyValue` for notify/indicate characteristics. Values are exchanged as Base64.

## Subscribe + read/write workflow

1. **Subscribe / scan** — `startScan()` checks Bluetooth power + permissions, clears the store, and starts the native scan. Discovered and updated devices stream in via `BleDeviceFound` / `BleDeviceUpdated`.
2. **Connect** — `connect(deviceId)` opens a GATT connection; `BleConnectionStateChanged` drives the UI status badge. On connect, services are discovered and RSSI polling begins.
3. **Read** — `readCharacteristic(deviceId, serviceUUID, charUUID)` returns a Base64 value which the service decodes to hex for display.
4. **Write** — `writeCharacteristic(...)` takes a hex string, encodes it to Base64, and writes with response on iOS (Android requests write via `BluetoothGattCharacteristic`).

The demo screen uses a fixed service/characteristic UUID pair (`0000FFF0-...` / `0000FFF1-...`) for read/write testing against a real BLE peripheral.

# Libraries & Rationale

| Library | Purpose | Why it was chosen |
| --- | --- | --- |
| `react-native` (0.86) | Core framework | Latest stable RN; New Architecture ready. |
| `@react-navigation/native` + `native-stack` | Screen navigation | Minimal, type-safe stack navigation for list → settings and modal sheets. |
| `react-native-safe-area-context` | Safe-area insets | Avoids notches/status bar overlap without extra deps. |
| `react-native-screens` | Native screen primitives | Required by React Navigation for performance. |
| `@react-native-async-storage/async-storage` | Local persistence | Stores device settings (auto-connect, preferred device, timeout, notifications). |
| `@react-native-community/netinfo` | Connectivity awareness | Available for online/offline status handling. |
| Custom `BleNativeModule` (Kotlin/Swift) | BLE over `NativeModules` | Full control of scanning, GATT, and RSSI without a third-party BLE plugin; consistent event contract across platforms. |

**Why a custom native bridge instead of a BLE library?** It keeps the bundle lean, removes a dependency on a plugin's update cadence, and lets us define the exact event names and Base64 value contract the JS layer relies on.

# Known Limitations

- **No BLE plugin parity features** — bonding/pairing, MTU negotiation, and reliable-write (long writes) are not implemented.
- **Android scan filter ignored** — `startScan` ignores the `services` argument and scans for all devices (`leScanner.startScan(null, ...)`).
- **iOS read parsing is device-specific** — `didUpdateValueFor` contains hardcoded OPPO-specific byte-range extraction (`extractString`) that is not generic.
- **iOS doesn't resolve reads for missing characteristic** — `readCharacteristic` only resolves once a matching discovered characteristic fires; if services never report it, the promise hangs (no explicit timeout).
- **Android read errors still resolve** — `onCharacteristicRead` resolves with the (possibly empty) value even on failure instead of rejecting.
- **No write-type choice on Android** — write uses the characteristic's default write type; no `.withResponse`/`.withoutResponse` toggle.
- **RSSI polling never stops on iOS scan stop for undisconnected devices** — timers are tied to connection lifecycle, not scan lifecycle.
- **Settings are not yet enforced** — `autoConnect`, `preferredDeviceId`, `connectionTimeoutMs`, and `notificationPreference` are saved but not wired into connect/scan behavior.
- **iOS Simulator cannot do BLE** — testing requires a physical device; Android emulator BLE is also unreliable.
- **`console.log`/debug prints left in production paths** (e.g. `----------- Device found`, `==== Read Result`) — noisy and should be gated.
- **Fetch of device list** uses a hard-coded mock endpoint (`mocki.io`) as a fallback seed, not real nearby devices.

# Next Improvements

- Add bonding/pairing, MTU request, and reliable-write support to both native modules.
- Honor `services` filter on Android scan and add a `scanFilters` API.
- Make iOS read/write generic: remove device-specific `extractString` parsing; return raw Base64 and let JS decode (as Android already does).
- Add explicit timeouts/rejection for read/write/connect promises (use the persisted `connectionTimeoutMs`).
- Reject Android reads on `GATT` failure; add proper error propagation.
- Allow choosing write type (with/without response) and queue multiple writes.
- Wire saved `DeviceSettings` into runtime behavior: auto-connect to preferred device, apply timeout, respect notification preferences.
- Replace the mock device endpoint with real scan results or a configurable source.
- Add unit/integration tests (Jest for the service/hook layer; native instrumented tests) and a debug log toggle.
- Add a BLE-permission rationale UI and runtime Bluetooth-off prompt/handling.
- Support background scan (where OS allows) and connection restoration on iOS.

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
