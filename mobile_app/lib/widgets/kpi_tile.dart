import 'package:flutter/material.dart';

/// Value-first, centered KPI tile - mirrors android-app's KpiTile in
/// LeaveSummaryScreen.kt.
class KpiTile extends StatelessWidget {
  const KpiTile({
    required this.label,
    required this.value,
    required this.foreground,
    required this.background,
    super.key,
  });

  final String label;
  final String value;
  final Color foreground;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          Text(value, style: TextStyle(color: foreground, fontWeight: FontWeight.w800, fontSize: 22)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: foreground, fontSize: 12)),
        ],
      ),
    );
  }
}
