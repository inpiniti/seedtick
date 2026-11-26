// models.ts - GET /v1/models

import { Elysia } from 'elysia';
import { modelService } from '../domain/models/ModelService.ts';
import { proxyService } from '../domain/proxy/ProxyService.ts';
import type { FreeModelMeta, LLMProvider } from '../domain/types.ts';

const PROVIDERS: LLMProvider[] = ['openrouter', 'cline', 'kilo', 'opencode', 'gemini'];

type KeyMatrixCell = {
  status: 'y' | 'n';
  reason?: 'cooldown' | 'daily_exhausted' | 'unknown_error';
  blockedUntil?: string | null;
};
type KeyMatrixRow = {
  keyLabel: string;
  provider: LLMProvider;
  keyIndex: number;
  keyHash: string;
  active: number;
  availableCount: number;
  blockedCount: number;
  modelStates: Record<string, KeyMatrixCell>;
};

function isTrue(raw: unknown): boolean {
  return raw === '1' || raw === 'true';
}

function toModelLimit(raw: unknown): number {
  const parsed = Number.parseInt(String(raw ?? '12'), 10);
  if (Number.isNaN(parsed)) return 12;
  return Math.min(20, Math.max(1, parsed));
}

function toProvider(raw: unknown): LLMProvider | 'all' {
  const value = typeof raw === 'string' ? raw.toLowerCase() : 'all';
  return value === 'openrouter' ||
    value === 'cline' ||
    value === 'kilo' ||
    value === 'opencode' ||
    value === 'gemini'
    ? value
    : 'all';
}

function includeAllOutputs(raw: unknown): boolean {
  return typeof raw === 'string' && raw.toLowerCase() === 'all';
}

function isSupportedModel(provider: LLMProvider, modelId: string): boolean {
  if (provider === 'opencode') return modelId.startsWith('opencode/');
  if (provider === 'openrouter' || provider === 'cline' || provider === 'kilo') {
    return !modelId.startsWith('opencode/');
  }
  return false;
}

function buildStateKey(provider: LLMProvider, modelId: string, keyHash: string): string {
  return `${provider}:${modelId}:${keyHash}`;
}

/** 인증 실패(401/403) 키는 모델과 무관하게 막히므로 와일드카드 상태도 함께 조회한다. */
function buildProviderStateKey(provider: LLMProvider, keyHash: string): string {
  return `${provider}:*:${keyHash}`;
}

function toIsoOrNull(ms: number | null): string | null {
  if (ms === null) return null;
  return new Date(ms).toISOString();
}

function getProviderModels(
  provider: LLMProvider,
  allModels: FreeModelMeta[],
  limit: number
): FreeModelMeta[] {
  return allModels.filter((model) => isSupportedModel(provider, model.id)).slice(0, limit);
}

