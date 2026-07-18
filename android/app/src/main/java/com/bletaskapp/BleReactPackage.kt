package com.bletaskapp

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class BleReactPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): MutableList<NativeModule> {
    return mutableListOf(BleNativeModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): MutableList<ViewManager<*, *>> {
    return mutableListOf()
  }
}
