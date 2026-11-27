package com.streakkeeper.mobile

import android.content.Context

object ChargeHoldInstaller {
  fun isInstalled(): Boolean =
    SuRunner.suOutput("[ -r '${ChargeHoldConfig.SCRIPT_PATH}' ] && echo 1").trim() == "1"

  fun isDaemonAlive(): Boolean =
    SuRunner.suOk(
      """
      [ -f /data/local/tmp/veyon-charge.pid ] &&
      kill -0 ${'$'}(cat /data/local/tmp/veyon-charge.pid) 2>/dev/null
      """.trimIndent(),
    )

  fun apply(context: Context): Boolean {
    if (!SuRunner.isSuAvailable()) return false
    return try {
      if (!ChargeHoldConfig.export(context)) return false
      val scriptChanged = pushScriptIfChanged(context)
      if (!scriptChanged && isDaemonAlive()) return true
      startDaemon()
    } catch (_: Exception) {
      false
    }
  }

  fun install(context: Context): Boolean = apply(context)

  fun uninstall(): Boolean {
    if (!SuRunner.isSuAvailable()) return false
    val cmd =
      """
      ${killExistingCmd()}
      rm -f ${ChargeHoldConfig.SCRIPT_PATH} ${ChargeHoldConfig.STATE_PATH} \
        /data/local/tmp/veyon-charge.pid /data/local/tmp/veyon-charge.hb \
        /data/local/tmp/veyon-charge.mode /data/local/tmp/veyon-charge.pending
      echo 0 > /sys/class/power_supply/battery/batt_slate_mode 2>/dev/null || true
      echo 1500 > /sys/class/power_supply/battery/batt_tune_chg_limit_cur 2>/dev/null || true
      """.trimIndent()
    return SuRunner.suOk(cmd)
  }

  private fun pushScriptIfChanged(context: Context): Boolean {
    val asset = context.assets.open("veyon-charge-hold.sh")
    val tmp = java.io.File(context.cacheDir, "veyon-charge-hold.sh")
    tmp.outputStream().use { out -> asset.copyTo(out) }
    asset.close()
    val script = tmp.absolutePath.replace("'", "'\\''")
    val changed = !SuRunner.suOk("cmp -s '$script' '${ChargeHoldConfig.SCRIPT_PATH}'")
    val cmd =
      """
      mkdir -p /data/adb/service.d /data/local/tmp &&
      cp '$script' '${ChargeHoldConfig.SCRIPT_PATH}' &&
      chmod 755 '${ChargeHoldConfig.SCRIPT_PATH}'
      """.trimIndent()
    SuRunner.suOk(cmd)
    return changed
  }

  private fun killExistingCmd(): String =
    """
    if [ -f /data/local/tmp/veyon-charge.pid ]; then
      old=${'$'}(cat /data/local/tmp/veyon-charge.pid 2>/dev/null)
      [ -n "${'$'}old" ] && kill "${'$'}old" 2>/dev/null || true
    fi
    for pid in ${'$'}(ps -ef 2>/dev/null | awk -v s='${ChargeHoldConfig.SCRIPT_PATH}' '${'$'}0 ~ s && ${'$'}0 !~ /-c / && ${'$'}0 !~ /awk/ {print ${'$'}2}'); do
      [ "${'$'}pid" = "${'$'}${'$'}" ] || [ "${'$'}pid" = "${'$'}PPID" ] || kill "${'$'}pid" 2>/dev/null || true
    done
    """.trimIndent()

  private fun startDaemon(): Boolean {
    val cmd =
      """
      ${killExistingCmd()}
      sleep 1
      rm -f /data/local/tmp/veyon-charge.pid
      setsid sh '${ChargeHoldConfig.SCRIPT_PATH}' </dev/null >>/data/local/tmp/veyon-charge.log 2>&1 &
      for _ in 1 2 3 4 5 6; do
        sleep 1
        if [ -f /data/local/tmp/veyon-charge.pid ] &&
          kill -0 ${'$'}(cat /data/local/tmp/veyon-charge.pid) 2>/dev/null; then
          exit 0
        fi
      done
      exit 1
      """.trimIndent()
    return SuRunner.suOk(cmd)
  }
}
