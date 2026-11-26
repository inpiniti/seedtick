// models.ts - GET /v1/models

import { Elysia } from 'elysia';
import { modelService } from '../domain/models/ModelService.ts';

export const modelsRoute = new Elysia()
  .get(
    '/v1/models',
    async ({ query }) => {
      const forceRefresh = query.refresh === '1' || query.refresh === 'true';
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
    const forceRefresh = query.refresh === '1' || query.refresh === 'true';
    return modelService.getCatalogStatus(forceRefresh);
  })
  .get('/v1/models/live', async () => {
    const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gateway Model Live Status</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 24px; color: #0f172a; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .muted { color: #64748b; font-size: 13px; margin-bottom: 16px; }
    .grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 16px; }
    .card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; background: #f8fafc; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; position: sticky; top: 0; }
    .ok { color: #047857; font-weight: 600; }
    .warn { color: #a16207; font-weight: 600; }
    .bad { color: #b91c1c; font-weight: 600; }
  </style>
</head>
<body>
  <h1>AI Gateway 모델 실시간 상태</h1>
  <p class="muted">60초마다 자동 갱신. 수동 새로고침은 URL에 <code>?refresh=1</code>을 붙여 호출하세요.</p>
  <div id="summary" class="grid"></div>
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
  <script>
    async function load(refresh) {
      const qs = refresh ? '?refresh=1' : '';
      const res = await fetch('/v1/models/status' + qs);
      const json = await res.json();
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
    }

    load(true).catch(console.error);
    setInterval(() => load(false).catch(console.error), 60000);
  </script>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  });
