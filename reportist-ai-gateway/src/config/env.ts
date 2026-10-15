export interface EnvConfig {
  gatewaySecret: string;
  clineKeys: string[];
  kiloKeys: string[];
  openrouterKeys: string[];
  geminiKeys: string[];
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  geminiResetHour: number;
  clineResetHour: number;
  kiloResetHour: number;
  openrouterResetHour: number;
}

function parseKeys(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

function parseIntOrDefault(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export function loadEnv(): EnvConfig {
  return {
    gatewaySecret: process.env.GATEWAY_SECRET ?? '',
    clineKeys: parseKeys(process.env.CLINE_API_KEY),
    kiloKeys: parseKeys(process.env.KILO_API_KEY),
    openrouterKeys: parseKeys(process.env.OPENROUTER_API_KEY),
    geminiKeys: parseKeys(process.env.GEMINI_API_KEY),
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    geminiResetHour: parseIntOrDefault(process.env.GEMINI_RESET_HOUR, 8),
    clineResetHour: parseIntOrDefault(process.env.CLINE_RESET_HOUR, 0),
    kiloResetHour: parseIntOrDefault(process.env.KILO_RESET_HOUR, 0),
    openrouterResetHour: parseIntOrDefault(process.env.OPENROUTER_RESET_HOUR, 0),
  };
}

export const env = loadEnv();

export function validateEnv(): string[] {
  const errors: string[] = [];
  if (!env.gatewaySecret) errors.push('GATEWAY_SECRET is required');
  if (env.openrouterKeys.length === 0) errors.push('At least one OPENROUTER_API_KEY is required');
  if (!env.supabaseUrl) errors.push('SUPABASE_URL is required');
  if (!env.supabaseServiceRoleKey) errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
  return errors;
}
