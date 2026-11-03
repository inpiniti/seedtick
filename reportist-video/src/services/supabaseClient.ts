// src/services/supabaseClient.ts - Supabase Client Initialization for Reportist Video
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 기본 Supabase URL 및 anon 키 (reportist-admin과 동일한 프로젝트 공유)
const DEFAULT_SUPABASE_URL = 'https://chlnkringpqsqtozuvah.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNobG5rcmluZ3Bxc3F0b3p1dmFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDEzNDg3MSwiZXhwIjoyMTA1NzEwODcxfQ.cLoBWdTBcBRLLC7bvPikEDJ_EDtIyMTObAbWGM2Ls94';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
