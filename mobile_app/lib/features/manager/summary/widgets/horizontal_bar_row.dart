import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

/// One labeled horizontal bar - used for the "By leave type" breakdown.
class HorizontalBarRow extends StatelessWidget {
  const HorizontalBarRow({
    required this.label,
    required this.value,
    required this.maxValue,
    this.color = AppColors.brandPrimary,
    super.key,
  });

  final String label;
  final int value;
  final int maxValue;

  /// Defaults to the brand color so any other, single-series use of this
  /// widget keeps its old look - the Summary "By leave type" chart passes a
  /// distinct color per row instead (see AppColors.forLeaveTypeBar).
  final Color color;

  @override
  Widget build(BuildContext context) {
    final fraction = maxValue == 0 ? 0.0 : value / maxValue;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(width: 96, child: Text(label, style: const TextStyle(fontSize: 12))),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: fraction,
                minHeight: 14,
                backgroundColor: AppColors.surface2,
                valueColor: AlwaysStoppedAnimation(color),
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(width: 24, child: Text('$value', style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}
