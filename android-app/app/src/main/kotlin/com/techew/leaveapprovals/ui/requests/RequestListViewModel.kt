package com.techew.leaveapprovals.ui.requests

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.techew.leaveapprovals.data.LeaveApiClient
import com.techew.leaveapprovals.data.LeaveRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class RequestListViewModel(
    private val apiClient: LeaveApiClient
) : ViewModel() {

    private val _records = MutableStateFlow<List<LeaveRequest>>(emptyList())
    val records: StateFlow<List<LeaveRequest>> = _records.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // True from the moment Approve/Reject is tapped until the refreshed list
    // (with the new status) has actually loaded - lets the detail sheet show
    // a spinner for the whole round trip instead of closing instantly with
    // no feedback.
    private val _isDeciding = MutableStateFlow(false)
    val isDeciding: StateFlow<Boolean> = _isDeciding.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    fun refresh() {
        viewModelScope.launch { doRefresh() }
    }

    private suspend fun doRefresh() {
        _isLoading.value = true
        _errorMessage.value = null
        runCatching {
            apiClient.listLeaveRequests()
        }.onSuccess {
            _records.value = it
        }.onFailure {
            _errorMessage.value = it.message ?: "Could not load requests."
        }
        _isLoading.value = false
    }

    fun decide(requestId: String, decision: String) {
        viewModelScope.launch {
            _isDeciding.value = true
            _errorMessage.value = null
            runCatching {
                apiClient.decideLeave(requestId, decision)
            }.onFailure {
                _errorMessage.value = it.message ?: "Could not save decision."
            }
            doRefresh()
            _isDeciding.value = false
        }
    }
}
