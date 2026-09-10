import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/leave_request.dart';
import '../../data/models/leave_type.dart';
import '../../data/models/uninformed_leave.dart';
import '../../data/providers.dart';

/// Every leave request the signed-in owner can see - the same GET
/// /api/leave-requests endpoint developers use, just returning everyone's
/// rows for an owner caller (see server/src/routes/leaveRequests.js).
final allLeaveRequestsProvider = StreamProvider<List<LeaveRequest>>((ref) {
  return ref.watch(leaveRepositoryProvider).watchAllRequests();
});

/// Every uninformed-leave report, any status - feeds both the Report tab
/// and the Summary tab's "by leave type" chart.
final allUninformedLeavesProvider = StreamProvider<List<UninformedLeave>>((ref) {
  return ref.watch(uninformedLeaveRepositoryProvider).watchAllReports();
});

/// Status/type/person filter shared between the Requests and Archived tabs
/// - switching tabs preserves the selection, mirroring the Kotlin app's
/// RequestListViewModel keeping this state itself rather than per-screen.
class RequestFilter {
  const RequestFilter({this.status, this.type, this.email});

  final String? status; // null = all
  final LeaveType? type; // null = all
  final String? email; // null = all

  RequestFilter copyWith({
    String? Function()? status,
    LeaveType? Function()? type,
    String? Function()? email,
  }) {
    return RequestFilter(
      status: status != null ? status() : this.status,
      type: type != null ? type() : this.type,
      email: email != null ? email() : this.email,
    );
  }

  bool matches(LeaveRequest r) {
    if (status != null && r.status != status) return false;
    if (type != null && r.type != type) return false;
    if (email != null && r.email != email) return false;
    return true;
  }
}

final requestFilterProvider = StateProvider<RequestFilter>((ref) => const RequestFilter());
