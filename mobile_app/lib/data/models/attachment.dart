/// Mirrors android-app's data/LeaveRequest.kt Attachment - a file already
/// uploaded to the requester's own Google Drive (drive.file scope), not a
/// local file reference.
class Attachment {
  const Attachment({required this.name, required this.url, required this.fileId});

  final String name;
  final String url;
  final String fileId;

  factory Attachment.fromMap(Map<String, dynamic> map) => Attachment(
        name: map['name'] as String? ?? '',
        url: map['url'] as String? ?? '',
        fileId: map['fileId'] as String? ?? '',
      );

  Map<String, dynamic> toMap() => {'name': name, 'url': url, 'fileId': fileId};
}
