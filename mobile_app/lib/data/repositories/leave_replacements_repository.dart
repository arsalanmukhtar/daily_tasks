import '../../core/api/api_client.dart';
import '../../core/api/realtime_client.dart';
import '../../core/api/watch_resource.dart';
import '../models/leave_replacement.dart';

/// GET/PATCH /api/leave-replacements - manager-only reassignment lives here
/// (see server/src/routes/leaveReplacements.js); accept/reject are the
/// replacement's own action and belong to the web app instead (see
/// PROJECT.md's manager-in-mobile/normal-user-on-web split), so this
/// repository only exposes what the mobile manager UI actually needs:
/// viewing every replacement and reassigning one while it's still pending
/// or was rejected.
class LeaveReplacementsRepository {
  LeaveReplacementsRepository({required ApiClient apiClient, required this._realtime}) : _api = apiClient;

  final ApiClient _api;
  final RealtimeClient _realtime;

  Future<List<LeaveReplacement>> _fetchAll() async {
    final json = await _api.get('/leave-replacements') as List<dynamic>;
    return json.map((e) => LeaveReplacement.fromJson(e as Map<String, dynamic>)).toList();
  }

  Stream<List<LeaveReplacement>> watchAll() => watchResource(
        realtime: _realtime,
        resourceName: 'leaveReplacements',
        fetch: _fetchAll,
      );

  Future<void> reassign(String replacementId, String newReplacementEmail) {
    return _api.patch('/leave-replacements/$replacementId', {'replacementEmail': newReplacementEmail});
  }
}
