import 'package:flutter/cupertino.dart';
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
final _dayFmt = DateFormat('d MMM');

/// Present/Late/Absent/Night Duty/On Duty picker + optional note for one
/// person on one day - opened from AttendanceRosterScreen. On Leave/Unmarked
/// are never written here (see team_providers.dart's resolveAttendanceStatus)
/// - the roster screen refuses to open this sheet at all for an On Leave day.
///
/// Two of the five statuses reveal an extra inline "dock" once selected:
/// Late asks for an expected arrival time (a Cupertino wheel picker, opened
/// in its own small bottom sheet), On Duty asks for a date range (defaulting
/// to just this day) and saves via markRange() instead of mark() so a
/// multi-day field visit doesn't need remarking one day at a time.
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

class _AttendanceMarkSheetState extends ConsumerState<AttendanceMarkSheet> {
  AttendanceStatus? _status;
  bool _isSubmitting = false;
  late final _noteController = TextEditingController(text: widget.existing?.note ?? '');

  TimeOfDay? _arrivalTime;
  DateTimeRange? _onDutyRange;

  @override
  void initState() {
    super.initState();
    final matchingStatus = manualAttendanceStatuses.where((s) => s.apiValue == widget.existing?.status);
    _status = matchingStatus.isEmpty ? null : matchingStatus.first;
    final existingTime = widget.existing?.arrivalTime;
    if (existingTime != null && existingTime.contains(':')) {
      final parts = existingTime.split(':');
      _arrivalTime = TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
    }
    _onDutyRange = DateTimeRange(start: widget.date, end: widget.date);
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
      if (status == AttendanceStatus.onDuty) {
        final range = _onDutyRange ?? DateTimeRange(start: widget.date, end: widget.date);
        final result = await ref.read(attendanceRepositoryProvider).markRange(
              widget.email,
              start: range.start,
              end: range.end,
              note: _noteController.text.trim(),
            );
        if (mounted) {
          Navigator.of(context).pop();
          if (result.skipped.isNotEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(
                '${result.marked.length} of ${result.marked.length + result.skipped.length} days marked - '
                '${result.skipped.length} already on approved leave.',
              ),
            ));
          }
        }
      } else {
        await ref.read(attendanceRepositoryProvider).mark(
              widget.email,
              widget.date,
              status: status.apiValue,
              note: _noteController.text.trim(),
              arrivalTime: status == AttendanceStatus.late && _arrivalTime != null
                  ? '${_arrivalTime!.hour.toString().padLeft(2, '0')}:${_arrivalTime!.minute.toString().padLeft(2, '0')}'
                  : null,
            );
        if (mounted) Navigator.of(context).pop();
      }
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

  Future<void> _pickArrivalTime() async {
    var picked = _arrivalTime ?? TimeOfDay.now();
    await showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      builder: (sheetContext) => SafeArea(
        child: SizedBox(
          height: 260,
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () {
                      setState(() => _arrivalTime = picked);
                      Navigator.of(sheetContext).pop();
                    },
                    child: const Text('Done'),
                  ),
                ],
              ),
              Expanded(
                child: CupertinoDatePicker(
                  mode: CupertinoDatePickerMode.time,
                  use24hFormat: false,
                  initialDateTime: DateTime(2020, 1, 1, picked.hour, picked.minute),
                  onDateTimeChanged: (dt) => picked = TimeOfDay(hour: dt.hour, minute: dt.minute),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickOnDutyRange() async {
    final picked = await showDateRangePicker(
      context: context,
      initialDateRange: _onDutyRange,
      firstDate: DateTime(2020),
      lastDate: DateTime(widget.date.year + 2),
    );
    if (picked != null) setState(() => _onDutyRange = picked);
  }

  @override
  Widget build(BuildContext context) {
    final status = _status;
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
                for (final s in manualAttendanceStatuses.take(3)) ...[
                  if (s != manualAttendanceStatuses.first) const SizedBox(width: 10),
                  Expanded(child: _statusOption(s)),
                ],
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: _statusOption(AttendanceStatus.nightDuty)),
                const SizedBox(width: 10),
                Expanded(child: _statusOption(AttendanceStatus.onDuty)),
                const SizedBox(width: 10),
                const Expanded(child: SizedBox()), // keeps the 3-column grid even on the second row
              ],
            ),
            if (status == AttendanceStatus.late) ...[
              const SizedBox(height: 14),
              _dock(
                child: InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: _pickArrivalTime,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                    child: Row(
                      children: [
                        Icon(Icons.schedule_rounded, size: 18, color: AppColors.statusRequested),
                        const SizedBox(width: 10),
                        Text(
                          _arrivalTime == null ? 'Set expected arrival time' : 'Arrived at ${_arrivalTime!.format(context)}',
                          style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink900),
                        ),
                        const Spacer(),
                        Icon(Icons.chevron_right_rounded, color: AppColors.ink500),
                      ],
                    ),
                  ),
                ),
              ),
            ],
            if (status == AttendanceStatus.onDuty) ...[
              const SizedBox(height: 14),
              _dock(
                child: InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: _pickOnDutyRange,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                    child: Row(
                      children: [
                        Icon(Icons.date_range_rounded, size: 18, color: AppColors.typeUmrah),
                        const SizedBox(width: 10),
                        Text(
                          _onDutyRange == null || _onDutyRange!.start == _onDutyRange!.end
                              ? 'Just ${_dayFmt.format(widget.date)} - tap to extend'
                              : '${_dayFmt.format(_onDutyRange!.start)} - ${_dayFmt.format(_onDutyRange!.end)}',
                          style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink900),
                        ),
                        const Spacer(),
                        Icon(Icons.chevron_right_rounded, color: AppColors.ink500),
                      ],
                    ),
                  ),
                ),
              ),
            ],
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

  Widget _dock({required Widget child}) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.line),
      ),
      child: child,
    );
  }

  Widget _statusOption(AttendanceStatus status) {
    final selected = _status == status;
    return GestureDetector(
      onTap: () => setState(() => _status = status),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? status.background : AppColors.surface,
          border: Border.all(color: selected ? status.foreground : AppColors.lineStrong),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          status.label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: selected ? status.foreground : AppColors.ink700,
            fontWeight: FontWeight.w700,
            fontSize: 12.5,
          ),
        ),
      ),
    );
  }
}
