import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../data/models/leave_request.dart';
import '../../../../utils/rich_text.dart';
import '../../../../widgets/avatar.dart';
import '../../../../widgets/status_chip.dart';

final _dateFmt = DateFormat('d MMM yyyy');
final _timeFmt = DateFormat('d MMM, h:mm a');

/// One row in the Requests/Archived list - avatar, status badge, type/
/// duration/week chips, a short reason preview, and a resolved-by summary
/// once decided. Mirrors the Kotlin app's RequestCard.kt.
class RequestCard extends StatelessWidget {
  const RequestCard({required this.request, required this.onTap, super.key});

  final LeaveRequest request;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (statusFg, statusBg) = AppColors.forStatus(request.status);
    final (typeFg, typeBg) = AppColors.forType(request.type.value);

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Avatar(name: request.name, email: request.email, size: 36),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(request.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                        Text(request.email, style: TextStyle(color: AppColors.ink500, fontSize: 12)),
                      ],
                    ),
                  ),
                  StatusChip(label: request.status.toUpperCase(), foreground: statusFg, background: statusBg),
                ],
              ),
              const SizedBox(height: 10),
              // Row 1: type/duration/date - however many fit, wrapping among
              // themselves. Row 2 is always just Applied-time (+ the
              // attachment glyph, if any) on its own line, rather than
              // however the Wrap happened to overflow - keeps that one
              // consistent from card to card instead of drifting up onto
              // row 1 when the name/type/date happen to be short.
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  StatusChip(label: request.type.familyLabel, foreground: typeFg, background: typeBg),
                  if (request.type.hasDurationChip)
                    Builder(builder: (context) {
                      final (fg, bg) = AppColors.forDuration(request.type.value);
                      return StatusChip(label: request.type.label, foreground: fg, background: bg);
                    }),
                  StatusChip(
                    label: request.leaveDateSummary(_dateFmt),
                    foreground: AppColors.meta,
                    background: AppColors.metaBg,
                    icon: Icons.calendar_today_outlined,
                  ),
                ],
              ),
              if (request.requestedAt != null || request.attachments.isNotEmpty) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    if (request.requestedAt != null)
                      StatusChip(
                        label: _timeFmt.format(request.requestedAt!),
                        foreground: AppColors.meta,
                        background: AppColors.metaBg,
                        icon: Icons.schedule_outlined,
                      ),
                    if (request.attachments.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      // Plain glyph, not a chip and not tappable - just
                      // flags that this request has file(s) attached. Open
                      // them from the detail sheet's actual AttachmentChip
                      // rows instead. Tilted like a paperclip icon
                      // conventionally sits (a forward-slash lean), not
                      // upright.
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Transform.rotate(
                          angle: math.pi / 4,
                          child: Icon(Icons.attach_file_rounded, size: 18, color: AppColors.attachmentIndicator),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
              if (request.reasonHtml.isNotEmpty && request.reasonHtml != '<br>') ...[
                const SizedBox(height: 8),
                HtmlWidget(
                  normalizeStoredRichText(request.reasonHtml),
                  textStyle: TextStyle(color: AppColors.ink700, fontSize: 13),
                ),
              ],
              if (request.status != 'requested') ...[
                const SizedBox(height: 8),
                Text(
                  '${request.status[0].toUpperCase()}${request.status.substring(1)} by '
                  '${request.resolvedBy.isNotEmpty ? request.resolvedBy : "-"}',
                  style: TextStyle(color: AppColors.ink500, fontSize: 12, fontStyle: FontStyle.italic),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
