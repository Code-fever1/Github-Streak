package com.streakkeeper.mobile

import android.content.Context
import java.io.File

object RootMonitorConfig {
  const val CONF_PATH = "/data/local/tmp/veyon-alerts.conf"
  const val SCRIPT_PATH = "/data/adb/service.d/veyon-unread-alerts.sh"
  const val PID_PATH = "/data/local/tmp/veyon-alerts.pid"
  const val STATE_PATH = "/data/local/tmp/veyon-alerts.state"

  fun export(context: Context): Boolean {
    val pkgs = NotificationAlertPrefs.watchedPackages(context)
    val lines = buildString {
      append("enabled=").append(if (NotificationAlertPrefs.isEnabled(context)) 1 else 0).append('\n')
      append("delay_minutes=").append(NotificationAlertPrefs.delayMinutes(context)).append('\n')
      append("mode=").append(NotificationAlertPrefs.mode(context)).append('\n')
      append("vibrate=").append(if (NotificationAlertPrefs.vibrate(context)) 1 else 0).append('\n')
      append("package=").append(context.packageName).append('\n')
      for (p in pkgs) append("watch_pkg=").append(p).append('\n')
    }
    try {
      val file = File(CONF_PATH)
      file.writeText(lines)
      file.setReadable(true, false)
      file.setWritable(true, false)
    } catch (_: Exception) {
      // SELinux may block direct app write; fallback to su below.
    }
    if (!SuRunner.isSuAvailable()) return false
    return SuRunner.suOk(
      """
      mkdir -p /data/local/tmp /data/local/tmp/veyon-alert-state &&
      cat > $CONF_PATH <<'VEYON_EOF'
$lines
VEYON_EOF
      chmod 644 $CONF_PATH &&
      test -s $CONF_PATH
      """.trimIndent(),
    )
  }
}
