package com.techew.leaveapprovals.ui.requests

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.ListenerRegistration
import com.techew.leaveapprovals.data.AllowlistEntry
import com.techew.leaveapprovals.data.AllowlistRepository
import com.techew.leaveapprovals.data.LeaveApiClient
import com.techew.leaveapprovals.data.LeaveRequest
import com.techew.leaveapprovals.data.isArchived
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class RequestListViewModel(
    private val apiClient: LeaveApiClient,
    private val allowlistRepository: AllowlistRepository = AllowlistRepository()
) : ViewModel() {

    // Full roster (regardless of leave history) for the developer filter
    // dropdown - fetched once, the roster rarely changes mid-session.
    private val _roster = MutableStateFlow<List<AllowlistEntry>>(emptyList())
    val roster: StateFlow<List<AllowlistEntry>> = _roster.asStateFlow()

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

    // Shared by both the Requests and Archived screens (one underlying
    // listener/list) - null means "All". Kept here rather than per-screen so
    // switching tabs doesn't lose the manager's current filter selection.
    private val _typeFilter = MutableStateFlow<String?>(null)
    val typeFilter: StateFlow<String?> = _typeFilter.asStateFlow()
    private val _statusFilter = MutableStateFlow<String?>(null)
    val statusFilter: StateFlow<String?> = _statusFilter.asStateFlow()
    private val _emailFilter = MutableStateFlow<String?>(null)
    val emailFilter: StateFlow<String?> = _emailFilter.asStateFlow()

    fun setTypeFilter(type: String?) { _typeFilter.value = type }
    fun setStatusFilter(status: String?) { _statusFilter.value = status }
    fun setEmailFilter(email: String?) { _emailFilter.value = email }

    private val filtered: StateFlow<List<LeaveRequest>> = combine(
        _records, _typeFilter, _statusFilter, _emailFilter
    ) { records, type, status, email ->
        records.filter { r ->
            (type == null || r.type == type) &&
                (status == null || r.status == status) &&
                (email == null || r.email == email)
        }
    }.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    // A request is archived once its last leave day has passed - purely
    // date-driven, independent of status (see LeaveRequest.isArchived()).
    val activeRecords: StateFlow<List<LeaveRequest>> = filtered
        .map { list -> list.filterNot { it.isArchived() } }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val archivedRecords: StateFlow<List<LeaveRequest>> = filtered
        .map { list -> list.filter { it.isArchived() } }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private var listenerRegistration: ListenerRegistration? = null

    init {
        startListening()
        viewModelScope.launch {
            runCatching { allowlistRepository.listAll() }
                .onSuccess { _roster.value = it }
        }
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
