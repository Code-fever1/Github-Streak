package com.streakkeeper.mobile

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class FiverrNotificationListener : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    if (!NotificationAlertPrefs.isWatched(this, sbn.packageName)) return
    val appCtx = applicationContext
    Thread {
      if (RootMonitorInstaller.isDaemonAlive()) return@Thread
      NotificationDelayScheduler.schedule(this, sbn)
    }.start()
  }

  override fun onNotificationRemoved(
    sbn: StatusBarNotification,
    rankingMap: NotificationListenerService.RankingMap,
    reason: Int,
  ) {
    NotificationDelayScheduler.cancel(sbn.key)
  }
}
