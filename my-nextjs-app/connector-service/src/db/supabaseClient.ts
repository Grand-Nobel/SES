import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from 'config';
import logger from 'utils/logger';

let supabase: SupabaseClient | null = null;

try {
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    logger.error('Supabase URL or Anon Key is not defined. Supabase client will not be initialized.');
    throw new Error('Supabase URL or Anon Key is not defined.');
  }

  // Prefer service_role_key if available for server-side operations,
  // otherwise fall back to anon_key.
  // Ensure RLS policies are appropriately set up for the key being used.
  const supabaseKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY;

  supabase = createClient(config.SUPABASE_URL, supabaseKey, {
    // auth: {
    //   persistSession: false, // Typically true for client-side, false for server-side
    //   autoRefreshToken: false, // Typically true for client-side, false for server-side
    //   detectSessionInUrl: false, // Typically true for client-side, false for server-side
    // },
  });

  logger.info('Supabase client initialized successfully.');

} catch (error) {
  logger.error({ error }, 'Failed to initialize Supabase client.');
  // Depending on the application's needs, you might want to exit or handle this differently.
  // For now, we allow the app to start, but operations requiring Supabase will fail.
}

export default supabase;