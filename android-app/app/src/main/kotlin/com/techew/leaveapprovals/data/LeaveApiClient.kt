package com.techew.leaveapprovals.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

class ApiException(message: String) : Exception(message)

/**
 * Talks to the same apps-script/Code.gs backend the web app already uses,
 * unmodified. Native networking has no CORS restriction (unlike a browser),
 * so this uses plain HTTPS GET for every call - including "writes" - which
 * sidesteps an unrelated ambiguity where some HTTP clients downgrade a
 * redirected POST to GET inconsistently. Code.gs's doGet() already has a
 * `e.parameter.payload` JSON-blob fallback that every write action goes
 * through, so this needs zero backend changes.
 */
class LeaveApiClient(private val baseUrl: String) {

    private val client = OkHttpClient.Builder()
        .callTimeout(30, TimeUnit.SECONDS)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun listLeaveRequests(idToken: String): List<LeaveRequest> {
        val url = baseUrl.toHttpUrl().newBuilder()
            .addQueryParameter("action", "listLeaveRequests")
            .addQueryParameter("idToken", idToken)
            .build()
        val body = execute(url)
        val parsed = json.decodeFromString(ListResponse.serializer(), body)
        if (parsed.status != "ok") throw ApiException(parsed.message ?: "Unknown error")
        return parsed.records
    }

    suspend fun registerPushToken(idToken: String, token: String) {
        writeAction(mapOf("action" to "registerPushToken", "idToken" to idToken, "token" to token, "platform" to "android"))
    }

    suspend fun decideLeave(idToken: String, requestId: String, decision: String) {
        writeAction(mapOf("action" to "decideLeave", "idToken" to idToken, "requestId" to requestId, "decision" to decision))
    }

    private suspend fun writeAction(payload: Map<String, String>) {
        val payloadJson = json.encodeToString(payload)
        val url = baseUrl.toHttpUrl().newBuilder()
            .addQueryParameter("payload", payloadJson)
            .build()
        val body = execute(url)
        val parsed = json.decodeFromString(OkResponse.serializer(), body)
        if (parsed.status != "ok") throw ApiException(parsed.message ?: "Unknown error")
    }

    private suspend fun execute(url: okhttp3.HttpUrl): String = withContext(Dispatchers.IO) {
        val request = Request.Builder().url(url).get().build()
        client.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) throw ApiException("HTTP ${resp.code}")
            resp.body?.string() ?: throw ApiException("Empty response")
        }
    }
}
