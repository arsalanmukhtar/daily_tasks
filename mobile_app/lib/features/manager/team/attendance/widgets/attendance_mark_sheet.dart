import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../data/models/attendance_record.dart';
import '../../../../../data/providers.dart';
import '../../../../../widgets/avatar.dart';
import '../../../../../widgets/note_field_decoration.dart';
import '../../team_providers.dart';

final _dateFmt = DateFormat('EEEE, d MMMM yyyy');

/// Present/Absent/Late picker + optional note for one person on one day -
/// opened from AttendanceRosterScreen. Only the 3 manual statuses are
/// selectable here (On Leave/Unmarked are never written, see
/// team_providers.dart's resolveAttendanceStatus).
class AttendanceMarkSheet extends ConsumerStatefulWidget {
  const AttendanceMarkSheet({
    required this.email,
    required this.name,
    required this.date,
    required this.existing,
    super.key,
  });

  final String email;
  final String name;
  final DateTime date;
  final AttendanceRecord? existing;

  @override
  ConsumerState<AttendanceMarkSheet> createState() => _AttendanceMarkSheetState();
}

const _selectableStatuses = [AttendanceStatus.present, AttendanceStatus.late, AttendanceStatus.absent];

class _AttendanceMarkSheetState extends ConsumerState<AttendanceMarkSheet> {
  String? _status;
  bool _isSubmitting = false;
  late final _noteController = TextEditingController(text: widget.existing?.note ?? '');

  @override
  void initState() {
    super.initState();
    _status = widget.existing?.status;
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    final status = _status;
    if (status == null) return;
    setState(() => _isSubmitting = true);
    try {
      await ref
          .read(attendanceRepositoryProvider)
          .mark(widget.email, widget.date, status: status, note: _noteController.text.trim());
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not save: $e')));
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _unmark() async {
    setState(() => _isSubmitting = true);
    try {
      await ref.read(attendanceRepositoryProvider).unmark(widget.email, widget.date);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not clear: $e')));
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(color: AppColors.line, borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Avatar(name: widget.name, email: widget.email, size: 40),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(widget.name.isNotEmpty ? widget.name : widget.email,
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text(_dateFmt.format(widget.date), style: TextStyle(color: AppColors.ink500, fontSize: 12.5)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Text('Status', style: TextStyle(color: AppColors.ink500, fontSize: 13)),
            const SizedBox(height: 8),
            Row(
              children: [
                for (final s in _selectableStatuses) ...[
                  if (s != _selectableStatuses.first) const SizedBox(width: 10),
                  Expanded(child: _statusOption(s)),
                ],
              ],
            ),
            const SizedBox(height: 16),
            TextField(controller: _noteController, decoration: noteFieldDecoration('Note (optional)')),
            const SizedBox(height: 18),
            Row(
              children: [
                if (widget.existing != null)
                  TextButton(
                    onPressed: _isSubmitting ? null : _unmark,
                    style: TextButton.styleFrom(foregroundColor: AppColors.statusRejected),
                    child: const Text('Unmark'),
                  ),
                const Spacer(),
                OutlinedButton(
                  onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                  child: const Text('Cancel'),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed: _isSubmitting || _status == null ? null : _confirm,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Save'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusOption(AttendanceStatus status) {
    final value = status.name; // enum names match the server's status strings exactly.
    final selected = _status == value;
    return GestureDetector(
      onTap: () => setState(() => _status = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        padding: const EdgeInsets.symmetric(vertical: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? status.background : AppColors.surface,
          border: Border.all(color: selected ? status.foreground : AppColors.lineStrong),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          status.label,
          style: TextStyle(
            color: selected ? status.foreground : AppColors.ink700,
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}
