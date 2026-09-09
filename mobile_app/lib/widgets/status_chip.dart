import 'package:flutter/material.dart';

/// A small rounded, tinted label - the same visual language every chip in
/// this product uses (status pills, type chips, duration chips): filled
/// background, no border, fully-rounded corners.
class StatusChip extends StatelessWidget {
  const StatusChip({
    required this.label,
    required this.foreground,
    required this.background,
    this.icon,
    super.key,
  });

  final String label;
  final Color foreground;
  final Color background;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(50)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: foreground),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(color: foreground, fontWeight: FontWeight.w700, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
