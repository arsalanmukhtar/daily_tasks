import 'package:flutter_test/flutter_test.dart';
import 'package:dailytasks/utils/rich_text.dart';

void main() {
  test('regroups literal bullet lines into a real <ul>', () {
    const input = 'Handover plan while I am away:\n'
        '• All pending GIS layer validation tasks for the Flood Risk Mapping project have been reassigned to Zeeshan Nasir, who has already been briefed.\n'
        '• The weekly data QA checklist has been updated in the shared drive for reference.\n'
        '\n'
        'Outstanding items expected to resume immediately upon return:\n'
        '1. Finalizing the shapefile exports for the disaster-response dashboard.\n'
        '2. Reviewing the pending pull request on the ArcGIS automation scripts.';

    final out = normalizeStoredRichText(input);
    expect(out, contains('<ul>'));
    expect(out, contains('<li>All pending GIS layer validation'));
    expect(out, contains('<ol>'));
    expect(out, contains('<li>Finalizing the shapefile exports'));
    // Markers themselves must be stripped, not just wrapped.
    expect(out, isNot(contains('• All')));
    expect(out, isNot(contains('1. Finalizing')));
  });

  test('leaves a real <ul><li> list untouched', () {
    const input = '<ul><li>Already real</li><li>Second item</li></ul>';
    expect(normalizeStoredRichText(input), contains('<li>Already real</li>'));
  });

  test('empty input stays empty', () {
    expect(normalizeStoredRichText(''), '');
  });

  test('plain text with no markers is unaffected', () {
    const input = 'Just a normal reason with no list at all.';
    expect(normalizeStoredRichText(input), contains('Just a normal reason'));
  });
}
