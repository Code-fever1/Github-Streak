package com.streakkeeper.mobile

import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

object SuRunner {
  fun isSuAvailable(): Boolean = suOutput("id").contains("uid=0")

  fun suOk(cmd: String, timeoutMs: Long = 45_000): Boolean {
    return try {
      val p = Runtime.getRuntime().exec(arrayOf("su", "-c", cmd))
      gobble(p)
      val finished = p.waitFor(timeoutMs, TimeUnit.MILLISECONDS)
      if (!finished) {
        p.destroy()
        return false
      }
      p.exitValue() == 0
    } catch (_: Exception) {
      false
    }
  }

  fun suOutput(cmd: String, timeoutMs: Long = 45_000): String {
    return try {
      val p = Runtime.getRuntime().exec(arrayOf("su", "-c", cmd))
      val out = readAll(p.inputStream)
      val err = readAll(p.errorStream)
      p.waitFor(timeoutMs, TimeUnit.MILLISECONDS)
      (out + err).trim()
    } catch (err: Exception) {
      err.message ?: ""
    }
  }

  private fun gobble(p: Process) {
    Thread {
      try {
        readAll(p.inputStream)
        readAll(p.errorStream)
      } catch (_: Exception) {
      }
    }.start()
  }

  private fun readAll(stream: java.io.InputStream): String =
    BufferedReader(InputStreamReader(stream)).readText()
}
