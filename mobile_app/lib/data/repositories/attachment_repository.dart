import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../models/attachment.dart';

/// Uploads a leave attachment straight to the requester's own Google Drive
/// using the `drive.file` OAuth token from AuthRepository.driveAccessToken(),
/// then shares it "anyone with the link can view" - a direct port of
/// app.js's uploadAttachmentToDrive_() (app.js:2612-2657), not a Firebase
/// Storage integration (there isn't one in this project - see README.md).
class AttachmentRepository {
  static const _uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
  static const _driveFilesUrl = 'https://www.googleapis.com/drive/v3/files';

  Future<Attachment> upload({
    required String accessToken,
    required String fileName,
    required String mimeType,
    required Uint8List bytes,
  }) async {
    final boundary = 'techew-${DateTime.now().millisecondsSinceEpoch}';
    final base64Data = base64Encode(bytes);
    final body = '--$boundary\r\n'
        'Content-Type: application/json; charset=UTF-8\r\n\r\n'
        '${jsonEncode({'name': fileName, 'mimeType': mimeType})}\r\n'
        '--$boundary\r\n'
        'Content-Type: $mimeType\r\n'
        'Content-Transfer-Encoding: base64\r\n\r\n'
        '$base64Data\r\n'
        '--$boundary--';

    final uploadRes = await http.post(
      Uri.parse(_uploadUrl),
      headers: {
        'Authorization': 'Bearer $accessToken',
        'Content-Type': 'multipart/related; boundary=$boundary',
      },
      body: body,
    );
    if (uploadRes.statusCode < 200 || uploadRes.statusCode >= 300) {
      String reason = '';
      try {
        reason = (jsonDecode(uploadRes.body)['error']['message'] as String?) ?? '';
      } catch (_) {
        // response wasn't JSON - leave reason empty
      }
      throw Exception('Drive upload failed (${uploadRes.statusCode})${reason.isNotEmpty ? ': $reason' : ''}');
    }
    final fileId = jsonDecode(uploadRes.body)['id'] as String;

    await http.post(
      Uri.parse('$_driveFilesUrl/$fileId/permissions'),
      headers: {'Authorization': 'Bearer $accessToken', 'Content-Type': 'application/json'},
      body: jsonEncode({'role': 'reader', 'type': 'anyone'}),
    );

    final metaRes = await http.get(
      Uri.parse('$_driveFilesUrl/$fileId?fields=webViewLink'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    final webViewLink = jsonDecode(metaRes.body)['webViewLink'] as String?;

    return Attachment(
      name: fileName,
      url: webViewLink ?? 'https://drive.google.com/file/d/$fileId/view',
      fileId: fileId,
    );
  }
}
