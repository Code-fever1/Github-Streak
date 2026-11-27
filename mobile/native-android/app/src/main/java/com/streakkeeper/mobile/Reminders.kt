package com.streakkeeper.mobile

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

object CommitDay {
  private const val PREFS = "streak_keeper"
  private const val KEY = "commit_day"

  fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

  fun markToday(context: Context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY, today())
      .apply()
  }

  fun committedToday(context: Context): Boolean {
    val saved = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "")
    return saved == today()
  }
}

object ReminderAlarms {
  private val hours = intArrayOf(12, 18, 23)

  fun scheduleNext(context: Context) {
    val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val whenMs = nextSlotMillis()
    val pi = PendingIntent.getBroadcast(
      context,
      7,
      Intent(context, KeeperReminderReceiver::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
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

  private fun nextSlotMillis(): Long {
    val now = System.currentTimeMillis()
    for (hour in hours) {
      val cal = Calendar.getInstance()
      cal.set(Calendar.HOUR_OF_DAY, hour)
      cal.set(Calendar.MINUTE, 0)
      cal.set(Calendar.SECOND, 5)
      cal.set(Calendar.MILLISECOND, 0)
      if (cal.timeInMillis > now + 15_000) return cal.timeInMillis
    }
    val tomorrow = Calendar.getInstance()
    tomorrow.add(Calendar.DAY_OF_YEAR, 1)
    tomorrow.set(Calendar.HOUR_OF_DAY, hours[0])
    tomorrow.set(Calendar.MINUTE, 0)
    tomorrow.set(Calendar.SECOND, 5)
    tomorrow.set(Calendar.MILLISECOND, 0)
    return tomorrow.timeInMillis
  }
}

object ReminderNotifier {
  const val CHANNEL_ID = "streak_keeper_reminders"
  private const val NOTIFICATION_ID = 43

  fun showIfNeeded(context: Context) {
    if (CommitDay.committedToday(context)) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = context.getSystemService(NotificationManager::class.java)
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Veyon reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
          description = "Reminds you when no commit was sent today"
        },
      )
    }
    val launch = PendingIntent.getActivity(
      context,
      2,
      Intent(context, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setContentTitle("No commits sent today")
      .setContentText("Open Veyon and send today’s commits.")
      .setStyle(NotificationCompat.BigTextStyle().bigText("Nothing was uploaded today. Send a commit to keep the streak."))
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentIntent(launch)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .build()
    val nm = context.getSystemService(NotificationManager::class.java)
    nm.notify(NOTIFICATION_ID, notification)
  }
}
