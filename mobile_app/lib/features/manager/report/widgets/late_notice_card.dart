import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../data/models/attachment.dart';
import '../../../../data/models/late_arrival_notice.dart';
import '../../../../utils/rich_text.dart';
import '../../../../widgets/attachment_chip.dart';
import '../../../../widgets/avatar.dart';
import '../../../../widgets/status_chip.dart';

final _dateFmt = DateFormat('EEE, d MMM yyyy');

/// A developer's self-filed "I'll be late" notice - read-only (see
/// PROJECT.md's manager-in-mobile/normal-user-on-web split: filing one is a
/// normal-user action that lives on the web app), plus a one-tap
/// Acknowledge so it stops needing attention.
class LateNoticeCard extends StatelessWidget {
  const LateNoticeCard({required this.notice, required this.onAcknowledge, super.key});

  final LateArrivalNotice notice;
  final Future<void> Function() onAcknowledge;

  @override
  Widget build(BuildContext context) {
    final acknowledged = notice.status == 'acknowledged';
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Avatar(name: notice.name, email: notice.email, size: 32),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(notice.name.isNotEmpty ? notice.name : notice.email,
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text(
                        '${_dateFmt.format(notice.date)}'
                        '${notice.expectedArrivalTime != null ? ' · around ${notice.expectedArrivalTime}' : ''}',
                        style: TextStyle(color: AppColors.ink500, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                if (acknowledged)
                  StatusChip(label: 'ACKNOWLEDGED', foreground: AppColors.statusApproved, background: AppColors.statusApprovedBg)
                else
                  StatusChip(label: 'NEW', foreground: AppColors.statusRequested, background: AppColors.statusRequestedBg),
              ],
            ),
            const SizedBox(height: 8),
            if (notice.reasonHtml.isNotEmpty)
              HtmlWidget(normalizeStoredRichText(notice.reasonHtml))
            else
              const Text('No reason provided.', style: TextStyle(fontStyle: FontStyle.italic)),
            if (notice.attachments.isNotEmpty) ...[
              const SizedBox(height: 6),
              for (final a in notice.attachments) AttachmentChip(attachment: Attachment.fromMap(a)),
            ],
            if (!acknowledged) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: OutlinedButton(onPressed: onAcknowledge, child: const Text('Acknowledge')),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
