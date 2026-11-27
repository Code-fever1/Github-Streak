#!/system/bin/sh
# Charge window for the Galaxy S8+ (dream2lte / MAX77865).
# batt_slate_mode=1 stops charging by dropping the charger path, so the phone
# then runs on the battery. This chip has no cord-power bypass that holds the
# percentage still. A wide upper/lower window, latched across two polls, stops
# the start/stop chatter caused by the fuel gauge jumping when slate toggles.
CONFIG=/data/local/tmp/veyon-charge.conf
STATE=/data/local/tmp/veyon-charge.state
HBFILE=/data/local/tmp/veyon-charge.hb
PIDFILE=/data/local/tmp/veyon-charge.pid
MODEFILE=/data/local/tmp/veyon-charge.mode
PENDING=/data/local/tmp/veyon-charge.pending
PAUSED_CC=/data/local/tmp/veyon-paused-cc
CC_CFG=/data/adb/modules/ChargeControlCC/config
SLATE=/sys/class/power_supply/battery/batt_slate_mode
LIMIT=/sys/class/power_supply/battery/batt_tune_chg_limit_cur
INPUT=/sys/class/power_supply/battery/batt_tune_input_charge_current
POLL_DEFAULT=10
MIN_GAP=8

mkdir -p /data/local/tmp
echo $$ >"$PIDFILE"
chmod 644 "$PIDFILE" 2>/dev/null || true

LAST_SIG=""

log_state() {
  echo "$1" >"$STATE"
  date +%s >"$HBFILE" 2>/dev/null || true
  chmod 644 "$STATE" "$HBFILE" 2>/dev/null || true
}

cfg_get() {
  grep "^$1=" "$CONFIG" 2>/dev/null | head -1 | cut -d= -f2-
}

battery_level() {
  dumpsys battery 2>/dev/null | sed -n 's/^  level: \([0-9]*\).*/\1/p' | head -1
}

plugged_in() {
  ac=$(cat /sys/class/power_supply/ac/online 2>/dev/null)
  usb=$(cat /sys/class/power_supply/usb/online 2>/dev/null)
  wl=$(cat /sys/class/power_supply/wireless/online 2>/dev/null)
  slate=$(cat "$SLATE" 2>/dev/null)
  # Slate drops usb/ac online, so a hold must still count as plugged in.
  [ "$ac" = "1" ] || [ "$usb" = "1" ] || [ "$wl" = "1" ] || [ "$slate" = "1" ]
}

pause_other_controllers() {
  if [ -f "$CC_CFG" ] && grep -q '^automation=true' "$CC_CFG"; then
    sed -i 's/^automation=true/automation=false/' "$CC_CFG"
    echo 1 >"$PAUSED_CC"
  fi
  if [ -f /data/adb/modules/ChargeControlCC/chargecontrold.pid ]; then
    cpid=$(cat /data/adb/modules/ChargeControlCC/chargecontrold.pid 2>/dev/null)
    [ -n "$cpid" ] && kill "$cpid" 2>/dev/null || true
  fi
}

resume_other_controllers() {
  if [ -f "$PAUSED_CC" ] && [ -f "$CC_CFG" ]; then
    sed -i 's/^automation=false/automation=true/' "$CC_CFG"
    rm -f "$PAUSED_CC"
    if [ -f /data/adb/modules/ChargeControlCC/service.sh ]; then
      sh /data/adb/modules/ChargeControlCC/service.sh >/dev/null 2>&1 &
    fi
  fi
}

apply_charge() {
  echo 0 >"$SLATE" 2>/dev/null || true
  echo 1500 >"$LIMIT" 2>/dev/null || true
  echo 1800 >"$INPUT" 2>/dev/null || true
  echo charge >"$MODEFILE"
  rm -f "$PENDING"
}

apply_hold() {
  echo 1 >"$SLATE" 2>/dev/null || true
  echo hold >"$MODEFILE"
  rm -f "$PENDING"
}

while true; do
  if [ ! -f "$CONFIG" ]; then
    log_state "no_config"
    sleep 5
    continue
  fi

  cur_sig=$(cksum "$CONFIG" 2>/dev/null)
  if [ "$cur_sig" != "$LAST_SIG" ]; then
    LAST_SIG="$cur_sig"
    rm -f "$PENDING"
  fi

  enabled=$(cfg_get enabled)
  upper=$(cfg_get cap)
  lower=$(cfg_get lower)
  resume=$(cfg_get resume_delta)
  poll=$(cfg_get poll_sec)
  [ -n "$upper" ] || upper=80
  [ -n "$resume" ] || resume=$MIN_GAP
  [ "$resume" -lt "$MIN_GAP" ] && resume=$MIN_GAP
  [ -n "$lower" ] || lower=$((upper - resume))
  [ "$lower" -lt 20 ] && lower=20
  if [ "$lower" -gt $((upper - MIN_GAP)) ]; then
    lower=$((upper - MIN_GAP))
  fi
  [ -n "$poll" ] || poll=$POLL_DEFAULT
  [ "$poll" -lt 5 ] && poll=5

  if [ "$enabled" != "1" ]; then
    log_state "off"
    apply_charge
    resume_other_controllers
    sleep "$poll"
    continue
  fi

  pause_other_controllers

  if ! plugged_in; then
    log_state "unplugged"
    apply_charge
    sleep "$poll"
    continue
  fi

  level=$(battery_level)
  [ -n "$level" ] || level=0
  mode=$(cat "$MODEFILE" 2>/dev/null)
  [ "$mode" = "hold" ] || mode=charge

  if [ "$level" -ge "$upper" ]; then
    want=hold
  elif [ "$level" -le "$lower" ]; then
    want=charge
  else
    want=$mode
  fi

  if [ "$want" != "$mode" ]; then
    pending=$(cat "$PENDING" 2>/dev/null)
    if [ "$pending" = "$want" ]; then
      if [ "$want" = "hold" ]; then
        apply_hold
      else
        apply_charge
      fi
      log_state "$want upper=$upper lower=$lower level=$level"
    else
      echo "$want" >"$PENDING"
      log_state "pending $want upper=$upper lower=$lower level=$level"
    fi
  else
    rm -f "$PENDING"
    if [ "$mode" = "hold" ]; then
      cur=$(cat "$SLATE" 2>/dev/null)
      [ "$cur" = "1" ] || echo 1 >"$SLATE" 2>/dev/null || true
    else
      cur=$(cat "$SLATE" 2>/dev/null)
      [ "$cur" = "0" ] || echo 0 >"$SLATE" 2>/dev/null || true
    fi
    log_state "$mode upper=$upper lower=$lower level=$level"
  fi

  sleep "$poll"
done
