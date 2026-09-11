/// One file uploaded alongside a leave request. `url` is a stable, public
/// URL served straight off the VM's disk (POST /api/attachments -
/// server/src/routes/attachments.js - saves under UPLOAD_DIR and hands back
/// `${APP_URL}/files/<generated-name>`), not a Google Drive link - that
/// moved when sign-in stopped being Google-specific (see PROJECT.md).
class Attachment {
  const Attachment({required this.name, required this.url, required this.fileId});

  /// Original filename as the developer picked it, extension included -
  /// what's shown in the UI and used to pick a file-type icon/color below.
  final String name;
  final String url;
  final String fileId;

  factory Attachment.fromMap(Map<String, dynamic> map) => Attachment(
        name: map['name'] as String? ?? '',
        url: map['url'] as String? ?? '',
        fileId: map['fileId'] as String? ?? '',
      );

  Map<String, dynamic> toMap() => {'name': name, 'url': url, 'fileId': fileId};

  String get _extension {
    final dot = name.lastIndexOf('.');
    return dot == -1 ? '' : name.substring(dot).toLowerCase();
  }

  /// Short badge label - mirrors app.js's fileIcon-by-extension mapping
  /// (styles.css .fic-*) so the same file reads the same way on web and
  /// mobile.
  String get typeLabel {
    switch (_extension) {
      case '.pdf':
        return 'PDF';
      case '.doc':
      case '.docx':
        return 'DOC';
      case '.txt':
        return 'TXT';
      case '.zip':
        return 'ZIP';
      default:
        final bare = _extension.isEmpty ? 'file' : _extension.substring(1);
        return bare.substring(0, bare.length > 4 ? 4 : bare.length).toUpperCase();
    }
  }
}
