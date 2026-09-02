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
    private val apiClient: LeaveApiClient,
    private val getIdToken: suspend () -> String
) : ViewModel() {

    private val _records = MutableStateFlow<List<LeaveRequest>>(emptyList())
    val records: StateFlow<List<LeaveRequest>> = _records.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            runCatching {
                val idToken = getIdToken()
                apiClient.listLeaveRequests(idToken)
            }.onSuccess {
                _records.value = it
            }.onFailure {
                _errorMessage.value = it.message ?: "Could not load requests."
            }
            _isLoading.value = false
        }
    }

    fun decide(requestId: String, decision: String) {
        viewModelScope.launch {
            _errorMessage.value = null
            runCatching {
                val idToken = getIdToken()
                apiClient.decideLeave(idToken, requestId, decision)
            }.onFailure {
                _errorMessage.value = it.message ?: "Could not save decision."
            }
            refresh()
        }
    }
}
