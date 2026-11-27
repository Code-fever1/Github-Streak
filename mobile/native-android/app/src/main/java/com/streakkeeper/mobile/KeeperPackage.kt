package com.streakkeeper.mobile

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class KeeperPackage : ReactPackage {
  @Deprecated("legacy bridge")
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(KeeperModule(reactContext))
  }

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<in Nothing, in Nothing>> {
    return emptyList()
  }
}
