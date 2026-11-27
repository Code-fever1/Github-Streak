package com.streakkeeper.mobile

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

object StreakWakeScheduler {
  private const val PREFS = "streak_keeper"
  private const val KEY_NEXT_WAKE_MS = "next_wake_at_ms"
  private const val REQUEST_CODE = 9

  fun nextWakeAt(context: Context): Long =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_NEXT_WAKE_MS, 0L)

  fun scheduleAt(context: Context, triggerAtMs: Long) {
    val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pi = PendingIntent.getBroadcast(
      context,
      REQUEST_CODE,
      Intent(context, KeeperWakeReceiver::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    if (triggerAtMs <= 0L) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit()
        .remove(KEY_NEXT_WAKE_MS)
        .apply()
      alarm.cancel(pi)
      pi.cancel()
      return
    }

    val whenMs = maxOf(triggerAtMs, System.currentTimeMillis() + 15_000L)
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putLong(KEY_NEXT_WAKE_MS, whenMs)
      .apply()

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenMs, pi)
      } else {
        alarm.setExact(AlarmManager.RTC_WAKEUP, whenMs, pi)
      }
    } catch (_: SecurityException) {
      alarm.set(AlarmManager.RTC_WAKEUP, whenMs, pi)
    }
  }

  fun rescheduleSaved(context: Context) {
    val saved = nextWakeAt(context)
    if (saved <= 0L) return
    scheduleAt(context, maxOf(saved, System.currentTimeMillis() + 30_000L))
  }
}
