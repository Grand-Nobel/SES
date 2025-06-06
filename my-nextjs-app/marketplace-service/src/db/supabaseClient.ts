import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config(); // Load environment variables

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
// const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // For admin operations

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    // auth: {
    //   persistSession: false, // Typically true for client-side, false for server-side if using service_role key
    //   autoRefreshToken: false, // Typically true for client-side
    // },
    // global: {
    //   headers: { 'X-Client-Info': 'marketplace-service' },
    // },
  });
  logger.info('Supabase client initialized for marketplace-service.');
} else {
  logger.error('Supabase URL or Anon Key is missing. Supabase client not initialized for marketplace-service.');
  // Depending on the application's needs, you might want to throw an error here
  // or allow the application to run in a degraded mode if Supabase is optional.
  // For a service relying on Supabase, throwing an error is often appropriate.
  // throw new Error('Supabase URL or Anon Key is not configured.');
}

export default supabase;