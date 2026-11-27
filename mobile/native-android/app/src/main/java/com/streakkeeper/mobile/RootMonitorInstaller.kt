package com.streakkeeper.mobile

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import java.io.File

object RootMonitorInstaller {
  fun isSuAvailable(): Boolean = SuRunner.isSuAvailable()

  fun isInstalled(): Boolean =
    SuRunner.suOutput("[ -r '${RootMonitorConfig.SCRIPT_PATH}' ] && echo 1").trim() == "1"

  fun isDaemonAlive(): Boolean =
    SuRunner.suOk(
      """
      [ -f '${RootMonitorConfig.PID_PATH}' ] &&
      kill -0 ${'$'}(cat '${RootMonitorConfig.PID_PATH}') 2>/dev/null
      """.trimIndent(),
    )

  fun apply(context: Context): Boolean {
    if (!SuRunner.isSuAvailable()) return false
    return try {
      if (!RootMonitorConfig.export(context)) return false
      if (!pushScript(context)) return false
      val ok = startDaemon()
      if (ok) {
        // Standalone Magisk script handles tray monitoring outside the app process;
        // unbind NotificationListenerService so system_server doesn't pin Veyon in RAM 24/7.
        setListenerComponentEnabled(context, false)
      }
      ok
    } catch (_: Exception) {
      false
    }
  }

  fun install(context: Context): Boolean = apply(context)

  fun uninstall(context: Context? = null): Boolean {
    if (!SuRunner.isSuAvailable()) return false
    val cmd =
      """
      ${killExistingCmd()}
      rm -f '${RootMonitorConfig.SCRIPT_PATH}' '${RootMonitorConfig.PID_PATH}' \
        '${RootMonitorConfig.STATE_PATH}' '${RootMonitorConfig.CONF_PATH}'
      """.trimIndent()
    val ok = SuRunner.suOk(cmd)
    if (ok && context != null) {
      setListenerComponentEnabled(context, true)
    }
    return ok
  }

  private fun setListenerComponentEnabled(context: Context, enabled: Boolean) {
    try {
      val pm = context.packageManager
      val cn = ComponentName(context, FiverrNotificationListener::class.java)
      val want = if (enabled) {
        PackageManager.COMPONENT_ENABLED_STATE_ENABLED
      } else {
        PackageManager.COMPONENT_ENABLED_STATE_DISABLED
      }
      if (pm.getComponentEnabledSetting(cn) != want) {
        pm.setComponentEnabledSetting(cn, want, PackageManager.DONT_KILL_APP)
      }
    } catch (_: Exception) {
      // ignore
    }
  }

