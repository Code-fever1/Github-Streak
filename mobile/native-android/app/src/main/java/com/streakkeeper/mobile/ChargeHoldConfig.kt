package com.streakkeeper.mobile

import android.content.Context
import java.io.File

object ChargeHoldConfig {
  const val CONF_PATH = "/data/local/tmp/veyon-charge.conf"
  const val SCRIPT_PATH = "/data/adb/service.d/veyon-charge-hold.sh"
  const val STATE_PATH = "/data/local/tmp/veyon-charge.state"
  private const val PREFS = "veyon_charge_hold"

  fun setConfig(
    context: Context,
    enabled: Boolean,
    cap: Int,
    lower: Int,
    pollSec: Int,
    chargeSwitch: String,
  ) {
    val upper = cap.coerceIn(30, 100)
    val start = lower.coerceIn(20, upper - 8)
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putBoolean("enabled", enabled)
      .putInt("cap", upper)
      .putInt("lower", start)
      .putInt("resume_delta", (upper - start).coerceIn(8, 40))
      .putInt("poll_sec", pollSec)
      .putString("charge_switch", chargeSwitch)
      .apply()
    export(context)
  }

  fun enabled(context: Context): Boolean =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("enabled", false)

  fun cap(context: Context): Int =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt("cap", 80)

  fun lower(context: Context): Int {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val upper = prefs.getInt("cap", 80).coerceIn(30, 100)
    val stored = if (prefs.contains("lower")) prefs.getInt("lower", upper - 10) else upper - 10
    return stored.coerceIn(20, upper - 8)
  }

  fun resumeDelta(context: Context): Int =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt("resume_delta", 10)

  fun pollSec(context: Context): Int =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt("poll_sec", 15)

  fun chargeSwitch(context: Context): String =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("charge_switch", "auto")
      ?: "auto"

  fun export(context: Context): Boolean {
    val sw = chargeSwitch(context)
    val upper = cap(context).coerceIn(30, 100)
    val start = lower(context)
    val lines = buildString {
      append("enabled=").append(if (enabled(context)) 1 else 0).append('\n')
      append("cap=").append(upper).append('\n')
      append("lower=").append(start).append('\n')
      append("resume_delta=").append((upper - start).coerceIn(8, 40)).append('\n')
      append("poll_sec=").append(pollSec(context).coerceIn(5, 120)).append('\n')
      append("charge_switch=").append(sw).append('\n')
    }
    try {
      val file = File(CONF_PATH)
      file.writeText(lines)
      file.setReadable(true, false)
      file.setWritable(true, false)
    } catch (_: Exception) {
      // Root daemon may still read via su copy.
    }
    return SuRunner.suOk(
      """
      mkdir -p /data/local/tmp &&
      cat > $CONF_PATH <<'VEYON_EOF'
$lines
VEYON_EOF
      chmod 644 $CONF_PATH &&
      test -s $CONF_PATH
      """.trimIndent(),
    )
  }
}
