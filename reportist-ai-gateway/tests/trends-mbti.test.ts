// trends-mbti.test.ts - /v1/trends MBTI 대본 생성·검증 단위 테스트
import { describe, expect, it } from 'bun:test';
import {
  ANIMAL_PERSONAS,
  TREND_ANIMAL_SPECIES,
  TREND_MBTI,
  attachTrendLines,
  buildDeterministicLines,
  parseTrendLines,
} from '../src/domain/trends/animalPersonas.ts';

const BLOCKED = /(살인|정치|불륜)/i;
const TOPIC = { keyword: '붕어빵', topic: '붕어빵 팥이 최고야?', context: '겨울 간식 인기' };

describe('trend animal MBTI personas', () => {
  it('12종 동물이 모두 고유한 id와 MBTI를 가진다', () => {
    expect(ANIMAL_PERSONAS).toHaveLength(12);
    expect(new Set(TREND_ANIMAL_SPECIES).size).toBe(12);
    for (const species of TREND_ANIMAL_SPECIES) {
      expect(TREND_MBTI[species]).toMatch(/^[EI][NS][TF][JP]$/);
    }
    expect(TREND_MBTI.penguin).toBe('ENFJ');
    expect(TREND_MBTI.cat).toBe('INTP');
    expect(TREND_MBTI['polar-bear']).toBe('INFJ');
  });

  it('결정론적 대본은 서로 다른 8마리의 MBTI 대사로 구성된다', () => {
    const lines = buildDeterministicLines(TOPIC, 42);
    expect(lines).toHaveLength(8);
    expect(new Set(lines.map((line) => line.speaker)).size).toBe(8);
    for (const line of lines) {
      expect(line.mbti).toBe(TREND_MBTI[line.speaker]);
      expect(line.text.length).toBeGreaterThan(3);
      expect(line.text).toContain('붕어빵');
    }
    expect(buildDeterministicLines(TOPIC, 42)).toEqual(lines);
  });

  it('LLM 대사 중 허용되지 않은 동물과 위험 화제를 걸러낸다', () => {
    const parsed = parseTrendLines(
      [
        { speaker: 'penguin', text: '"다들 붕어빵 어때?"' },
        { speaker: 'cat', text: '원리가 궁금하네.' },
        { speaker: 'rabbit', text: '요즘 제일 핫하지!' },
        { speaker: 'dragon', text: '이건 걸러져야 해' },
        { speaker: 'dog', text: '정치 얘기는 안 해' },
      ],
      TOPIC,
      BLOCKED
    );

    expect(parsed.map((line) => line.speaker)).toEqual(['penguin', 'cat', 'rabbit']);
    expect(parsed[0]?.text).not.toContain('"');
  });

  it('LLM 대사의 MBTI는 서버 배정표로 덮어쓴다', () => {
    const parsed = parseTrendLines(
      [
        { speaker: 'owl', mbti: 'ESFP', text: '흐름을 보면 다 보이네.' },
        { speaker: 'bear', mbti: 'ENTP', text: '포근하게 같이 먹자.' },
        { speaker: 'fox', mbti: 'ISFJ', text: '진짜? 나는 반대!' },
      ],
      TOPIC,
      BLOCKED
    );
    expect(parsed.map((line) => line.mbti)).toEqual(['INTJ', 'ISFJ', 'ENTP']);
  });

  it('대사가 부족한 주제는 결정론적 대본으로 대체한다', () => {
    const partial = [
      { ...TOPIC, lines: [{ speaker: 'cat' as const, mbti: 'INTP', text: '한 줄만' }] },
    ];
    const items = attachTrendLines(partial, 7);
    expect(items[0]?.lines).toHaveLength(8);
    const firstLine = items[0]?.lines[0];
    expect(firstLine?.mbti).toBe(TREND_MBTI[firstLine?.speaker ?? 'penguin']);
    expect(attachTrendLines(partial, 7)).toEqual(items);
  });
});
