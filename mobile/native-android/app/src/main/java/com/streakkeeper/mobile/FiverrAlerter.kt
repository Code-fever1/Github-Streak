package com.streakkeeper.mobile

import android.content.Context
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

object FiverrAlerter {
  private var playing: Ringtone? = null
  private val handler = Handler(Looper.getMainLooper())
  private var stopRunnable: Runnable? = null

  @Synchronized
  fun play(context: Context, mode: String, vibrate: Boolean, onDone: (() -> Unit)? = null) {
    stop()
    val app = context.applicationContext
    val type = when (mode) {
      "ringtone" -> RingtoneManager.TYPE_RINGTONE
      "notification" -> RingtoneManager.TYPE_NOTIFICATION
      else -> RingtoneManager.TYPE_ALARM
    }
    val usage = when (mode) {
      "ringtone" -> AudioAttributes.USAGE_NOTIFICATION_RINGTONE
      "notification" -> AudioAttributes.USAGE_NOTIFICATION
      else -> AudioAttributes.USAGE_ALARM
    }
    val uri = RingtoneManager.getDefaultUri(type) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
    val ring = RingtoneManager.getRingtone(app, uri)
    if (ring == null) {
      onDone?.invoke()
      return
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      ring.audioAttributes = AudioAttributes.Builder()
        .setUsage(usage)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
    }
    playing = ring
    ring.play()
    val r = Runnable {
      stop()
      onDone?.invoke()
    }
    stopRunnable = r
    handler.postDelayed(r, 12_000)

    if (vibrate) {
      val vibrator =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          val mgr = app.getSystemService(VibratorManager::class.java)
          mgr?.defaultVibrator
        } else {
          @Suppress("DEPRECATION")
          app.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator?
        }
      if (vibrator != null && vibrator.hasVibrator()) {
        val pattern = longArrayOf(0, 400, 200, 400, 200, 600)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
        } else {
          @Suppress("DEPRECATION")
          vibrator.vibrate(pattern, -1)
        }
      }
    }
  }

  @Synchronized
  fun stop() {
    stopRunnable?.let { handler.removeCallbacks(it) }
    stopRunnable = null
    try {
      playing?.stop()
    } catch (_: Exception) {
      // ignore
    }
    playing = null
  }
}
