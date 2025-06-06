import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) => AuthNotifier());

class AuthNotifier extends StateNotifier<AuthState> {
  final _storage = const FlutterSecureStorage();
  final _supabase = Supabase.instance.client;

  AuthNotifier() : super(const AuthState.unauthenticated()) {
    _checkTokenRotation();
  }

  Future<void> login(String token) async {
    await _storage.write(key: 'auth_token', value: token);
    await _storage.write(key: 'token_issued', value: DateTime.now().toIso8601String());
    state = AuthState.authenticated(token);
  }

  Future<String?> getToken() async {
    return await _storage.read(key: 'auth_token');
  }

  Future<void> _checkTokenRotation() async {
    final issued = await _storage.read(key: 'token_issued');
    if (issued == null) return;
    final issuedDate = DateTime.parse(issued);
    if (DateTime.now().difference(issuedDate).inDays >= 7) {
      try {
        final newToken = await _supabase.rpc('rotate_token');
        await login(newToken);
      } catch (error) {
        state = AuthState.unauthenticated();
      }
    }
  }
}

// Placeholder for AuthState enum/class
enum AuthState {
  authenticated(null),
  unauthenticated(null);

  final String? token;
  const AuthState(this.token);
}
