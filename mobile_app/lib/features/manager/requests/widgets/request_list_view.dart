import 'package:flutter/material.dart';

import '../../../../data/models/leave_request.dart';
import '../../../../data/repositories/leave_repository.dart';
import 'request_card.dart';
import 'request_detail_sheet.dart';

/// Shared list+detail-sheet machinery for both Requests and Archived -
/// mirrors the Kotlin app's LeaveRequestList, parametrized by which
/// (already-filtered) record set and empty-state to show.
class RequestListView extends StatelessWidget {
  const RequestListView({
    required this.requests,
    required this.emptyState,
    required this.leaveRepository,
    super.key,
  });

  final List<LeaveRequest> requests;
  final Widget emptyState;
  final LeaveRepository leaveRepository;

  @override
  Widget build(BuildContext context) {
    if (requests.isEmpty) return emptyState;
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: requests.length,
      itemBuilder: (context, i) {
        final request = requests[i];
        return RequestCard(
          request: request,
          onTap: () => showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            builder: (_) => RequestDetailSheet(
              request: request,
              onDecide: ({required approve, note}) => leaveRepository.decide(
                request.requestId,
                approve: approve,
                note: note,
              ),
            ),
          ),
        );
      },
    );
  }
}
