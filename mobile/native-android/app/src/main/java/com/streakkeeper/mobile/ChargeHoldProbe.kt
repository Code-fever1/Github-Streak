package com.streakkeeper.mobile

object ChargeHoldProbe {
  private val CANDIDATES = listOf(
    "/sys/class/power_supply/battery/charging_enabled",
    "/sys/class/power_supply/battery/battery_charging_enabled",
    "/sys/class/power_supply/battery/batt_slate_mode",
    "/sys/class/power_supply/battery/store_mode",
    "/sys/class/power_supply/battery/charge_uno_control",
    "/sys/class/power_supply/battery/input_suspend",
    "/sys/class/power_supply/battery/charge_control_limit",
  )

  fun probeJson(): String {
    if (!SuRunner.isSuAvailable()) {
      return """{"su":false,"nodes":[]}"""
    }
    val found = LinkedHashSet<String>()
    for (path in CANDIDATES) {
      if (SuRunner.suOutput("[ -e '$path' ] && echo ok").contains("ok")) {
        found.add(path)
      }
    }
    val extra =
      SuRunner.suOutput(
        "find /sys/class/power_supply/battery /sys/devices -maxdepth 6 " +
          "-name 'charging_enabled' -o -name 'battery_charging_enabled' 2>/dev/null | head -20",
      )
    for (line in extra.lines()) {
      val t = line.trim()
      if (t.isNotEmpty()) found.add(t)
    }
    val nodes = found.map { path ->
      val writable =
        SuRunner.suOutput("[ -w '$path' ] && echo w").contains("w")
      val value = SuRunner.suOutput("cat '$path' 2>/dev/null").lines().firstOrNull()?.trim() ?: ""
      """{"path":${jsonStr(path)},"writable":$writable,"value":${jsonStr(value)}}"""
    }
    return """{"su":true,"nodes":[${nodes.joinToString(",")}]}"""
  }

  fun statusJson(): String {
    val raw = SuRunner.suOutput(
      """
      bat=${'$'}(dumpsys battery 2>/dev/null)
      lvl=${'$'}(printf '%s\n' "${'$'}bat" | sed -n 's/^  level: \([0-9]*\).*/\1/p' | head -1)
      st=${'$'}(printf '%s\n' "${'$'}bat" | sed -n 's/^  status: \([0-9]*\).*/\1/p' | head -1)
      ac=${'$'}(cat /sys/class/power_supply/ac/online 2>/dev/null)
      usb=${'$'}(cat /sys/class/power_supply/usb/online 2>/dev/null)
      sw=${'$'}(grep '^charge_switch=' '${ChargeHoldConfig.CONF_PATH}' 2>/dev/null | cut -d= -f2-)
      inst=0; [ -r '${ChargeHoldConfig.SCRIPT_PATH}' ] && inst=1
      pid=${'$'}(cat /data/local/tmp/veyon-charge.pid 2>/dev/null)
      run=0; [ -n "${'$'}pid" ] && kill -0 "${'$'}pid" 2>/dev/null && run=1
      dstate=${'$'}(cat '${ChargeHoldConfig.STATE_PATH}' 2>/dev/null)
      ce=${'$'}(grep '^enabled=' '${ChargeHoldConfig.CONF_PATH}' 2>/dev/null | cut -d= -f2)
      printf 'level=%s\nstatus=%s\nac=%s\nusb=%s\nsw=%s\ninst=%s\npid=%s\nrun=%s\ndstate=%s\nce=%s\n' \
        "${'$'}lvl" "${'$'}st" "${'$'}ac" "${'$'}usb" "${'$'}sw" "${'$'}inst" "${'$'}pid" "${'$'}run" "${'$'}dstate" "${'$'}ce"
      """.trimIndent(),
    )
    val kv = HashMap<String, String>()
    for (line in raw.lines()) {
      val idx = line.indexOf('=')
      if (idx > 0) kv[line.substring(0, idx).trim()] = line.substring(idx + 1).trim()
    }
    val level = kv["level"].orEmpty()
    val status = kv["status"].orEmpty()
    val ac = kv["ac"].orEmpty().ifEmpty { "0" }
    val usb = kv["usb"].orEmpty().ifEmpty { "0" }
    val switchPath = kv["sw"].orEmpty()
    val installed = if (kv["inst"] == "1") "1" else "0"
    val running = if (kv["run"] == "1") "1" else "0"
    val pid = kv["pid"].orEmpty()
    val state = kv["dstate"].orEmpty()
    val confEnabled = kv["ce"].orEmpty()
    return """{"installed":$installed,"running":${jsonStr(running)},"pid":${jsonStr(pid)},"enabled":${jsonStr(confEnabled)},"level":${jsonStr(level)},"plugged_ac":${jsonStr(ac)},"plugged_usb":${jsonStr(usb)},"status":${jsonStr(status)},"charge_switch":${jsonStr(switchPath)},"switch_value":"","daemon_state":${jsonStr(state)}}"""
  }

  private fun jsonStr(s: String): String {
    val esc = s.replace("\\", "\\\\").replace("\"", "\\\"")
    return "\"$esc\""
  }
}
