import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

/// One labeled horizontal bar - used for the "By leave type" breakdown.
class HorizontalBarRow extends StatelessWidget {
  const HorizontalBarRow({required this.label, required this.value, required this.maxValue, super.key});

  final String label;
  final int value;
  final int maxValue;

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
                valueColor: const AlwaysStoppedAnimation(AppColors.techEwOrange),
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
