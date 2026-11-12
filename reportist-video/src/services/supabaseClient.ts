// src/services/supabaseClient.ts - Supabase Client Initialization for Reportist Video
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 기본 Supabase URL 및 anon 키 (reportist-admin과 동일한 프로젝트 공유)
// 기본 Supabase URL (익명 키는 반드시 VITE_SUPABASE_ANON_KEY 환경 변수로 주입되어야 합니다)
const DEFAULT_SUPABASE_URL = 'https://chlnkringpqsqtozuvah.supabase.co';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
