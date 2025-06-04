import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:workmanager/workmanager.dart';

void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    final storage = FlutterSecureStorage();
    final token = await storage.read(key: 'auth_token');
    if (token == null) return false;

    final supabase = Supabase.instance.client;
    try {
      final newToken = await supabase.rpc('rotate_token');
      await storage.write(key: 'auth_token', value: newToken);
      await supabase.rpc('notify_admin', { user_id: inputData!['userId'] });
      return true;
    } catch (error) {
      return false;
    }
  });
}

void scheduleBackgroundTask(String userId) {
  Workmanager().registerPeriodicTask(
    'auth-refresh',
    'refreshToken',
    inputData: {'userId': userId},
    frequency: Duration(hours: 24),
  );
}
