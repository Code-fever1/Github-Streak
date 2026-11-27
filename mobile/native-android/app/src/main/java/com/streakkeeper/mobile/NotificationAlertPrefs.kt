package com.streakkeeper.mobile

import android.content.Context
import org.json.JSONArray
import java.util.concurrent.Executors

object NotificationAlertPrefs {
  private const val PREFS = "streak_keeper"
  private const val KEY_ENABLED = "notification_alert_enabled"
  private const val KEY_MODE = "notification_alert_mode"
  private const val KEY_VIBRATE = "notification_alert_vibrate"
  private const val KEY_DELAY_MIN = "notification_alert_delay_min"
  private const val KEY_PACKAGES = "notification_alert_packages"

  private val syncExecutor = Executors.newSingleThreadExecutor()

  fun setConfig(
    context: Context,
    enabled: Boolean,
    mode: String,
    vibrate: Boolean,
    delayMinutes: Int,
    packagesJson: String,
    syncRootAsync: Boolean = true,
  ) {
    val pkgs = parsePackages(packagesJson)
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_ENABLED, enabled)
      .putString(KEY_MODE, mode)
      .putBoolean(KEY_VIBRATE, vibrate)
      .putInt(KEY_DELAY_MIN, delayMinutes.coerceIn(1, 120))
      .putStringSet(KEY_PACKAGES, pkgs)
      .apply()
    // Legacy keys (upgrade path)
    FiverrAlertPrefs.setConfig(context, enabled, mode, vibrate)

    if (syncRootAsync) {
      val appCtx = context.applicationContext
      syncExecutor.execute {
        if (RootMonitorInstaller.isSuAvailable()) {
          RootMonitorInstaller.apply(appCtx)
        }
      }
    }
  }

  private fun parsePackages(json: String): Set<String> {
    if (json.isBlank()) return emptySet()
    return try {
      val arr = JSONArray(json)
      buildSet {
        for (i in 0 until arr.length()) {
          val item = arr.optString(i)
          if (item.isNotBlank()) add(item)
          else {
            val obj = arr.optJSONObject(i)
            val pkg = obj?.optString("package")?.trim().orEmpty()
            if (pkg.isNotBlank()) add(pkg)
          }
        }
      }
    } catch (_: Exception) {
      emptySet()
    }
  }

  fun isEnabled(context: Context): Boolean =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false)

  fun mode(context: Context): String =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_MODE, "alarm") ?: "alarm"

  fun vibrate(context: Context): Boolean =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_VIBRATE, true)

  fun delayMinutes(context: Context): Int =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt(KEY_DELAY_MIN, 1).coerceAtLeast(1)

  fun delayMs(context: Context): Long = delayMinutes(context) * 60_000L

  fun watchedPackages(context: Context): Set<String> =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getStringSet(KEY_PACKAGES, emptySet()) ?: emptySet()

  fun isWatched(context: Context, packageName: String): Boolean {
    if (!isEnabled(context)) return false
    val watched = watchedPackages(context)
    if (watched.isEmpty()) return false
    return watched.contains(packageName)
  }
}
