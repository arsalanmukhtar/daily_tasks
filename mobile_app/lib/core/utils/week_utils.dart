/// Same ISO-8601 week calculation as app.js's dateToIsoWeek_/weekLabelFromDate_
/// (app.js:703-714) - every client needs to agree on "Week N, YYYY" for a
/// given date, since it's used as part of a Firestore doc ID
/// (Submission.docIdFor) and shown as a label across all three clients.
class IsoWeek {
  const IsoWeek(this.year, this.week);
  final int year;
  final int week;

  String get label => 'Week $week, $year';
}

IsoWeek isoWeekOf(DateTime date) {
  var d = DateTime.utc(date.year, date.month, date.day);
  final dayNum = d.weekday; // Dart: Mon=1..Sun=7, already matching `|| 7` in JS
  d = d.add(Duration(days: 4 - dayNum));
  final yearStart = DateTime.utc(d.year, 1, 1);
  final week = ((d.difference(yearStart).inDays + 1) / 7).ceil();
  return IsoWeek(d.year, week);
}

String weekLabelFromDate(DateTime date) => isoWeekOf(date).label;

/// The Monday..Friday DateTimes of the week `date` falls in.
List<DateTime> weekdaysOf(DateTime date) {
  final monday = date.subtract(Duration(days: date.weekday - 1));
  return List.generate(5, (i) => DateTime(monday.year, monday.month, monday.day + i));
}
