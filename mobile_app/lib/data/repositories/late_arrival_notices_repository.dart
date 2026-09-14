import '../../core/api/api_client.dart';
import '../../core/api/realtime_client.dart';
import '../../core/api/watch_resource.dart';
import '../models/late_arrival_notice.dart';

/// Manager-only view of developers' self-filed late-arrival notices - see
/// server/src/routes/lateArrivalNotices.js. Filing a notice is a normal-user
/// action and lives on the web app instead (see PROJECT.md's manager-in-
/// mobile/normal-user-on-web split), so this repository only exposes the
/// manager's read + acknowledge.
class LateArrivalNoticesRepository {
  LateArrivalNoticesRepository({required ApiClient apiClient, required this._realtime}) : _api = apiClient;

  final ApiClient _api;
  final RealtimeClient _realtime;

  Future<List<LateArrivalNotice>> _fetchAll() async {
    final json = await _api.get('/late-arrival-notices') as List<dynamic>;
    return json.map((e) => LateArrivalNotice.fromJson(e as Map<String, dynamic>)).toList();
  }

  Stream<List<LateArrivalNotice>> watchAll() => watchResource(
        realtime: _realtime,
        resourceName: 'lateArrivalNotices',
        fetch: _fetchAll,
      );

  Future<void> acknowledge(String id) => _api.patch('/late-arrival-notices/$id/acknowledge');
}
