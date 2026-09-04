package com.techew.leaveapprovals.ui.summary

import android.os.SystemClock
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.ListenerRegistration
import com.techew.leaveapprovals.data.AllowlistEntry
import com.techew.leaveapprovals.data.AllowlistRepository
import com.techew.leaveapprovals.data.LeaveApiClient
import com.techew.leaveapprovals.data.LeaveRequest
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

// Well past what a small team accumulates even over a couple of years - large
// enough that the Summary tab's trends aren't quietly missing older history.
private const val SUMMARY_LIMIT = 500

class LeaveSummaryViewModel(
    private val apiClient: LeaveApiClient,
    private val allowlistRepository: AllowlistRepository = AllowlistRepository()
) : ViewModel() {

    private val _records = MutableStateFlow<List<LeaveRequest>>(emptyList())
    val records: StateFlow<List<LeaveRequest>> = _records.asStateFlow()

    // Full roster (regardless of leave history) so every allowlisted
    // developer is selectable in the multi-user filter, not just the ones
    // who happen to have leave records.
    private val _roster = MutableStateFlow<List<AllowlistEntry>>(emptyList())
    val roster: StateFlow<List<AllowlistEntry>> = _roster.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var listenerRegistration: ListenerRegistration? = null

    // Live from construction (same moment as the Requests tab's listener,
    // regardless of which tab is actually showing) rather than lazily on
    // first visit - trends stay current even if the owner leaves this tab
    // open in the background.
    init {
        startListening()
        viewModelScope.launch {
            runCatching { allowlistRepository.listAll() }
                .onSuccess { _roster.value = it }
        }
    }

    private fun startListening(minSpinnerMs: Long = 0L) {
        listenerRegistration?.remove()
        _isLoading.value = true
        val startedAt = SystemClock.elapsedRealtime()
        listenerRegistration = apiClient.listenLeaveRequests(limit = SUMMARY_LIMIT) { result ->
            result.onSuccess {
                _errorMessage.value = null
                _records.value = it
            }.onFailure {
                _errorMessage.value = it.message ?: "Could not load leave history."
            }
            val remaining = minSpinnerMs - (SystemClock.elapsedRealtime() - startedAt)
            if (remaining > 0) {
                viewModelScope.launch {
                    delay(remaining)
                    _isLoading.value = false
                }
            } else {
                _isLoading.value = false
            }
        }
    }

    // The list is already live without this - kept as a manual "force
    // resync" for the topBar's refresh button. See RequestListViewModel's
    // refresh() for why a minimum spinner duration is needed here too.
    fun refresh() = startListening(minSpinnerMs = 600L)

    // Must be called explicitly when this ViewModel is done with (sign-out,
    // switching accounts) - see RequestListViewModel.stopListening() for why.
    fun stopListening() {
        listenerRegistration?.remove()
        listenerRegistration = null
    }
}
