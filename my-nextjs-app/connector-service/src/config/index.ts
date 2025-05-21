import dotenv from 'dotenv';

dotenv.config();

interface AppConfig {
  NODE_ENV: string;
  PORT: number;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string; // Optional, for admin operations
  VAULT_ADDR?: string;
  VAULT_TOKEN?: string;
  ENCRYPTION_KEY?: string; // Added for data encryption
  // Add other necessary environment variables here
}

const config: AppConfig = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  VAULT_ADDR: process.env.VAULT_ADDR,
  VAULT_TOKEN: process.env.VAULT_TOKEN,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY, // Added
};

// Validate essential configurations
if (!config.SUPABASE_URL) {
  console.error("FATAL ERROR: SUPABASE_URL is not defined.");
  process.exit(1);
}

if (!config.SUPABASE_ANON_KEY) {
  console.error("FATAL ERROR: SUPABASE_ANON_KEY is not defined.");
  process.exit(1);
}

// It's crucial that ENCRYPTION_KEY is set for production if encryption is used.
// For local dev, crypto.ts has a fallback/warning, but production should fail hard.
if (config.NODE_ENV === 'production' && !config.ENCRYPTION_KEY) {
  console.error("FATAL ERROR: ENCRYPTION_KEY is not defined in production environment.");
  process.exit(1);
}


export default config;