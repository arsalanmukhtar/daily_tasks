package com.techew.leaveapprovals.ui.requests

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.ListenerRegistration
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

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // True from the moment Approve/Reject is tapped until the decision's
    // transaction finishes - the live listener below picks up the resulting
    // status change on its own, no manual reload needed.
    private val _isDeciding = MutableStateFlow(false)
    val isDeciding: StateFlow<Boolean> = _isDeciding.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var listenerRegistration: ListenerRegistration? = null

    init {
        startListening()
    }

    private fun startListening() {
        listenerRegistration?.remove()
        _isLoading.value = true
        listenerRegistration = apiClient.listenLeaveRequests { result ->
            _isLoading.value = false
            result.onSuccess {
                _errorMessage.value = null
                _records.value = it
            }.onFailure {
                Log.e("RequestListViewModel", "listener error", it)
                _errorMessage.value = it.message ?: "Could not load requests."
            }
        }
    }

    // The list is already live without this - kept as a manual "force
    // resync" for the topBar's refresh button (e.g. after a long stretch in
    // the background, or a suspected dropped listener).
    fun refresh() = startListening()

    // Must be called explicitly when this ViewModel is done with (sign-out,
    // switching accounts) - it's a plain `remember{}` instance, not one
    // obtained from a real ViewModelStore, so ViewModel.onCleared() never
    // fires and the listener would otherwise run forever.
    fun stopListening() {
        listenerRegistration?.remove()
        listenerRegistration = null
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
            _isDeciding.value = false
        }
    }
}
