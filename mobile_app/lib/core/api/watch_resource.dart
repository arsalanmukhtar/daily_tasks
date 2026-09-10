import 'dart:async';

import 'realtime_client.dart';

/// Builds a `Stream<List<T>>` that fetches once on first listen and
/// re-fetches whenever [realtime] broadcasts a matching `{resource, id}`
/// event - the REST+WebSocket equivalent of a Firestore collection
/// snapshot listener. Used by every repository that used to expose a
/// `Stream<List<T>>` backed by `.snapshots()`, so screens built against
/// that stream need no changes.
Stream<List<T>> watchResource<T>({
  required RealtimeClient realtime,
  required String resourceName,
  required Future<List<T>> Function() fetch,
}) {
  late final StreamController<List<T>> controller;
  StreamSubscription<RealtimeEvent>? subscription;

  Future<void> refresh() async {
    try {
      controller.add(await fetch());
    } catch (error, stackTrace) {
      controller.addError(error, stackTrace);
    }
  }

  controller = StreamController<List<T>>.broadcast(
    onListen: () {
      refresh();
      subscription = realtime.events.where((e) => e.resource == resourceName).listen((_) => refresh());
    },
    onCancel: () => subscription?.cancel(),
  );
  return controller.stream;
}
