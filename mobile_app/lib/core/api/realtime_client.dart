import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'auth_token_store.dart';

/// A `{resource, id}` pointer event, e.g. `{resource: 'leaveRequests', id:
/// '42'}` - the server never sends the changed data itself, only a pointer
/// telling listeners to refetch that resource (see server/src/realtime.js).
class RealtimeEvent {
  RealtimeEvent(this.resource, this.id);
  final String resource;
  final String id;

  factory RealtimeEvent.fromJson(Map<String, dynamic> json) =>
      RealtimeEvent(json['resource'] as String, json['id'] as String);
}

/// WebSocket client mirroring app.js's connectRealtime_() - replaces
/// Firestore's onSnapshot listeners. Every repository subscribes to
/// [events] and re-fetches whatever resource it owns when a matching event
/// arrives; this class only ever hands out pointers, never data.
///
/// Reconnects on close/error with a fixed backoff, and reconnects when the
/// app resumes from the background - a backgrounded app suspends its socket
/// the same way a hidden browser tab does, so `WidgetsBindingObserver` here
/// plays the role app.js's `visibilitychange` listener plays on the web.
class RealtimeClient with WidgetsBindingObserver {
  RealtimeClient({required this.wsBaseUrl, required this.tokenStore});

  /// e.g. ws://182.188.28.163:4500/ws - no trailing slash, no query string.
  final String wsBaseUrl;
  final AuthTokenStore tokenStore;

  final _controller = StreamController<RealtimeEvent>.broadcast();
  Stream<RealtimeEvent> get events => _controller.stream;

  WebSocketChannel? _channel;
  Timer? _reconnectTimer;
  bool _disposed = false;

  Future<void> start() async {
    WidgetsBinding.instance.addObserver(this);
    await _connect();
  }

  Future<void> _connect() async {
    if (_disposed) return;
    final token = await tokenStore.read();
    if (token == null) return;

    _reconnectTimer?.cancel();
    await _channel?.sink.close();

    final uri = Uri.parse('$wsBaseUrl?token=${Uri.encodeComponent(token)}');
    final channel = WebSocketChannel.connect(uri);
    _channel = channel;

    channel.stream.listen(
      (message) {
        try {
          final json = jsonDecode(message as String) as Map<String, dynamic>;
          _controller.add(RealtimeEvent.fromJson(json));
        } catch (_) {
          // Ignore malformed frames rather than crashing the listener.
        }
      },
      onDone: () => _scheduleReconnect(channel),
      onError: (_) => _scheduleReconnect(channel),
      cancelOnError: true,
    );
  }

  void _scheduleReconnect(WebSocketChannel supersededChannel) {
    if (_disposed || _channel != supersededChannel) return; // superseded already
    _reconnectTimer = Timer(const Duration(seconds: 5), _connect);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _connect();
    }
  }

  Future<void> dispose() async {
    _disposed = true;
    WidgetsBinding.instance.removeObserver(this);
    _reconnectTimer?.cancel();
    await _channel?.sink.close();
    await _controller.close();
  }
}
