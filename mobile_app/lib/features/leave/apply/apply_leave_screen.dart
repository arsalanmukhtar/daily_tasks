import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/utils/week_utils.dart';
import '../../../data/models/leave_type.dart';
import '../../../data/providers.dart';
import '../../../widgets/rich_text_editor.dart';

final _dateFormat = DateFormat('d MMM yyyy');

/// Mirrors the web app's Apply-for-Leave drawer (app.js's leaveSendBtn
/// handler, app.js:2659-2730) - same 6 selectable types, same
/// half-day/out-pass conditional fields, same rich-text reason.
///
/// v1 scope note: attachments (Drive upload) are wired in
/// AttachmentRepository but not yet hooked into this form's UI - see
/// PROJECT.md's build order. Custom (non-contiguous) multi-date picking is
/// also deferred; this screen covers a single day or a contiguous range,
/// which is what every leave type other than Casual actually needs.
class ApplyLeaveScreen extends ConsumerStatefulWidget {
  const ApplyLeaveScreen({required this.email, required this.name, super.key});

  final String email;
  final String name;

  @override
  ConsumerState<ApplyLeaveScreen> createState() => _ApplyLeaveScreenState();
}

class _ApplyLeaveScreenState extends ConsumerState<ApplyLeaveScreen> {
  LeaveType _type = LeaveType.casualShort;
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();
  String _halfDayPeriod = 'AM';
  TimeOfDay _shortLeaveTime = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _checkOutTime = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _checkInTime = const TimeOfDay(hour: 12, minute: 0);
  final _reasonController = RichTextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  String _formatTime(TimeOfDay t) {
    final hour = t.hourOfPeriod == 0 ? 12 : t.hourOfPeriod;
    final minute = t.minute.toString().padLeft(2, '0');
    return '$hour:$minute ${t.period == DayPeriod.am ? 'AM' : 'PM'}';
  }

  Future<void> _pickDate() async {
    if (_type == LeaveType.casualShort) {
      // Short leave is always a single day.
      final picked = await showDatePicker(
        context: context,
        initialDate: _startDate,
        firstDate: DateTime.now().subtract(const Duration(days: 365)),
        lastDate: DateTime.now().add(const Duration(days: 365)),
      );
      if (picked != null) setState(() => _startDate = _endDate = picked);
      return;
    }
    final picked = await showDateRangePicker(
      context: context,
      initialDateRange: DateTimeRange(start: _startDate, end: _endDate),
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        _startDate = picked.start;
        _endDate = picked.end;
      });
    }
  }

  Future<void> _submit() async {
    if (_type == LeaveType.casualOutPass) {
      final checkOut = _checkOutTime.hour * 60 + _checkOutTime.minute;
      final checkIn = _checkInTime.hour * 60 + _checkInTime.minute;
      if (checkOut >= checkIn) {
        setState(() => _error = 'Check-in time must be after check-out time.');
        return;
      }
    }
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      final weekLabel = weekLabelFromDate(_startDate);
      await ref.read(leaveRepositoryProvider).createLeaveRequest(
            email: widget.email,
            name: widget.name,
            type: _type,
            weekLabel: weekLabel,
            startDate: _startDate,
            endDate: _endDate,
            reasonHtml: _reasonController.html,
            halfDayPeriod: _type == LeaveType.casualShort ? _halfDayPeriod : '',
            shortLeaveTime: _type == LeaveType.casualShort ? _formatTime(_shortLeaveTime) : '',
            checkOutTime: _type == LeaveType.casualOutPass ? _formatTime(_checkOutTime) : '',
            checkInTime: _type == LeaveType.casualOutPass ? _formatTime(_checkInTime) : '',
          );
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not submit - please try again.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sameDay = _startDate.year == _endDate.year && _startDate.month == _endDate.month && _startDate.day == _endDate.day;
    return Scaffold(
      appBar: AppBar(title: const Text('Apply for Leave')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Leave type', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          DropdownButtonFormField<LeaveType>(
            initialValue: _type,
            items: [
              for (final t in LeaveType.selectable) DropdownMenuItem(value: t, child: Text(t.label)),
            ],
            onChanged: (t) {
              if (t == null) return;
              setState(() {
                _type = t;
                if (t == LeaveType.casualShort) _endDate = _startDate;
              });
            },
          ),
          const SizedBox(height: 16),
          Text(sameDay ? 'Date' : 'Dates', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: _pickDate,
            icon: const Icon(Icons.calendar_today, size: 16),
            label: Text(sameDay
                ? _dateFormat.format(_startDate)
                : '${_dateFormat.format(_startDate)} - ${_dateFormat.format(_endDate)}'),
          ),
          if (_type == LeaveType.casualShort) ...[
            const SizedBox(height: 16),
            Text('Half day', style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'AM', label: Text('AM')),
                ButtonSegment(value: 'PM', label: Text('PM')),
              ],
              selected: {_halfDayPeriod},
              onSelectionChanged: (s) => setState(() => _halfDayPeriod = s.first),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () async {
                final picked = await showTimePicker(context: context, initialTime: _shortLeaveTime);
                if (picked != null) setState(() => _shortLeaveTime = picked);
              },
              icon: const Icon(Icons.access_time, size: 16),
              label: Text('Start time: ${_formatTime(_shortLeaveTime)}'),
            ),
          ],
          if (_type == LeaveType.casualOutPass) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final picked = await showTimePicker(context: context, initialTime: _checkOutTime);
                      if (picked != null) setState(() => _checkOutTime = picked);
                    },
                    icon: const Icon(Icons.logout, size: 16),
                    label: Text('Out: ${_formatTime(_checkOutTime)}'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final picked = await showTimePicker(context: context, initialTime: _checkInTime);
                      if (picked != null) setState(() => _checkInTime = picked);
                    },
                    icon: const Icon(Icons.login, size: 16),
                    label: Text('In: ${_formatTime(_checkInTime)}'),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 16),
          Text('Reason', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          RichTextEditor(controller: _reasonController, placeholder: 'Why are you applying for leave?'),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: AppColors.statusRejected, fontSize: 12)),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              child: _isSubmitting
                  ? const SizedBox(
                      width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Submit request'),
            ),
          ),
        ],
      ),
    );
  }
}
