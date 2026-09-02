package com.techew.leaveapprovals.ui.summary

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.techew.leaveapprovals.data.LeaveApiClient
import com.techew.leaveapprovals.data.LeaveRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

// Well past what a small team accumulates even over a couple of years - large
// enough that the Summary tab's trends aren't quietly missing older history.
private const val SUMMARY_LIMIT = 500

class LeaveSummaryViewModel(
    private val apiClient: LeaveApiClient
) : ViewModel() {

    private val _records = MutableStateFlow<List<LeaveRequest>>(emptyList())
    val records: StateFlow<List<LeaveRequest>> = _records.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var loaded = false

    // Called every time the Summary tab becomes visible - only fetches once,
    // so switching tabs back and forth doesn't refire the network call.
    fun loadIfNeeded() {
        if (!loaded) refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            runCatching {
                apiClient.listLeaveRequests(limit = SUMMARY_LIMIT)
            }.onSuccess {
                _records.value = it
                loaded = true
            }.onFailure {
                _errorMessage.value = it.message ?: "Could not load leave history."
            }
            _isLoading.value = false
        }
    }
}
