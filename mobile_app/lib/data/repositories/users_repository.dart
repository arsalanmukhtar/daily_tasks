import '../../core/api/api_client.dart';
import '../../core/api/realtime_client.dart';
import '../../core/api/watch_resource.dart';
import '../models/allowlist_entry.dart';

/// The full team roster - GET /api/users, mirrors AllowlistRepository.listAll()
/// in the Kotlin app. Also backs the Team tab's directory (view/edit any
/// profile, including the manager's own - see server/src/routes/users.js's
/// PATCH /:email and its self-lockout guard).
class UsersRepository {
  UsersRepository({required ApiClient apiClient, required this._realtime}) : _api = apiClient;

  final ApiClient _api;
  final RealtimeClient _realtime;

  Future<List<AllowlistEntry>> listAll() async {
    final json = await _api.get('/users') as List<dynamic>;
    return json.map((e) => AllowlistEntry.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<AllowlistEntry> getOne(String email) async {
    final json = await _api.get('/users/${Uri.encodeComponent(email)}') as Map<String, dynamic>;
    return AllowlistEntry.fromJson(json);
  }

  /// Manager-only - see PATCH /api/users/:email. Only the fields actually
  /// passed are sent, so a partial edit never clobbers the rest server-side
  /// either (belt and suspenders with the route's own whitelist).
  Future<AllowlistEntry> updateUser(
    String email, {
    String? name,
    String? designation,
    String? reportedTo,
    String? domain,
    bool? isOwner,
    bool? active,
  }) async {
    final body = <String, dynamic>{
      if (name != null) 'name': name,
      if (designation != null) 'designation': designation,
      if (reportedTo != null) 'reportedTo': reportedTo,
      if (domain != null) 'domain': domain,
      if (isOwner != null) 'isOwner': isOwner,
      if (active != null) 'active': active,
    };
    final json = await _api.patch('/users/${Uri.encodeComponent(email)}', body) as Map<String, dynamic>;
    return AllowlistEntry.fromJson(json);
  }

  /// Refetches on any 'users' broadcast (see UsersRepository.updateUser /
  /// server's PATCH route) - so an edit made from one manager's Team tab
  /// shows up live on every other open screen that reads the roster.
  Stream<List<AllowlistEntry>> watchAll() => watchResource(
        realtime: _realtime,
        resourceName: 'users',
        fetch: listAll,
      );
}