export const modelsRoute = new Elysia()
  .get(
    '/v1/models',
    async ({ query }) => {
      const forceRefresh = isTrue(query.refresh);
      const models = await modelService.getFreeModels({ forceRefresh });
      return {
        object: 'list',
        data: models,
        total: models.length,
      };
    },
    {
      detail: {
        summary: 'List Free Models',
        description: 'OpenRouter/OpenCode 무료 모델 목록과 모달리티/정책 메타데이터를 반환합니다.',
        tags: ['Models'],
      },
    }
  )
  .get('/v1/models/status', async ({ query }) => {
    const forceRefresh = isTrue(query.refresh);
    return modelService.getCatalogStatus(forceRefresh, includeAllOutputs(query.scope));
  })
  .get('/v1/models/key-matrix', async ({ query }) => {
    const forceRefresh = isTrue(query.refresh);
    const providerQuery = toProvider(query.provider);
    const modelLimit = toModelLimit(query.modelLimit);
    const providers = providerQuery === 'all' ? PROVIDERS : [providerQuery];

    const status = await modelService.getCatalogStatus(forceRefresh);
    const now = Date.now();
    const cooldownMap = proxyService.getCooldownMap();
    const exhaustedMap = proxyService.getExhaustedMap();

    const rowsByProvider = providers.map((provider) => {
      const keyStates = proxyService.getKeyStates(provider);
      const models = getProviderModels(provider, status.data, modelLimit);

      const rows: KeyMatrixRow[] = keyStates.map((key) => {
        const modelStates: Record<string, KeyMatrixCell> = {};
        let availableCount = 0;
        let blockedCount = 0;

        for (const model of models) {
          const stateKey = buildStateKey(provider, model.id, key.apiKeyHash);
          const exhaustedUntil = exhaustedMap.get(stateKey);
          const cooldownState =
            cooldownMap.get(stateKey) ??
            cooldownMap.get(buildProviderStateKey(provider, key.apiKeyHash));
          const isExhausted = typeof exhaustedUntil === 'number' && exhaustedUntil > now;
          const isCoolingDown = Boolean(
            cooldownState && (cooldownState.expiresAt === null || cooldownState.expiresAt > now)
          );
          const blocked = isExhausted || isCoolingDown;
          if (blocked) blockedCount++;
          else availableCount++;

          let reason: KeyMatrixCell['reason'];
          let blockedUntil: string | null | undefined;
          if (isExhausted) {
            reason = 'daily_exhausted';
            blockedUntil = toIsoOrNull(exhaustedUntil ?? null);
          } else if (isCoolingDown) {
            if (cooldownState?.reason === 'unknown') {
              reason = 'unknown_error';
              blockedUntil = null;
            } else {
              reason = 'cooldown';
              blockedUntil = toIsoOrNull(cooldownState?.expiresAt ?? null);
            }
          }

          modelStates[model.id] = {
            status: blocked ? 'n' : 'y',
            reason: blocked ? reason : undefined,
            blockedUntil: blocked ? blockedUntil : undefined,
          };
        }

        return {
          keyLabel: `${provider}-${key.index}`,
          provider,
          keyIndex: key.index,
          keyHash: key.apiKeyHash,
          active: key.active,
          availableCount,
          blockedCount,
          modelStates,
        };
      });

      return {
        provider,
        modelColumns: models.map((model) => model.id),
        rows,
      };
    });

    return {
      updatedAt: new Date().toISOString(),
      modelLimit,
      providers: rowsByProvider,
    };
  })
  .get('/v1/models/live', async () => {
    const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gateway Model Live Status</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 24px; color: #191f28; background: #f7f9fc; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    h2 { margin: 28px 0 8px; font-size: 20px; }
    .muted { color: #4e5968; font-size: 13px; margin-bottom: 16px; }
    .grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 16px; }
    .card { border: 1px solid #e5e8eb; border-radius: 16px; padding: 12px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .surface { border: 1px solid #e5e8eb; border-radius: 16px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; position: sticky; top: 0; }
    .ok { color: #03b26c; font-weight: 600; }
    .warn { color: #ff9500; font-weight: 600; }
    .bad { color: #f04452; font-weight: 600; }
    .chip { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 12px; border: 1px solid #e5e8eb; background: #fff; color: #4e5968; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; color: #8b95a1; }
    .matrix-wrap { margin-top: 12px; overflow: auto; }
    .matrix table { min-width: 860px; }
    .y { color: #03b26c; font-weight: 700; }
    .n { color: #f04452; font-weight: 700; }
    .reason { color: #8b95a1; font-size: 11px; margin-top: 2px; white-space: nowrap; }
  </style>
</head>
<body>
  <h1>AI Gateway 모델 실시간 상태</h1>
  <p class="muted">60초마다 자동 갱신돼요. 수동 새로고침은 URL에 <code>?refresh=1</code>을 붙여 주세요.</p>
  <div id="summary" class="grid"></div>
  <div class="surface">
    <table>
      <thead>
        <tr>
          <th>모델</th>
          <th>입력</th>
          <th>출력</th>
          <th>학습정책</th>
          <th>속도(tok/s)</th>
          <th>지연(ms)</th>
        </tr>
      </thead>
      <tbody id="rows"></tbody>
    </table>
  </div>

  <h2>키별 모델 가능 상태</h2>
  <p class="muted">y는 지금 바로 사용 가능, n은 쿨다운 또는 일일 소진 상태예요.</p>
  <div id="key-matrix"></div>
  <script>
    function escapeHtml(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function shortModelName(modelId) {
      const plain = String(modelId || '').replace(':free', '');
      const parts = plain.split('/');
      return parts.length > 1 ? parts[1] : plain;
    }

    function formatRemaining(untilIso) {
      if (!untilIso) return '';
      const target = new Date(untilIso).getTime();
      if (!Number.isFinite(target)) return '';
      const remainMs = target - Date.now();
      if (remainMs <= 0) return '곧 해제';
      const totalSec = Math.ceil(remainMs / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      if (h > 0) return h + '시간 ' + m + '분 남음';
      if (m > 0) return m + '분 ' + s + '초 남음';
      return s + '초 남음';
    }

    function renderMatrix(matrixJson) {
      const root = document.getElementById('key-matrix');
      root.innerHTML = '';
      for (const providerBlock of (matrixJson.providers || [])) {
        const wrap = document.createElement('div');
        wrap.className = 'surface matrix-wrap matrix';
        const columns = providerBlock.modelColumns || [];
        const rows = providerBlock.rows || [];
        const headColumns = columns
          .map((modelId) => '<th title="' + escapeHtml(modelId) + '">' + escapeHtml(shortModelName(modelId)) + '</th>')
          .join('');
        const bodyRows = rows.map((row) => {
          const cells = columns
            .map((modelId) => {
              const cell = row.modelStates?.[modelId];
              const text = cell?.status || 'n';
              const cls = text === 'y' ? 'y' : 'n';
              if (text === 'y') {
                return '<td class="' + cls + '">y</td>';
              }
              const reason = cell?.reason === 'daily_exhausted'
                ? '일일 소진'
                : cell?.reason === 'cooldown'
                  ? '쿨다운'
                  : '미확인 오류';
              const remain = cell?.reason === 'unknown_error'
                ? '수동 확인 필요'
                : formatRemaining(cell?.blockedUntil);
              const detail = remain ? reason + ' · ' + remain : reason;
              return '<td title="' + detail + '"><div class="' + cls + '">n</div><div class="reason">' + detail + '</div></td>';
            })
            .join('');
          return (
            '<tr>' +
            '<td><div>' + escapeHtml(row.keyLabel) + '</div><div class="mono">***' + escapeHtml(row.keyHash) + '</div></td>' +
            '<td>' + String(row.active ?? 0) + '</td>' +
            '<td>' + String(row.availableCount ?? 0) + '</td>' +
            '<td>' + String(row.blockedCount ?? 0) + '</td>' +
            cells +
            '</tr>'
          );
        }).join('');

        wrap.innerHTML =
          '<div style="padding: 12px 12px 0;">' +
          '<span class="chip">' + escapeHtml(providerBlock.provider) + '</span>' +
          '<span class="muted" style="margin-left: 8px;">모델 ' + String(columns.length) + '개 기준</span>' +
          '</div>' +
          '<table>' +
          '<thead><tr><th>키</th><th>active</th><th>가능</th><th>차단</th>' + headColumns + '</tr></thead>' +
          '<tbody>' + bodyRows + '</tbody>' +
          '</table>';
        root.appendChild(wrap);
      }
    }

    async function load(refresh) {
      const qs = refresh ? '?refresh=1' : '';
      const [statusRes, matrixRes] = await Promise.all([
        fetch('/v1/models/status?scope=all' + (refresh ? '&refresh=1' : '')),
        fetch('/v1/models/key-matrix?provider=all&modelLimit=12' + (refresh ? '&refresh=1' : '')),
      ]);
      const json = await statusRes.json();
      const matrixJson = await matrixRes.json();
      const summary = document.getElementById('summary');
      summary.innerHTML = '';
      const cards = [
        ['총 모델', String(json.total ?? 0)],
        ['비학습 우선 후보', String(json.trainingPolicy?.nonTraining ?? 0)],
        ['정책 미확인', String(json.trainingPolicy?.unknown ?? 0)],
        ['학습 사용 모델', String(json.trainingPolicy?.training ?? 0)],
        ['마지막 DB 동기화', json.lastCatalogSyncAt || 'N/A'],
      ];
      for (const [title, value] of cards) {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = '<div class="muted">' + title + '</div><div>' + value + '</div>';
        summary.appendChild(div);
      }

      const rows = document.getElementById('rows');
      rows.innerHTML = '';
      for (const m of (json.data || [])) {
        const tr = document.createElement('tr');
        const training = m?.dataPolicy?.training;
        const policyLabel = training === false
          ? '<span class="ok">미학습</span>'
          : training === true
            ? '<span class="bad">학습 사용</span>'
            : '<span class="warn">미확인</span>';
        tr.innerHTML =
          '<td>' + (m.id || '') + '</td>' +
          '<td>' + ((m.inputModalities || ['text']).join(', ')) + '</td>' +
          '<td>' + ((m.outputModalities || ['text']).join(', ')) + '</td>' +
          '<td>' + policyLabel + '</td>' +
          '<td>' + (m.speedTokensPerSecond ?? '-') + '</td>' +
          '<td>' + (m.latencyMs ?? '-') + '</td>';
        rows.appendChild(tr);
      }

      renderMatrix(matrixJson);
    }

    load(true).catch(console.error);
    setInterval(() => load(false).catch(console.error), 60000);
  </script>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  });
