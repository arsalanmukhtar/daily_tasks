import 'package:flutter/material.dart';

/// Value-first, centered KPI tile - mirrors android-app's KpiTile in
/// LeaveSummaryScreen.kt.
class KpiTile extends StatelessWidget {
  const KpiTile({
    required this.label,
    required this.value,
    required this.foreground,
    required this.background,
    this.sublabel,
    super.key,
  });

  final String label;
  final String value;
  final Color foreground;
  final Color background;

  /// An optional third line below [label] - e.g. a percentage. Kept as its
  /// own line (not appended to [label] with a separator) so a narrow tile
  /// never has to wrap/overflow a combined "label · sublabel" string - see
  /// AttendanceStatsScreen's KPI row, the one caller that uses this today.
  final String? sublabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(12)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(value, style: TextStyle(color: foreground, fontWeight: FontWeight.w800, fontSize: 22)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: foreground, fontSize: 12), textAlign: TextAlign.center),
          if (sublabel != null) ...[
            const SizedBox(height: 1),
            Text(
              sublabel!,
              style: TextStyle(color: foreground.withValues(alpha: 0.75), fontSize: 11, fontWeight: FontWeight.w600),
            ),
          ],
        ],
      ),
    );
  }
}
