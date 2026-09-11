import 'package:html/dom.dart' as dom;
import 'package:html/parser.dart' as html_parser;

// Some already-stored reason/explanation/resolution/rejection HTML never
// went through the web editor's toolbar (or its paste-cleaning) - it was
// pasted as plain text with no HTML on the clipboard (e.g. a reason drafted
// elsewhere and copied in), so it's really just paragraph text whose lines
// happen to start with a literal "•"/"-"/"1." character instead of a real
// <ul>/<ol>. Rendered as-is, only the first visual line of a wrapped
// paragraph lines up with that marker - every wrapped continuation line
// falls back to the left margin, since there's no actual list for any
// renderer (web or mobile) to hang-indent.
//
// This retroactively regroups literal marker lines into real <ul>/<ol>
// before HtmlWidget ever sees the markup, so its normal list layout
// (confirmed indenting wrapped lines correctly once given a real <li>)
// applies the same way it would to a list built with the toolbar. Mirrors
// app.js's sanitizeStoredRichTextHtml_ - same bug, same fix, kept in sync
// since both clients render the exact same stored HTML.
final _bulletMarkerRe = RegExp(r'^[•\-\*]\s+');
final _numberedMarkerRe = RegExp(r'^\d+[.)]\s+');

String normalizeStoredRichText(String html) {
  if (html.trim().isEmpty) return html;
  final fragment = html_parser.parseFragment(html);
  _splitNewlinesIntoBr(fragment);
  _groupMarkerLinesIntoList(fragment, _bulletMarkerRe, 'ul');
  _groupMarkerLinesIntoList(fragment, _numberedMarkerRe, 'ol');
  return fragment.outerHtml;
}

/// A plain-text paste with no clipboard HTML lands as one Text node holding
/// literal "\n"s. Splitting those into real <br> siblings first means the
/// line-grouping pass below only ever has to reason about <br>/<div>/<p>
/// boundaries, matching what a real contenteditable would have produced.
void _splitNewlinesIntoBr(dom.Node root) {
  for (final node in List<dom.Node>.from(root.nodes)) {
    if (node is! dom.Text || !node.data.contains('\n')) continue;
    final parts = node.data.split('\n');
    for (var i = 0; i < parts.length; i++) {
      if (i > 0) root.insertBefore(dom.Element.tag('br'), node);
      if (parts[i].isNotEmpty) {
        root.insertBefore(dom.Text(parts[i]), node);
      }
    }
    node.remove();
  }
}

class _Line {
  _Line(this.contentNodes, this.allNodes);
  final List<dom.Node> contentNodes;
  final List<dom.Node> allNodes;
}

/// Splits `container`'s direct children into logical lines: a <div>/<p>
/// child is one line by itself, and a run of inline nodes at the top level
/// (text, <b>, <a>, ...) delimited by <br> is one line too.
List<_Line> _computeLines(dom.Node container) {
  final lines = <_Line>[];
  var contentNodes = <dom.Node>[];
  var allNodes = <dom.Node>[];
  void flush() {
    if (contentNodes.isNotEmpty || allNodes.isNotEmpty) {
      lines.add(_Line(contentNodes, allNodes));
    }
    contentNodes = <dom.Node>[];
    allNodes = <dom.Node>[];
  }

  for (final node in List<dom.Node>.from(container.nodes)) {
    final localName = node is dom.Element ? node.localName : null;
    if (localName == 'div' || localName == 'p') {
      flush();
      lines.add(_Line(List<dom.Node>.from(node.nodes), [node]));
      continue;
    }
    if (localName == 'br') {
      allNodes.add(node);
      flush();
      continue;
    }
    contentNodes.add(node);
    allNodes.add(node);
  }
  flush();
  return lines;
}

void _groupMarkerLinesIntoList(dom.Node container, RegExp markerRe, String listTag) {
  final lines = _computeLines(container);
  var i = 0;
  while (i < lines.length) {
    final match = _leadingMarkerMatch(lines[i], markerRe);
    if (match == null) {
      i++;
      continue;
    }
    final run = <(_Line, Match)>[(lines[i], match)];
    var j = i + 1;
    while (j < lines.length) {
      final m = _leadingMarkerMatch(lines[j], markerRe);
      if (m == null) break;
      run.add((lines[j], m));
      j++;
    }

    // Insert the (still-empty) list before anything moves - once a line's
    // content nodes get appended into an <li> below, they're detached from
    // `container` and can no longer serve as an insertion anchor.
    final list = dom.Element.tag(listTag);
    container.insertBefore(list, run.first.$1.allNodes.first);

    for (final (line, marker) in run) {
      final li = dom.Element.tag('li');
      final first = line.contentNodes.first as dom.Text;
      first.data = first.data.substring(marker[0]!.length);
      for (final n in line.contentNodes) {
        li.append(n); // moves n out of its current parent into li
      }
      list.append(li);
      for (final n in line.allNodes) {
        if (n.parentNode == container) n.remove(); // leftover <br>, if any
      }
    }
    i = j;
  }
}

Match? _leadingMarkerMatch(_Line line, RegExp markerRe) {
  if (line.contentNodes.isEmpty) return null;
  final first = line.contentNodes.first;
  if (first is! dom.Text) return null;
  return markerRe.firstMatch(first.data);
}
