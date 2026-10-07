This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Admin visualization focus

`seedtick-admin` 화면은 아래 흐름을 한 번에 보여주는 것을 목표로 해요.

1. **추천 근거**: 실시간 스크리너 + DataRoma 후보 비교
2. **비교 분석**: 13인 거장 투표 히트맵, 리포트 커버리지
3. **분석 진행**: 파이프라인 단계/소요 시간
4. **실행 결과**: 종목별 리포트 상세, 차트, 시스템 로그

현재 스크리너 탭에는 아래 시각 요소가 포함돼 있어요.

- 매수/보유/매도 결정 카드(우선순위 상위 종목, 상승여력, 확신도, 기술 상태)
- 스크리너 통합 후보 카드 그리드(내재가치/종가 + 내재가치 안정성)
- 스크리너 조건 패널(토스 13인 공통, DataRoma Grand)
- 차트 센터 탭(일봉·볼린저 밴드 전용, 스크리너와 분리)
- 13인 거장 투표 히트맵(상위 후보 종목 기준)
- 리포트 커버리지/교집합 KPI 요약
- 파이프라인 단계별 소요 시간 차트(단계별 병목 확인)
- 13인 거장 비교 분석(합의율 랭킹, 거장별 합의율 타임라인, 상관 매트릭스)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
