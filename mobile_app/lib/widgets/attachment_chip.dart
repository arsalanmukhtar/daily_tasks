import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/theme/app_colors.dart';
import '../data/models/attachment.dart';

/// One row for an uploaded attachment - a paperclip-style file-type badge,
/// the original filename, and an open-in-new icon. Tapping hands the file's
/// URL to the OS (LaunchMode.externalApplication) so it opens in whatever
/// the device already uses for that file type - Chrome/a PDF viewer on
/// Android, Safari/QuickLook on iOS - rather than trying to render it
/// in-app.
class AttachmentChip extends StatelessWidget {
  const AttachmentChip({required this.attachment, super.key});

  final Attachment attachment;

  Future<void> _open(BuildContext context) async {
    final uri = Uri.tryParse(attachment.url);
    if (uri == null) return;
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open this attachment.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final badgeColor = AppColors.forFileType(attachment.typeLabel);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: () => _open(context),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: badgeColor, borderRadius: BorderRadius.circular(7)),
                  child: Icon(Icons.attach_file_rounded, size: 15, color: Colors.white),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    attachment.name.isEmpty ? 'Attachment' : attachment.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
                  ),
                ),
                const SizedBox(width: 8),
                Icon(Icons.open_in_new_rounded, size: 16, color: AppColors.ink500),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