  fun statusJson(): String {
    val raw = SuRunner.suOutput(
      """
      id_out=${'$'}(id 2>/dev/null)
      case "${'$'}id_out" in *uid=0*) ;; *) echo "__NO_SU__"; exit 0 ;; esac
      inst=0; [ -r '${RootMonitorConfig.SCRIPT_PATH}' ] && inst=1
      pid=${'$'}(cat '${RootMonitorConfig.PID_PATH}' 2>/dev/null)
      run=0; [ -n "${'$'}pid" ] && kill -0 "${'$'}pid" 2>/dev/null && run=1
      echo "__INST__=${'$'}inst"
      echo "__RUN__=${'$'}run"
      echo "__PID__=${'$'}pid"
      cat '${RootMonitorConfig.STATE_PATH}' 2>/dev/null || true
      """.trimIndent(),
    )
    if (raw.contains("__NO_SU__") || raw.isBlank()) {
      return """{"installed":false,"running":false,"confirmed":false,"pid":"","status":"no_su","enabled":false,"heartbeat":0,"heartbeatAgeSec":-1,"watched":[],"activeMatches":0,"lastFiredPkg":"","lastFiredAt":0}"""
    }
    val kv = HashMap<String, String>()
    for (line in raw.lines()) {
      val idx = line.indexOf('=')
      if (idx > 0) kv[line.substring(0, idx).trim()] = line.substring(idx + 1).trim()
    }
    val installed = kv["__INST__"] == "1"
    val running = kv["__RUN__"] == "1"
    val pid = kv["__PID__"].orEmpty()
    val status = kv["status"] ?: if (running) "starting" else "stopped"
    val enabled = kv["enabled"] == "1"
    val heartbeat = kv["heartbeat"]?.toLongOrNull() ?: 0L
    val nowSec = System.currentTimeMillis() / 1000L
    val heartbeatAgeSec = if (heartbeat > 0L) (nowSec - heartbeat).coerceAtLeast(0L) else -1L
    val watchedRaw = kv["watched"].orEmpty()
    val watchedJson = watchedRaw
      .split(',')
      .map { it.trim() }
      .filter { it.isNotEmpty() }
      .joinToString(",") { jsonStr(it) }
    val activeMatches = kv["active_matches"]?.toIntOrNull() ?: 0
    val lastFiredPkg = kv["last_fired_pkg"].orEmpty()
    val lastFiredAt = kv["last_fired_at"]?.toLongOrNull() ?: 0L
    val confirmed = installed && running && heartbeatAgeSec in 0L..45L

    return """{"installed":$installed,"running":$running,"confirmed":$confirmed,"pid":${jsonStr(pid)},"status":${jsonStr(status)},"enabled":$enabled,"heartbeat":$heartbeat,"heartbeatAgeSec":$heartbeatAgeSec,"watched":[$watchedJson],"activeMatches":$activeMatches,"lastFiredPkg":${jsonStr(lastFiredPkg)},"lastFiredAt":$lastFiredAt}"""
  }

  private fun pushScript(context: Context): Boolean {
    val asset = context.assets.open("veyon-unread-alerts.sh")
    val tmp = File(context.cacheDir, "veyon-unread-alerts.sh")
    tmp.outputStream().use { out -> asset.copyTo(out) }
    asset.close()
    val script = tmp.absolutePath.replace("'", "'\\''")
    val cmd =
      """
      mkdir -p /data/adb/service.d /data/local/tmp /data/local/tmp/veyon-alert-state &&
      cp '$script' '${RootMonitorConfig.SCRIPT_PATH}' &&
      chmod 755 '${RootMonitorConfig.SCRIPT_PATH}'
      """.trimIndent()
    return SuRunner.suOk(cmd)
  }

  private fun killExistingCmd(): String =
    """
    if [ -f '${RootMonitorConfig.PID_PATH}' ]; then
      old=${'$'}(cat '${RootMonitorConfig.PID_PATH}' 2>/dev/null)
      [ -n "${'$'}old" ] && kill "${'$'}old" 2>/dev/null || true
    fi
    for pid in ${'$'}(ps -ef 2>/dev/null | awk -v s='${RootMonitorConfig.SCRIPT_PATH}' '${'$'}0 ~ s && ${'$'}0 !~ /-c / && ${'$'}0 !~ /awk/ {print ${'$'}2}'); do
      [ "${'$'}pid" = "${'$'}${'$'}" ] || [ "${'$'}pid" = "${'$'}PPID" ] || kill "${'$'}pid" 2>/dev/null || true
    done
    """.trimIndent()

  private fun startDaemon(): Boolean {
    val cmd =
      """
      ${killExistingCmd()}
      sleep 1
      rm -f '${RootMonitorConfig.PID_PATH}' '${RootMonitorConfig.STATE_PATH}'
      setsid sh '${RootMonitorConfig.SCRIPT_PATH}' </dev/null >>/data/local/tmp/veyon-alerts.log 2>&1 &
      for _ in 1 2 3 4 5 6; do
        sleep 1
        if [ -f '${RootMonitorConfig.PID_PATH}' ] &&
          kill -0 ${'$'}(cat '${RootMonitorConfig.PID_PATH}') 2>/dev/null &&
          [ -s '${RootMonitorConfig.STATE_PATH}' ]; then
          exit 0
        fi
      done
      exit 1
      """.trimIndent()
    return SuRunner.suOk(cmd)
  }

  private fun jsonStr(s: String): String {
    val esc = s.replace("\\", "\\\\").replace("\"", "\\\"")
    return "\"$esc\""
  }
}
