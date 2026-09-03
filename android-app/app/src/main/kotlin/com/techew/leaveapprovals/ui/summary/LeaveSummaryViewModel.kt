package com.techew.leaveapprovals.ui.summary

import androidx.lifecycle.ViewModel
import com.google.firebase.firestore.ListenerRegistration
import com.techew.leaveapprovals.data.LeaveApiClient
import com.techew.leaveapprovals.data.LeaveRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

// Well past what a small team accumulates even over a couple of years - large
// enough that the Summary tab's trends aren't quietly missing older history.
private const val SUMMARY_LIMIT = 500

class LeaveSummaryViewModel(
    private val apiClient: LeaveApiClient
) : ViewModel() {

    private val _records = MutableStateFlow<List<LeaveRequest>>(emptyList())
    val records: StateFlow<List<LeaveRequest>> = _records.asStateFlow()

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
    }

    private fun startListening() {
        listenerRegistration?.remove()
        _isLoading.value = true
        listenerRegistration = apiClient.listenLeaveRequests(limit = SUMMARY_LIMIT) { result ->
            _isLoading.value = false
            result.onSuccess {
                _errorMessage.value = null
                _records.value = it
            }.onFailure {
                _errorMessage.value = it.message ?: "Could not load leave history."
            }
        }
    }

    // The list is already live without this - kept as a manual "force
    // resync" for the topBar's refresh button.
    fun refresh() = startListening()

    // Must be called explicitly when this ViewModel is done with (sign-out,
    // switching accounts) - see RequestListViewModel.stopListening() for why.
    fun stopListening() {
        listenerRegistration?.remove()
        listenerRegistration = null
    }
}
