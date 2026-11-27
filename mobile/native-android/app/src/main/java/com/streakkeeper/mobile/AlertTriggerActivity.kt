package com.streakkeeper.mobile

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper

/** Started by the root monitor script when the app process is dead. */
class AlertTriggerActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val mode = intent?.getStringExtra("mode") ?: NotificationAlertPrefs.mode(this)
    val vibrate = intent?.getBooleanExtra("vibrate", NotificationAlertPrefs.vibrate(this)) ?: true
    val fromRoot = intent?.getStringExtra("source") == "root_monitor"
    FiverrAlerter.play(this, mode, vibrate) {
      if (fromRoot && !MainActivity.isForeground && !KeeperService.running) {
        Handler(Looper.getMainLooper()).postDelayed({
          if (!MainActivity.isForeground && !KeeperService.running) {
            android.os.Process.killProcess(android.os.Process.myPid())
          }
        }, 1_000L)
      }
    }
    finish()
  }
}
