import '../../core/api/api_client.dart';
import '../models/allowlist_entry.dart';

/// The full team roster - GET /api/users, mirrors AllowlistRepository.listAll()
/// in the Kotlin app. Only needed by manager screens (developer picker
/// dropdowns, filters) - the original developer-only Flutter scaffold never
/// needed the whole roster.
class UsersRepository {
  UsersRepository({required ApiClient apiClient}) : _api = apiClient;

  final ApiClient _api;

  Future<List<AllowlistEntry>> listAll() async {
    final json = await _api.get('/users') as List<dynamic>;
    return json.map((e) => AllowlistEntry.fromJson(e as Map<String, dynamic>)).toList();
  }
}
