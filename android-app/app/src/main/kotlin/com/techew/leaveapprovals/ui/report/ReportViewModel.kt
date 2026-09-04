package com.techew.leaveapprovals.ui.report

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.ListenerRegistration
import com.techew.leaveapprovals.data.AllowlistEntry
import com.techew.leaveapprovals.data.AllowlistRepository
import com.techew.leaveapprovals.data.LeaveApiClient
import com.techew.leaveapprovals.data.UninformedLeave
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class ReportViewModel(
    private val apiClient: LeaveApiClient,
    private val allowlistRepository: AllowlistRepository = AllowlistRepository()
) : ViewModel() {

    private val _roster = MutableStateFlow<List<AllowlistEntry>>(emptyList())
    val roster: StateFlow<List<AllowlistEntry>> = _roster.asStateFlow()

    private val _reports = MutableStateFlow<List<UninformedLeave>>(emptyList())
    private val reports: StateFlow<List<UninformedLeave>> = _reports.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _isSubmitting = MutableStateFlow(false)
    val isSubmitting: StateFlow<Boolean> = _isSubmitting.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // Open reports first (oldest first, so the longest-outstanding one is
    // most visible) - the resolutions log below it is newest-first (an audit
    // trail, most recent activity on top).
    val openReports: StateFlow<List<UninformedLeave>> = reports
        .map { list -> list.filter { it.status == "reported" }.sortedBy { it.reportedAt } }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val resolvedReports: StateFlow<List<UninformedLeave>> = reports
        .map { list -> list.filter { it.status == "resolved" }.sortedByDescending { it.resolvedAt } }
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
        listenerRegistration = apiClient.listenUninformedLeaves { result ->
            result.onSuccess {
                _errorMessage.value = null
                _reports.value = it
            }.onFailure {
                _errorMessage.value = it.message ?: "Could not load reports."
            }
            _isLoading.value = false
        }
    }

    // Manual "force resync" for the topBar's refresh button, matching
    // RequestListViewModel/LeaveSummaryViewModel's refresh().
    fun refresh() = startListening()

    // Must be called explicitly - see RequestListViewModel's stopListening()
    // for why (this is a plain remember{} instance, not a real ViewModelStore one).
    fun stopListening() {
        listenerRegistration?.remove()
        listenerRegistration = null
    }

    fun report(email: String, name: String, dateMillis: Long, reasonHtml: String, onDone: (Boolean) -> Unit) {
        viewModelScope.launch {
            _isSubmitting.value = true
            _errorMessage.value = null
            val success = runCatching {
                apiClient.reportUninformedLeave(email, name, dateMillis, reasonHtml)
            }.onFailure {
                _errorMessage.value = it.message ?: "Could not file the report."
            }.isSuccess
            _isSubmitting.value = false
            onDone(success)
        }
    }

    fun resolve(reportId: String, resolutionHtml: String, onDone: (Boolean) -> Unit) {
        viewModelScope.launch {
            _isSubmitting.value = true
            _errorMessage.value = null
            val success = runCatching {
                apiClient.resolveUninformedLeave(reportId, resolutionHtml)
            }.onFailure {
                _errorMessage.value = it.message ?: "Could not save the resolution."
            }.isSuccess
            _isSubmitting.value = false
            onDone(success)
        }
    }
}
