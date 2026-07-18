#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(BleNativeModule, RCTEventEmitter)

RCT_EXTERN_METHOD(startScan:(NSArray<NSString *> *)services
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopScan:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(connect:(NSString *)deviceId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(disconnect:(NSString *)deviceId
                    resolver:(RCTPromiseResolveBlock)resolve
                    rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(readCharacteristic:(NSString *)deviceId
                  serviceUUID:(NSString *)serviceUUID
                  characteristicUUID:(NSString *)characteristicUUID
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(writeCharacteristic:(NSString *)deviceId
                  serviceUUID:(NSString *)serviceUUID
                  characteristicUUID:(NSString *)characteristicUUID
                  valueBase64:(NSString *)valueBase64
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isBluetoothEnabled:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
