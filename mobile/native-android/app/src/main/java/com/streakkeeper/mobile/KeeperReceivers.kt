package com.streakkeeper.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.facebook.react.HeadlessJsTaskService

class KeeperBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action ?: return
    if (
      action == Intent.ACTION_BOOT_COMPLETED ||
      action == Intent.ACTION_LOCKED_BOOT_COMPLETED ||
      action == Intent.ACTION_MY_PACKAGE_REPLACED
    ) {
      ReminderAlarms.scheduleNext(context)
      StreakWakeScheduler.rescheduleSaved(context)
    }
  }
}

class KeeperReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    ReminderNotifier.showIfNeeded(context)
    ReminderAlarms.scheduleNext(context)
  }
}

class KeeperWakeReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    Log.i("StreakKeeperNative", "KeeperWakeReceiver triggered; starting one-shot sync")
    HeadlessJsTaskService.acquireWakeLockNow(context)
    KeeperService.startOneShotWake(context)
  }
}
