// [임시 차단] Kilo 제공사 키는 당분간 요청에 사용하지 않는다.
// Kilo 키 전역이 쿨다운/할당량 소진 상태로 잡혀 응답이 지연되어 비활성화한다.
// 재개 시 이 값을 false로 바꾸고 `bun run build`로 api/index.js 번들을 다시 생성하면 된다.
const KILO_KEYS_DISABLED = true;

export interface EnvConfig {
  gatewaySecret: string;
  clineKeys: string[];
  kiloKeys: string[];
  openrouterKeys: string[];
  geminiKeys: string[];
  opencodeKeys: string[];
  opencodeBaseUrl: string;
}

function parseKeys(...values: (string | undefined)[]): string[] {
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const parts = value
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    result.push(...parts);
  }
  return [...new Set(result)];
}

export function loadEnv(): EnvConfig {
  return {
    gatewaySecret: process.env.GATEWAY_SECRET ?? '',
    clineKeys: parseKeys(process.env.CLINE_API_KEY, process.env.CLINE_API_KEYS),
    // 환경 변수가 설정되어 있어도 임시 차단 기간에는 빈 목록으로 로드해 사용을 막는다.
    kiloKeys: KILO_KEYS_DISABLED
      ? []
      : parseKeys(process.env.KILO_API_KEY, process.env.KILO_API_KEYS),
    openrouterKeys: parseKeys(process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_API_KEYS),
    geminiKeys: parseKeys(process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEYS),
    opencodeKeys: parseKeys(process.env.OPENCODE_API_KEY, process.env.OPENCODE_API_KEYS),
    opencodeBaseUrl: process.env.OPENCODE_BRIDGE_URL ?? 'http://127.0.0.1:4096/v1/chat/completions',
  };
}

export const env = loadEnv();

export function validateEnv(): string[] {
  const errors: string[] = [];
  if (!env.gatewaySecret) errors.push('GATEWAY_SECRET is required');
  if (env.openrouterKeys.length === 0 && env.kiloKeys.length === 0) {
    errors.push(
      KILO_KEYS_DISABLED
        ? 'At least one OPENROUTER_API_KEY is required (KILO keys are temporarily disabled)'
        : 'At least one OPENROUTER_API_KEY or KILO_API_KEY is required'
    );
  }
  return errors;
}
