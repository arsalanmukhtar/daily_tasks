import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

/// Deliberately plain, dependency-free bar chart - flat bars, no gridlines,
/// no animation, one accent color for the peak bar - mirrors the Kotlin
/// app's MonthlyTrendChart.kt.
class SimpleBarChart extends StatelessWidget {
  const SimpleBarChart({required this.labels, required this.values, this.height = 140, super.key});

  final List<String> labels;
  final List<int> values;
  final double height;

  @override
  Widget build(BuildContext context) {
    final maxValue = values.isEmpty ? 0 : values.reduce((a, b) => a > b ? a : b);
    final peakIndex = maxValue == 0 ? -1 : values.indexOf(maxValue);

    return SizedBox(
      height: height,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < values.length; i++)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (values[i] > 0) Text('${values[i]}', style: const TextStyle(fontSize: 10)),
                    const SizedBox(height: 2),
                    Container(
                      height: maxValue == 0 ? 2 : (values[i] / maxValue) * (height - 36) + 2,
                      decoration: BoxDecoration(
                        color: i == peakIndex ? AppColors.brandPrimary : AppColors.surface3,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(labels[i], style: TextStyle(fontSize: 10, color: AppColors.ink500)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
