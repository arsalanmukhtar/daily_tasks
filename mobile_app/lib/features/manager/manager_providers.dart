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

/// Free-text query from the global search bar shown above every manager
/// tab (see GlobalSearchBar) - one shared provider so it persists across
/// tab switches exactly like requestFilterProvider above.
final globalSearchQueryProvider = StateProvider<String>((ref) => '');

final _htmlTagPattern = RegExp('<[^>]*>');

/// reasonHtml/explanationHtml/resolutionHtml are rich text (see
/// PROJECT.md) - strip tags before matching so e.g. a query for "flu"
/// isn't thrown off by markup, and a query can't accidentally match inside
/// a tag name.
String _stripHtml(String html) => html.replaceAll(_htmlTagPattern, ' ');

/// Shared by every list-backed tab's search filtering - all field lookups
/// are case-insensitive substring matches, same as a browser's Ctrl+F.
extension LeaveRequestSearch on LeaveRequest {
  bool matchesQuery(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return true;
    return name.toLowerCase().contains(q) ||
        email.toLowerCase().contains(q) ||
        type.label.toLowerCase().contains(q) ||
        type.familyLabel.toLowerCase().contains(q) ||
        weekLabel.toLowerCase().contains(q) ||
        status.toLowerCase().contains(q) ||
        resolvedBy.toLowerCase().contains(q) ||
        decisionNote.toLowerCase().contains(q) ||
        _stripHtml(reasonHtml).toLowerCase().contains(q);
  }
}

extension UninformedLeaveSearch on UninformedLeave {
  bool matchesQuery(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return true;
    return name.toLowerCase().contains(q) ||
        email.toLowerCase().contains(q) ||
        status.toLowerCase().contains(q) ||
        reportedBy.toLowerCase().contains(q) ||
        resolvedBy.toLowerCase().contains(q) ||
        rejectionNote.toLowerCase().contains(q) ||
        _stripHtml(reasonHtml).toLowerCase().contains(q) ||
        _stripHtml(explanationHtml).toLowerCase().contains(q) ||
        _stripHtml(resolutionHtml).toLowerCase().contains(q);
  }
}
