// decisions.ts - POST /v1/decisions (OpenRouter Decisions API 프록시)

import { Elysia, t } from 'elysia';
import { env } from '../config/env.ts';

let keyIndex = 0;
function getNextOpenRouterKey(): string {
  const keys = env.openrouterKeys;
  if (!keys || keys.length === 0) return '';
  const key = keys[keyIndex % keys.length];
  keyIndex++;
  return key;
}

export const decisionsRoute = new Elysia().post(
  '/v1/decisions',
  async ({ body, set }) => {
    const apiKey = getNextOpenRouterKey();
    if (!apiKey) {
      set.status = 500;
      return { error: { message: 'No OpenRouter API key configured' } };
    }

    try {
      const response = await fetch('https://openrouter.ai/api/alpha/decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://reportist.kr',
          'X-Title': 'Reportist Game',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      set.status = response.status;
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set.status = 502;
      return { error: { message: `Gateway forward error: ${message}` } };
    }
  },
  {
    body: t.Object({
      model: t.Optional(t.String()),
      state: t.Any(),
      questions: t.Any(),
    }),
  }
);
