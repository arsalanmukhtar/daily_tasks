import 'package:flutter/material.dart';

/// Deterministic-per-email color circle with initials - mirrors the Kotlin
/// app's `ui/common/Avatar.kt` (golden-angle HSL hue assignment keyed by
/// the lowercased email, so team members never collide).
class Avatar extends StatelessWidget {
  const Avatar({required this.name, required this.email, this.size = 36, super.key});

  final String name;
  final String email;
  final double size;

  static const _goldenAngle = 137.508;

  Color _colorFor(String key) {
    final hash = key.toLowerCase().codeUnits.fold<int>(0, (acc, c) => acc * 31 + c);
    final hue = (hash.abs() * _goldenAngle) % 360;
    return HSLColor.fromAHSL(1, hue, 0.55, 0.55).toColor();
  }

  String get _initials {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return email.isNotEmpty ? email[0].toUpperCase() : '?';
    final parts = trimmed.split(RegExp(r'\s+'));
    final first = parts.first.isNotEmpty ? parts.first[0] : '';
    final last = parts.length > 1 && parts.last.isNotEmpty ? parts.last[0] : '';
    return (first + last).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final color = _colorFor(email.isNotEmpty ? email : name);
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: color,
      child: Text(
        _initials,
        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: size * 0.38),
      ),
    );
  }
}
