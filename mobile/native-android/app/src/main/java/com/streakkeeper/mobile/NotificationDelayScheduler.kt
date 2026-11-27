package com.streakkeeper.mobile

import android.os.Handler
import android.os.Looper
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.util.concurrent.ConcurrentHashMap

object NotificationDelayScheduler {
  private val handler = Handler(Looper.getMainLooper())
  private val pending = ConcurrentHashMap<String, Runnable>()

  fun schedule(service: NotificationListenerService, sbn: StatusBarNotification) {
    val key = sbn.key
    cancel(key)
    val delay = NotificationAlertPrefs.delayMs(service)
    val runnable = Runnable {
      pending.remove(key)
      if (!NotificationAlertPrefs.isEnabled(service)) return@Runnable
      if (!NotificationAlertPrefs.isWatched(service, sbn.packageName)) return@Runnable
      val stillUnread = service.activeNotifications?.any { it.key == key } == true
      if (!stillUnread) return@Runnable
      FiverrAlerter.play(
        service,
        NotificationAlertPrefs.mode(service),
        NotificationAlertPrefs.vibrate(service),
      )
    }
    pending[key] = runnable
    handler.postDelayed(runnable, delay)
  }

  fun cancel(key: String) {
    pending.remove(key)?.let { handler.removeCallbacks(it) }
  }

  fun cancelAll() {
    val keys = pending.keys.toList()
    for (key in keys) {
      pending.remove(key)?.let { handler.removeCallbacks(it) }
    }
  }
}
