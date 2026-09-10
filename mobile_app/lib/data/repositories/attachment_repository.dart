import 'dart:typed_data';

import '../../core/api/api_client.dart';
import '../models/attachment.dart';

/// Uploads a leave attachment to the server's own disk via a multipart
/// POST /api/attachments - replaces the old direct-to-Drive flow entirely
/// (no more `drive.file` OAuth scope, no Google Sign-In dependency for
/// this). Mirrors the web app's uploadAttachment_().
class AttachmentRepository {
  AttachmentRepository({required ApiClient apiClient}) : _api = apiClient;

  final ApiClient _api;

  Future<Attachment> upload({required String fileName, required Uint8List bytes}) async {
    final json = await _api.uploadAttachment(fileName: fileName, bytes: bytes);
    return Attachment(
      name: json['name'] as String? ?? fileName,
      url: json['url'] as String? ?? '',
      fileId: json['fileId'] as String? ?? '',
    );
  }
}
