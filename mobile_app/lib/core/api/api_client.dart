import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth_token_store.dart';

/// Thrown for any non-2xx response - `message` is the server's own
/// `{error}` text where available, so it's safe to show directly in the UI
/// (mirrors app.js's apiRequest_() throwing Error(json.error)).
class ApiException implements Exception {
  const ApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

/// Thin REST wrapper around the self-hosted API that replaced Firebase -
/// see server/ and PROJECT.md's web-cutover notes. Mirrors app.js's
/// apiRequest_(): attaches the stored JWT, JSON in/out, throws ApiException
/// on any non-2xx response.
class ApiClient {
  ApiClient({required this.baseUrl, required this.tokenStore});

  /// e.g. http://182.188.28.163:4500/api - no trailing slash.
  final String baseUrl;
  final AuthTokenStore tokenStore;

  Future<dynamic> get(String path) => _request('GET', path);
  Future<dynamic> post(String path, [Map<String, dynamic>? body]) => _request('POST', path, body);
  Future<dynamic> patch(String path, [Map<String, dynamic>? body]) => _request('PATCH', path, body);
  Future<dynamic> put(String path, [Map<String, dynamic>? body]) => _request('PUT', path, body);

  Future<dynamic> _request(String method, String path, [Map<String, dynamic>? body]) async {
    final token = await tokenStore.read();
    final headers = <String, String>{
      if (token != null) 'Authorization': 'Bearer $token',
      if (body != null) 'Content-Type': 'application/json',
    };
    final uri = Uri.parse('$baseUrl$path');

    http.Response response;
    try {
      response = switch (method) {
        'GET' => await http.get(uri, headers: headers),
        'POST' => await http.post(uri, headers: headers, body: body != null ? jsonEncode(body) : null),
        'PATCH' => await http.patch(uri, headers: headers, body: body != null ? jsonEncode(body) : null),
        'PUT' => await http.put(uri, headers: headers, body: body != null ? jsonEncode(body) : null),
        _ => throw ApiException('Unsupported method: $method'),
      };
    } catch (_) {
      throw const ApiException('Could not reach the server. Check your connection and try again.');
    }

    Map<String, dynamic>? json;
    if (response.body.isNotEmpty) {
      try {
        json = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (_) {
        json = null;
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException((json?['error'] as String?) ?? 'Request failed (${response.statusCode}).');
    }
    // Some responses (e.g. GET list endpoints) are a JSON array, not object -
    // jsonDecode already handles that; only the object-shaped error check
    // above needed the Map cast.
    return json ?? jsonDecode(response.body);
  }

  /// Multipart upload for POST /api/attachments - separate from `_request`
  /// since it needs a different content-type/body shape than JSON calls.
  Future<Map<String, dynamic>> uploadAttachment({
    required String fileName,
    required List<int> bytes,
  }) async {
    final token = await tokenStore.read();
    final uri = Uri.parse('$baseUrl/attachments');
    final request = http.MultipartRequest('POST', uri)
      ..headers.addAll({if (token != null) 'Authorization': 'Bearer $token'})
      ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: fileName));

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    final json = response.body.isNotEmpty ? jsonDecode(response.body) as Map<String, dynamic> : <String, dynamic>{};
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException((json['error'] as String?) ?? 'Upload failed (${response.statusCode}).');
    }
    return json;
  }
}
