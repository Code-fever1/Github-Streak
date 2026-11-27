package com.streakkeeper.mobile

import android.app.ActivityManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class KeeperModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
  override fun getName(): String = "StreakKeeperNative"

  @ReactMethod
  fun startService() {
    KeeperService.start(reactApplicationContext)
  }

  @ReactMethod
  fun stopService(exitIfBackground: Boolean) {
    KeeperService.stop(reactApplicationContext, exitIfBackground)
  }

  @ReactMethod
  fun scheduleNextWake(triggerAtMs: Double) {
    StreakWakeScheduler.scheduleAt(reactApplicationContext, triggerAtMs.toLong())
  }

  @ReactMethod
  fun getNextWakeAt(promise: Promise) {
    try {
      promise.resolve(StreakWakeScheduler.nextWakeAt(reactApplicationContext).toDouble())
    } catch (err: Exception) {
      promise.reject("wake_at", err)
    }
  }

  @ReactMethod
  fun updateStatus(status: String) {
    KeeperService.update(reactApplicationContext, status)
  }

  @ReactMethod
  fun markCommittedToday() {
    CommitDay.markToday(reactApplicationContext)
  }

  @ReactMethod
  fun scheduleReminders() {
    ReminderAlarms.scheduleNext(reactApplicationContext)
  }

  @ReactMethod
  fun isIgnoringBatteryOptimizations(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        promise.resolve(true)
        return
      }
      val pm = reactApplicationContext.getSystemService(PowerManager::class.java)
      promise.resolve(pm.isIgnoringBatteryOptimizations(reactApplicationContext.packageName))
    } catch (err: Exception) {
      promise.reject("battery", err)
    }
  }

  @ReactMethod
  fun setFiverrAlertConfig(enabled: Boolean, mode: String, vibrate: Boolean) {
    NotificationAlertPrefs.setConfig(reactApplicationContext, enabled, mode, vibrate, 1, "[]")
  }

  @ReactMethod
  fun setNotificationAlertConfig(
    enabled: Boolean,
    mode: String,
    vibrate: Boolean,
    delayMinutes: Int,
    packagesJson: String,
  ) {
    NotificationAlertPrefs.setConfig(reactApplicationContext, enabled, mode, vibrate, delayMinutes, packagesJson)
  }

  @ReactMethod
  fun applyNotificationAlerts(
    enabled: Boolean,
    mode: String,
    vibrate: Boolean,
    delayMinutes: Int,
    packagesJson: String,
    promise: Promise,
  ) {
    try {
      NotificationAlertPrefs.setConfig(
        reactApplicationContext,
        enabled,
        mode,
        vibrate,
        delayMinutes,
        packagesJson,
        syncRootAsync = false,
      )
      val ok = if (RootMonitorInstaller.isSuAvailable()) {
        RootMonitorInstaller.apply(reactApplicationContext)
      } else {
        false
      }
      promise.resolve(ok)
    } catch (err: Exception) {
      promise.reject("apply_alerts", err)
    }
  }

  @ReactMethod
  fun getRootMonitorStatus(promise: Promise) {
    try {
      promise.resolve(RootMonitorInstaller.statusJson())
    } catch (err: Exception) {
      promise.reject("root_mon_status", err)
    }
  }

  @ReactMethod
  fun getLaunchableApps(promise: Promise) {
    try {
      val pm = reactApplicationContext.packageManager
      val self = reactApplicationContext.packageName
      val seen = HashSet<String>()
      val rows = mutableListOf<Pair<String, String>>()

      fun add(pkg: String, label: String) {
        val clean = label.trim()
        if (pkg == self || pkg.isBlank() || clean.isEmpty() || !seen.add(pkg)) return
        rows.add(pkg to clean)
      }

      @Suppress("DEPRECATION")
      val installed: List<ApplicationInfo> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          pm.getInstalledApplications(
            PackageManager.ApplicationInfoFlags.of(PackageManager.MATCH_ALL.toLong()),
          )
        } else {
          pm.getInstalledApplications(PackageManager.GET_META_DATA)
        }

      for (info in installed) {
        val label = pm.getApplicationLabel(info).toString()
        val systemOnly =
          (info.flags and ApplicationInfo.FLAG_SYSTEM) != 0 &&
            (info.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) == 0
        // Skip low-level system services with no real app name; keep user + Play-updated apps.
        if (systemOnly && label.equals(info.packageName, ignoreCase = true)) continue
        add(info.packageName, label)
      }

      val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      @Suppress("DEPRECATION")
      val launchFlags =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PackageManager.MATCH_ALL else 0
      @Suppress("DEPRECATION")
      for (resolve in pm.queryIntentActivities(launcher, launchFlags)) {
        val pkg = resolve.activityInfo.packageName
        add(pkg, resolve.loadLabel(pm).toString())
      }

      rows.sortBy { it.second.lowercase() }
      val out = Arguments.createArray()
      for ((pkg, label) in rows) {
        val map = Arguments.createMap()
        map.putString("package", pkg)
        map.putString("label", label)
        out.pushMap(map)
      }
      promise.resolve(out)
    } catch (err: Exception) {
      promise.reject("apps", err)
    }
  }

  @ReactMethod
  fun testFiverrAlert(mode: String, vibrate: Boolean) {
    FiverrAlerter.play(reactApplicationContext, mode, vibrate)
  }

  @ReactMethod
  fun stopFiverrAlert() {
    FiverrAlerter.stop()
  }

  @ReactMethod
  fun isNotificationListenerEnabled(promise: Promise) {
    try {
      promise.resolve(notificationListenerGranted() || RootMonitorInstaller.isDaemonAlive())
    } catch (err: Exception) {
      promise.reject("listener", err)
    }
  }

  @ReactMethod
  fun isSuAvailable(promise: Promise) {
    try {
      promise.resolve(SuRunner.isSuAvailable())
    } catch (err: Exception) {
      promise.reject("su", err)
    }
  }

  @ReactMethod
  fun isRootMonitorInstalled(promise: Promise) {
    try {
      promise.resolve(RootMonitorInstaller.isInstalled())
    } catch (err: Exception) {
      promise.reject("root_mon", err)
    }
  }

  @ReactMethod
  fun installRootNotificationMonitor(promise: Promise) {
    try {
      RootMonitorConfig.export(reactApplicationContext)
      promise.resolve(RootMonitorInstaller.install(reactApplicationContext))
    } catch (err: Exception) {
      promise.reject("root_install", err)
    }
  }

  @ReactMethod
  fun uninstallRootNotificationMonitor(promise: Promise) {
    try {
      promise.resolve(RootMonitorInstaller.uninstall(reactApplicationContext))
    } catch (err: Exception) {
      promise.reject("root_uninstall", err)
    }
  }

  @ReactMethod
  fun openNotificationListenerSettings() {
    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    reactApplicationContext.startActivity(intent)
  }

  private fun notificationListenerGranted(): Boolean {
    val cn = ComponentName(reactApplicationContext, FiverrNotificationListener::class.java)
    val flat = Settings.Secure.getString(
      reactApplicationContext.contentResolver,
      "enabled_notification_listeners",
    ) ?: return false
    return flat.split(':').any { ComponentName.unflattenFromString(it) == cn }
  }

  @ReactMethod
  fun requestIgnoreBatteryOptimizations() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    val pm = reactApplicationContext.getSystemService(PowerManager::class.java)
    if (pm.isIgnoringBatteryOptimizations(reactApplicationContext.packageName)) return
    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
      data = Uri.parse("package:${reactApplicationContext.packageName}")
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    reactApplicationContext.startActivity(intent)
  }

  @ReactMethod
  fun setChargeHoldConfig(
    enabled: Boolean,
    cap: Int,
    lower: Int,
    pollSec: Int,
    chargeSwitch: String,
  ) {
    ChargeHoldConfig.setConfig(
      reactApplicationContext,
      enabled,
      cap,
      lower,
      pollSec,
      chargeSwitch,
    )
  }

  @ReactMethod
  fun probeChargeHoldNodes(promise: Promise) {
    try {
      promise.resolve(ChargeHoldProbe.probeJson())
    } catch (err: Exception) {
      promise.reject("charge_probe", err)
    }
  }

  @ReactMethod
  fun getChargeHoldStatus(promise: Promise) {
    try {
      promise.resolve(ChargeHoldProbe.statusJson())
    } catch (err: Exception) {
      promise.reject("charge_status", err)
    }
  }

  @ReactMethod
  fun isChargeHoldInstalled(promise: Promise) {
    try {
      promise.resolve(ChargeHoldInstaller.isInstalled())
    } catch (err: Exception) {
      promise.reject("charge_installed", err)
    }
  }

  @ReactMethod
  fun installChargeHoldDaemon(promise: Promise) {
    try {
      ChargeHoldConfig.export(reactApplicationContext)
      promise.resolve(ChargeHoldInstaller.install(reactApplicationContext))
    } catch (err: Exception) {
      promise.reject("charge_install", err)
    }
  }

  @ReactMethod
  fun applyChargeHold(enabled: Boolean, cap: Int, lower: Int, pollSec: Int, promise: Promise) {
    try {
      ChargeHoldConfig.setConfig(
        reactApplicationContext,
        enabled,
        cap,
        lower,
        pollSec,
        "auto",
      )
      promise.resolve(ChargeHoldInstaller.apply(reactApplicationContext))
    } catch (err: Exception) {
      promise.reject("charge_apply", err)
    }
  }

  @ReactMethod
  fun uninstallChargeHoldDaemon(promise: Promise) {
    try {
      promise.resolve(ChargeHoldInstaller.uninstall())
    } catch (err: Exception) {
      promise.reject("charge_uninstall", err)
    }
  }

  @ReactMethod
  fun getMemoryInfo(promise: Promise) {
    try {
      val am = reactApplicationContext.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
      if (am == null) {
        promise.resolve(null)
        return
      }
      val info = ActivityManager.MemoryInfo()
      am.getMemoryInfo(info)
      val total = info.totalMem.toDouble()
      val avail = info.availMem.toDouble()
      val used = (info.totalMem - info.availMem).coerceAtLeast(0L).toDouble()
      val map = Arguments.createMap()
      map.putDouble("totalBytes", total)
      map.putDouble("usedBytes", used)
      map.putDouble("availBytes", avail)
      map.putBoolean("lowMemory", info.lowMemory)
      promise.resolve(map)
    } catch (err: Exception) {
      promise.reject("memory_info", err)
    }
  }
}
