import { MonitorUp } from 'lucide-react';

// components/studio-v2/DesktopOnlyGate.tsx — 960px 미만 뷰포트 차단 안내.
// 모바일 편집 UI를 전면 제거하고 PC 전용 편집에 집중하기 위한 가드.
export const DesktopOnlyGate = () => (
  <div className="sv2-gate" role="alert">
    <div className="sv2-gate-icon">
      <MonitorUp size={34} />
    </div>
    <h1>PC에서 편집해주세요</h1>
    <p>
      미리보기를 중심으로 컷을 직접 보고 다듬는 스튜디오는 화면이 넓은 PC에서 가장 쾌적하게
      동작합니다. 모바일에서는 완성된 영상 감상만 지원해요.
    </p>
  </div>
);
