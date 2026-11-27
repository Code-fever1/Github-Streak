package com.streakkeeper.mobile

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class KeeperHeadlessService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig {
    return HeadlessJsTaskConfig(
      "StreakKeeperTask",
      Arguments.createMap(),
      15 * 60 * 1000,
      true,
    )
  }
}
