package com.streakkeeper.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.facebook.react.HeadlessJsTaskService

/**
 * Short-lived foreground service active ONLY while sending commits or handling a one-shot
 * scheduled alarm wake-up. Never stays running persistently when idle.
 */
class KeeperService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private val safetyStop = Runnable { stop(this, exitIfBackground = true) }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createChannel()
    promoteForeground(statusText)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val next = intent?.getStringExtra(EXTRA_STATUS)
    if (!next.isNullOrBlank()) statusText = next
    promoteForeground(statusText)
    running = true
    armSafetyTimeout()

    if (intent?.getBooleanExtra(EXTRA_ONE_SHOT_WAKE, false) == true) {
      Log.i("StreakKeeperNative", "KeeperService launching KeeperHeadlessService")
      val headless = Intent(this, KeeperHeadlessService::class.java)
      HeadlessJsTaskService.acquireWakeLockNow(this)
      startService(headless)
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    running = false
    handler.removeCallbacks(safetyStop)
    super.onDestroy()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    handler.removeCallbacks(safetyStop)
    running = false
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun armSafetyTimeout() {
    handler.removeCallbacks(safetyStop)
    handler.postDelayed(safetyStop, SAFETY_TIMEOUT_MS)
  }

  private fun promoteForeground(body: String) {
    val notification = buildNotification(body)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
      )
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun buildNotification(body: String): Notification {
    val launch = PendingIntent.getActivity(
      this,
      0,
      Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Veyon")
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentIntent(launch)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .build()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NotificationManager::class.java)
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Sending status", NotificationManager.IMPORTANCE_LOW).apply {
        setShowBadge(false)
        description = "Live commit and push status"
      },
    )
  }

  companion object {
    const val CHANNEL_ID = "streak_keeper_live"
    const val NOTIFICATION_ID = 42
    const val EXTRA_STATUS = "status"
    const val EXTRA_ONE_SHOT_WAKE = "one_shot_wake"
    const val SAFETY_TIMEOUT_MS = 3 * 60_000L

    @Volatile var statusText: String = "Syncing commits"
    @Volatile var running: Boolean = false
    private val mainHandler = Handler(Looper.getMainLooper())

    fun start(context: Context, status: String? = null) {
      val intent = Intent(context, KeeperService::class.java)
      if (!status.isNullOrBlank()) intent.putExtra(EXTRA_STATUS, status)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      } catch (err: Exception) {
        Log.w("StreakKeeperNative", "start blocked: ${err.message}")
      }
    }

    fun startOneShotWake(context: Context) {
      statusText = "Syncing scheduled commits…"
      val intent = Intent(context, KeeperService::class.java)
        .putExtra(EXTRA_STATUS, statusText)
        .putExtra(EXTRA_ONE_SHOT_WAKE, true)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      } catch (err: Exception) {
        Log.w("StreakKeeperNative", "one-shot FGS blocked (${err.message}); trying headless fallback")
        try {
          HeadlessJsTaskService.acquireWakeLockNow(context)
          context.startService(Intent(context, KeeperHeadlessService::class.java))
        } catch (e2: Exception) {
          Log.w("StreakKeeperNative", "headless fallback blocked: ${e2.message}")
        }
      }
    }

    fun update(context: Context, status: String) {
      statusText = status
      if (!running) return
      start(context, status)
    }

    fun stop(context: Context, exitIfBackground: Boolean = false) {
      running = false
      context.stopService(Intent(context, KeeperService::class.java))
      val nm = context.getSystemService(NotificationManager::class.java)
      nm?.cancel(NOTIFICATION_ID)

      if (exitIfBackground && !MainActivity.isForeground) {
        mainHandler.postDelayed({
          if (!MainActivity.isForeground && !running) {
            Log.i("StreakKeeperNative", "Background task complete; terminating process")
            android.os.Process.killProcess(android.os.Process.myPid())
          }
        }, 1_500L)
      }
    }
  }
}
