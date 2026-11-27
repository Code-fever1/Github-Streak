package com.streakkeeper.mobile

import android.content.Context

object FiverrAlertPrefs {
  private const val PREFS = "streak_keeper"
  private const val KEY_ENABLED = "fiverr_alert_enabled"
  private const val KEY_MODE = "fiverr_alert_mode"
  private const val KEY_VIBRATE = "fiverr_alert_vibrate"

  fun setConfig(context: Context, enabled: Boolean, mode: String, vibrate: Boolean) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_ENABLED, enabled)
      .putString(KEY_MODE, mode)
      .putBoolean(KEY_VIBRATE, vibrate)
      .apply()
  }

  fun isEnabled(context: Context): Boolean =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false)

  fun mode(context: Context): String =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_MODE, "alarm") ?: "alarm"

  fun vibrate(context: Context): Boolean =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_VIBRATE, true)
}
