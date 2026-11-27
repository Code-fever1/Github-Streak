#!/system/bin/sh
# Runs from Magisk /data/adb/service.d when installed from Veyon (root).
CONFIG=/data/local/tmp/veyon-alerts.conf
PIDFILE=/data/local/tmp/veyon-alerts.pid
STATE_FILE=/data/local/tmp/veyon-alerts.state
STATE_TMP=/data/local/tmp/veyon-alerts.state.tmp
STATE_DIR=/data/local/tmp/veyon-alert-state
NOTIF_LINES=/data/local/tmp/veyon-notif-lines
ACTIVE=/data/local/tmp/veyon-active-keys
POLL_ON=15
POLL_OFF=30

mkdir -p "$STATE_DIR" /data/local/tmp
echo $$ >"$PIDFILE"
chmod 644 "$PIDFILE" 2>/dev/null || true

LAST_FIRED_PKG=""
LAST_FIRED_AT=0

now_sec() {
  date +%s 2>/dev/null || echo 0
}

now_ms() {
  ts=$(date +%s%3N 2>/dev/null)
  case "$ts" in
    *[!0-9]*|"") echo $(($(now_sec) * 1000)) ;;
    *) echo "$ts" ;;
  esac
}

cfg_get() {
  grep "^$1=" "$CONFIG" 2>/dev/null | head -1 | cut -d= -f2-
}

watched_csv() {
  grep '^watch_pkg=' "$CONFIG" 2>/dev/null | cut -d= -f2- | tr '\n' ',' | sed 's/,$//'
}

watch_pkg() {
  grep -qx "watch_pkg=${1}" "$CONFIG" 2>/dev/null
}

hash_key() {
  h=$(printf '%s' "$1" | md5sum 2>/dev/null | awk '{print $1}')
  if [ -z "$h" ]; then
    h=$(printf '%s' "$1" | cksum 2>/dev/null | awk '{print $1}')
  fi
  echo "$h"
}

write_state() {
  hb=$(now_sec)
  cat >"$STATE_TMP" <<EOF
pid=$$
status=$1
enabled=$2
heartbeat=$hb
delay_minutes=$3
mode=$4
vibrate=$5
watched=$6
active_matches=$7
last_fired_pkg=$LAST_FIRED_PKG
last_fired_at=$LAST_FIRED_AT
EOF
  chmod 644 "$STATE_TMP" 2>/dev/null || true
  mv -f "$STATE_TMP" "$STATE_FILE" 2>/dev/null || true
}

while true; do
  if [ ! -f "$CONFIG" ]; then
    write_state "no_config" "0" "1" "alarm" "1" "" "0"
    sleep "$POLL_OFF"
    continue
  fi

  enabled=$(cfg_get enabled)
  delay_min=$(cfg_get delay_minutes)
  mode=$(cfg_get mode)
  vibrate=$(cfg_get vibrate)
  app_pkg=$(cfg_get package)
  watched=$(watched_csv)
  [ -n "$enabled" ] || enabled=0
  [ -n "$delay_min" ] || delay_min=1
  [ -n "$mode" ] || mode=alarm
  [ -n "$vibrate" ] || vibrate=1
  [ -n "$app_pkg" ] || app_pkg=com.streakkeeper.mobile

  if [ "$enabled" != "1" ]; then
    rm -f "$STATE_DIR"/*.seen "$STATE_DIR"/*.fired 2>/dev/null || true
    write_state "disabled" "0" "$delay_min" "$mode" "$vibrate" "$watched" "0"
    sleep "$POLL_OFF"
    continue
  fi

  delay_ms=$((delay_min * 60 * 1000))
  now=$(now_ms)
  matches=0

  dumpsys notification 2>/dev/null | awk '/^  Notification List:/{on=1;next} /^  [^ ]/{if(on) exit} on && /NotificationRecord/{print}' >"$NOTIF_LINES" || : >"$NOTIF_LINES"
  : >"$ACTIVE"

  while IFS= read -r line; do
    [ -n "$line" ] || continue
    case "$line" in
      *ONGOING_EVENT*) continue ;;
    esac
    pkg=$(printf '%s\n' "$line" | sed -n 's/.*pkg=\([^ ]*\).*/\1/p')
    [ -n "$pkg" ] || continue
    watch_pkg "$pkg" || continue

    raw_key=$(printf '%s\n' "$line" | sed -n 's/.*key=\(.*\): Notification(.*/\1/p')
    [ -n "$raw_key" ] || raw_key=$(printf '%s\n' "$line" | sed -n 's/.*key=\([^ ]*\).*/\1/p')
    [ -n "$raw_key" ] || continue
    key=$(hash_key "$raw_key")
    [ -n "$key" ] || continue

    matches=$((matches + 1))
    echo "$key" >>"$ACTIVE"
    seen="$STATE_DIR/${key}.seen"
    fired="$STATE_DIR/${key}.fired"
    if [ ! -f "$seen" ]; then
      echo "$now" >"$seen"
      continue
    fi
    [ -f "$fired" ] && continue
    start_ms=$(cat "$seen" 2>/dev/null)
    [ -n "$start_ms" ] || continue
    age=$((now - start_ms))
    if [ "$age" -ge "$delay_ms" ]; then
      touch "$fired"
      LAST_FIRED_PKG="$pkg"
      LAST_FIRED_AT=$(now_sec)
      write_state "watching" "1" "$delay_min" "$mode" "$vibrate" "$watched" "$matches"
      vib_bool=false
      [ "$vibrate" = "1" ] && vib_bool=true
      am start -n "${app_pkg}/.AlertTriggerActivity" --es mode "$mode" --ez vibrate "$vib_bool" --es source "root_monitor" --es trigger_pkg "$pkg" >/dev/null 2>&1 || true
    fi
  done <"$NOTIF_LINES"

  for f in "$STATE_DIR"/*.seen; do
    [ -f "$f" ] || continue
    k=$(basename "$f" .seen)
    if ! grep -qx "$k" "$ACTIVE" 2>/dev/null; then
      rm -f "$STATE_DIR/${k}.seen" "$STATE_DIR/${k}.fired"
    fi
  done

  write_state "watching" "1" "$delay_min" "$mode" "$vibrate" "$watched" "$matches"
  sleep "$POLL_ON"
done
