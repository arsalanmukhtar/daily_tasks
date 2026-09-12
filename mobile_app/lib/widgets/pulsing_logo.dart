import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// The NDMA logo, gently rotating with soft rings pulsing outward behind
/// it - used on AuthGate's loading splash (the one moment between cold
/// start and knowing whether we're signed in), so that wait reads as "the
/// app is alive and working" instead of a bare spinner.
class PulsingLogo extends StatefulWidget {
  const PulsingLogo({this.size = 56, super.key});

  final double size;

  @override
  State<PulsingLogo> createState() => _PulsingLogoState();
}

class _PulsingLogoState extends State<PulsingLogo> with TickerProviderStateMixin {
  // Slow and continuous - "slightly rotating", not spinning like a loader.
  late final AnimationController _rotation = AnimationController(vsync: this, duration: const Duration(seconds: 16))..repeat();
  // Two rings, half a cycle apart (see _ring's phase argument), so a new
  // one starts outward just as the previous fades - a steady heartbeat
  // rather than a single pulse-and-pause.
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 2400))..repeat();

  @override
  void dispose() {
    _rotation.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ringMax = widget.size * 2.2;
    return SizedBox(
      width: ringMax,
      height: ringMax,
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(animation: _pulse, builder: (_, _) => _ring(_pulse.value, ringMax)),
          AnimatedBuilder(animation: _pulse, builder: (_, _) => _ring((_pulse.value + 0.5) % 1.0, ringMax)),
          RotationTransition(
            turns: _rotation,
            child: Container(
              width: widget.size,
              height: widget.size,
              padding: EdgeInsets.all(widget.size * 0.16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: AppColors.brandPrimaryDark.withValues(alpha: 0.12), blurRadius: 12, spreadRadius: 1)],
              ),
              child: Image.asset('assets/branding/ndma_logo.webp', fit: BoxFit.contain),
            ),
          ),
        ],
      ),
    );
  }

  /// One outgoing pulse ring at phase [t] (0 = just born, at the logo's own
  /// size and fully visible; 1 = fully grown to [maxSize] and faded out).
  Widget _ring(double t, double maxSize) {
    final size = widget.size + (maxSize - widget.size) * t;
    final alpha = (1 - t) * 0.3;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [
            AppColors.brandPrimaryDark.withValues(alpha: alpha),
            AppColors.brandPrimaryDark.withValues(alpha: 0),
          ],
          stops: const [0.55, 1.0],
        ),
      ),
    );
  }
}
