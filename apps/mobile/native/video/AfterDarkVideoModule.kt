package app.afterdark.mobile

import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.util.UUID

@UnstableApi
class AfterDarkVideoModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var transformer: Transformer? = null
  override fun getName() = "AfterDarkVideo"

  @ReactMethod
  fun createVideo(imageUri: String, audioUri: String, promise: Promise) {
    val handler = Handler(Looper.getMainLooper())
    handler.post {
      if (transformer != null) { promise.reject("BUSY", "A video export is already in progress."); return@post }
      var output: File? = null
      try {
        val image = Uri.parse(imageUri)
        val audio = Uri.parse(audioUri)
        // Only app-private cache files can be passed into the exporter.
        val root = context.cacheDir.canonicalPath + File.separator
        require(image.scheme == "file" && audio.scheme == "file") { "Invalid local media file." }
        val imageFile = File(requireNotNull(image.path)).canonicalFile
        val audioFile = File(requireNotNull(audio.path)).canonicalFile
        require(imageFile.path.startsWith(root) && audioFile.path.startsWith(root) && imageFile.isFile && audioFile.isFile) { "Media must be in the app cache." }
        val retriever = MediaMetadataRetriever()
        val duration = try {
          retriever.setDataSource(audioFile.absolutePath)
          retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
        } finally { retriever.release() }
        require(duration in 1..60000) { "Voice video requires a recording of up to 60 seconds." }
        output = File(context.cacheDir, "after-dark-${UUID.randomUUID()}.mp4")
        val resultFile = output
        val still = EditedMediaItem.Builder(MediaItem.Builder().setUri(Uri.fromFile(imageFile)).setImageDurationMs(duration).build()).setFrameRate(30).build()
        val sound = EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(audioFile))).setRemoveVideo(true).build()
        val composition = Composition.Builder(listOf(EditedMediaItemSequence.Builder(still).build(), EditedMediaItemSequence.Builder(sound).build())).build()
        val listener = object : Transformer.Listener {
          override fun onCompleted(composition: Composition, exportResult: ExportResult) {
            transformer = null
            if (!resultFile.isFile || resultFile.length() == 0L) { promise.reject("EXPORT_FAILED", "No video was created."); return }
            promise.resolve(Uri.fromFile(resultFile).toString())
          }
          override fun onError(composition: Composition, exportResult: ExportResult, exception: ExportException) {
            transformer = null
            resultFile.delete()
            promise.reject("EXPORT_FAILED", "This device could not create the voice video.", exception)
          }
        }
        transformer = Transformer.Builder(context).setAudioMimeType(MimeTypes.AUDIO_AAC).setVideoMimeType(MimeTypes.VIDEO_H264).addListener(listener).build()
        transformer!!.start(composition, resultFile.absolutePath)
      } catch (e: Exception) {
        transformer = null
        output?.delete()
        promise.reject("EXPORT_FAILED", e.message ?: "Could not create the voice video.", e)
      }
    }
  }
}
