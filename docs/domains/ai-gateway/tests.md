# AI-Gateway 테스트 케이스

## KeyRotator 테스트

```typescript
describe('KeyRotator', () => {
  test('랜덤 시작점으로 모든 키를 순환한다', () => {
    const rotator = new KeyRotator([
      { provider: 'cline', keys: ['key1', 'key2', 'key3'] }
    ])
    const keys = rotator.getKeysForProvider('cline')
    expect(keys).toHaveLength(3)
    expect(new Set(keys)).toEqual(new Set(['key1', 'key2', 'key3']))
  })
})
```

## CooldownManager 테스트

```typescript
describe('CooldownManager', () => {
  test('쿨다운 등록 후 isCoolingDown이 true를 반환한다', () => {
    const manager = new CooldownManager()
    manager.setCooldown('cline', 'deepseek', 'key1', 60_000, 'test')
    expect(manager.isCoolingDown('cline', 'deepseek', 'key1')).toBe(true)
  })

  test('만료 후 isCoolingDown이 false를 반환한다', async () => {
    const manager = new CooldownManager()
    manager.setCooldown('cline', 'deepseek', 'key1', 10, 'test')  // 10ms
    await new Promise(r => setTimeout(r, 20))
    expect(manager.isCoolingDown('cline', 'deepseek', 'key1')).toBe(false)
  })

  test('404 발생 시 모든 키에 쿨다운 적용', () => {
    const manager = new CooldownManager()
    const allKeys = ['key1', 'key2', 'key3']
    manager.setModelCooldownAllKeys('cline', 'bad-model', allKeys, 86_400_000, '404')
    for (const key of allKeys) {
      expect(manager.isCoolingDown('cline', 'bad-model', key)).toBe(true)
    }
  })
})
```

## ErrorClassifier 테스트

```typescript
describe('ErrorClassifier', () => {
  const classifier = new ErrorClassifier()

  test.each([
    [429, 'PerDay quota exceeded',       'daily_exhausted'],
    [429, 'per day limit reached',        'daily_exhausted'],
    [429, 'insufficient_quota',           'daily_exhausted'],
    [429, 'Rate limit exceeded RPM',      'rpm_exceeded'],
    [429, 'TPM token per minute',         'tpm_exceeded'],
    [400, 'context_length_exceeded',      'context_too_long'],
    [400, 'max output tokens exceeded',   'output_too_long'],
    [400, 'content_filter violation',     'safety_filter'],
    [401, 'Unauthorized',                 'unauthorized'],
    [403, 'Forbidden',                    'forbidden'],
    [404, 'Model not found',              'model_not_found'],
    [503, 'Service unavailable',          'server_overloaded'],
    [504, 'Gateway timeout',              'timeout'],
  ])('HTTP %i + "%s" → %s', (status, body, expected) => {
    expect(classifier.classify(status, body)).toBe(expected)
  })
})
```

## ProxyService 통합 테스트

```typescript
describe('ProxyService', () => {
  test('1번 키 RPM 429 → 2번 키로 성공', async () => {
    const mockAdapter = { call: vi.fn() }
    mockAdapter.call
      .mockResolvedValueOnce({ ok: false, status: 429, errorBody: 'RPM exceeded' })
      .mockResolvedValueOnce({ ok: true, status: 200, response: mockChatResponse })

    const service = new ProxyService(mockAdapter, ...)
    const result = await service.chat(mockRequest)

    expect(mockAdapter.call).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ choices: expect.any(Array) })
  })

  test('RPD 소진 → Supabase에 기록', async () => {
    const mockQuota = { markExhaustedLocal: vi.fn(), isExhaustedLocal: () => false }
    const mockAdapter = { call: vi.fn().mockResolvedValueOnce({
      ok: false, status: 429, errorBody: 'PerDay quota exceeded'
    }).mockResolvedValueOnce({ ok: true, status: 200, response: mockChatResponse }) }

    const service = new ProxyService(mockAdapter, { quota: mockQuota, ... })
    await service.chat(mockRequest)

    expect(mockQuota.markExhaustedLocal).toHaveBeenCalledOnce()
  })

  test('모든 키/모델 소진 → GATEWAY_ALL_EXHAUSTED 에러', async () => {
    const mockAdapter = { call: vi.fn().mockResolvedValue({
      ok: false, status: 429, errorBody: 'PerDay quota exceeded'
    })}

    const service = new ProxyService(mockAdapter, ...)
    const result = await service.chat(mockRequest) as GatewayError

    expect(result.error.code).toBe('GATEWAY_ALL_EXHAUSTED')
    expect(result.error.attempts.length).toBeGreaterThan(0)
  })

  test('404 발생 → 모든 키에 쿨다운 적용 후 다음 모델로', async () => {
    const mockCooldown = { isCoolingDown: () => false, setCooldown: vi.fn(), setModelCooldownAllKeys: vi.fn() }
    const mockAdapter = { call: vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, errorBody: 'Model not found' })
      .mockResolvedValueOnce({ ok: true, status: 200, response: mockChatResponse })
    }

    const service = new ProxyService(mockAdapter, { cooldown: mockCooldown, ... })
    await service.chat(mockRequest)

    expect(mockCooldown.setModelCooldownAllKeys).toHaveBeenCalledOnce()
    // 두 번째 call은 다음 모델
    expect(mockAdapter.call).toHaveBeenCalledTimes(2)
  })
})
```
