// Auto-generated Patch Notes data for Reportist Video
export interface PatchCommit {
  hash: string;
  date: string;
  type: string;
  scope: string | null;
  message: string;
  rawSubject: string;
}

export interface PatchRelease {
  version: string;
  title: string;
  date: string;
  type: 'major' | 'patch';
  summary: string;
  totalCommits: number;
  commits: PatchCommit[];
}

export const CURRENT_APP_VERSION = '0.9.9';

export const PATCH_RELEASES: PatchRelease[] = [
  {
    "version": "0.9.9",
    "title": "모바일 소용량 원본 비디오 보존 허용, 다운로드 즉시 DB 동기화 및 보관된 하이라이트 전용 뷰어 도입",
    "date": "2026-11-10",
    "type": "patch",
    "summary": "소용량 영상(3개 이하 & 80MB 이하)은 아이폰 Safari에서도 원본 비디오를 IndexedDB에 안전하게 영구 보관하도록 스토리지를 개선했습니다. 또한 완성 영상 다운로드 완료 즉시 동기적 저장을 실행하여 브라우저 강제 종료 시에도 완성본이 100% 보존되도록 했으며, 원본이 분리된 프로젝트라도 '영상을 올려주세요' 빈 화면이나 위협적인 경고 배너 대신 보관된 썸네일 아트워크와 하이라이트 정보 카드를 단정하게 제공하도록 UX를 혁신했습니다.",
    "totalCommits": 1,
    "commits": [
      {
        "hash": "str099",
        "date": "2026-11-10",
        "type": "fix",
        "scope": "storage",
        "message": "소용량 모바일 원본 비디오 보존 허용 및 보관된 하이라이트 전용 뷰어 도입 (v0.9.9)",
        "rawSubject": "fix(storage): 소용량 모바일 원본 비디오 보존 허용 및 보관된 하이라이트 전용 뷰어 도입 (v0.9.9)"
      }
    ]
  },
  {
    "version": "0.9.8",
    "title": "설정 모달 내 클립 촬영일시 순 기본 정렬 옵션 추가 및 AI 하이라이트 생성 시 자동 정렬 연동",
    "date": "2026-11-10",
    "type": "patch",
    "summary": "스튜디오 설정 모달 내 '촬영일시 순 기본 정렬' 토글 옵션을 추가하여, 개별 버튼을 수동으로 누르지 않아도 영상을 불러오거나 AI 하이라이트 분석 시 자동으로 클립들을 촬영일시(시·분·초) 기준 시간순으로 정렬하도록 사용성을 개선했습니다. 설정 값은 브라우저 로컬 저장소에 영구 보관되며, 설정 창에서 토글을 켜는 즉시 현재 작업 중인 타임라인 클립도 시간순으로 정렬됩니다.",
    "totalCommits": 1,
    "commits": [
      {
        "hash": "st098",
        "date": "2026-11-10",
        "type": "feat",
        "scope": "video",
        "message": "설정 모달 내 클립 촬영일시 순 기본 정렬 옵션 추가 및 AI 하이라이트 생성 시 자동 정렬 연동 (v0.9.8)",
        "rawSubject": "feat(video): 설정 모달 내 클립 촬영일시 순 기본 정렬 옵션 추가 및 AI 하이라이트 생성 시 자동 정렬 연동 (v0.9.8)"
      }
    ]
  },
  {
    "version": "0.9.7",
    "title": "백그라운드 탭·앱 전환 시 브라우저 프로세스 동결 방지(WakeLock·킵얼라이브) 및 화면 복귀 시 중단 지점 자동 재개 지원",
    "date": "2026-11-10",
    "type": "patch",
    "summary": "AI 하이라이트 분석 및 영상 생성 도중 사용자가 크롬 다른 탭으로 이동하거나 모바일에서 다른 앱을 켤 때 브라우저 프로세스가 동결(Freezing)되거나 TCP 소켓이 조용히 끊어져 작업이 멈추는 문제를 전면 해결했습니다. Screen Wake Lock API와 무음 오디오 킵얼라이브 및 Web Worker 정밀 하트비트를 도입하여 백그라운드에서도 네트워크 연결을 안정적으로 유지하며, AI Gateway 응답에 25초 무응답 워치독(Inactivity Timeout)을 탑재했습니다. 특히 다른 앱을 다녀와 화면으로 복귀했을 때 정체된 연결을 감지해 멈춘 위치부터 즉시 작업을 자동으로 재개(Auto-Resume)하며, 영상별 분석 완료 시마다 중간 체크포인트를 저장하여 완료된 결과는 영구 보존됩니다.",
    "totalCommits": 1,
    "commits": [
      {
        "hash": "bg097",
        "date": "2026-11-10",
        "type": "fix",
        "scope": "video",
        "message": "백그라운드 탭·앱 전환 시 브라우저 프로세스 동결 방지(WakeLock·킵얼라이브) 및 화면 복귀 시 중단 지점 자동 재개 지원 (v0.9.7)",
        "rawSubject": "fix(video): 백그라운드 탭·앱 전환 시 브라우저 프로세스 동결 방지(WakeLock·킵얼라이브) 및 화면 복귀 시 중단 지점 자동 재개 지원 (v0.9.7)"
      }
    ]
  },
  {
    "version": "0.9.6",
    "title": "모바일 Safari 완성본 비디오(Blob) IndexedDB 영구 보존 및 브라우저 재실행 시 0초 즉시 재생·다운로드 모드 지원",
    "date": "2026-11-10",
    "type": "patch",
    "summary": "아이폰 Safari 등 모바일 환경에서 수백 MB의 원본 영상 18개는 메모리 보호를 위해 분리 보관하면서도, 최종 완성본 비디오(Blob) 1개는 IndexedDB에 안전하게 영구 보존하도록 스토리지를 개선했습니다. 브라우저를 완전히 강제 종료한 뒤 재접속하더라도 불필요한 '원본 영상 18개 연결 필요' 경고를 띄우지 않고, 완성본 비디오를 고화질 하드웨어 가속으로 즉시 재생하거나 0초 만에 바로 다운로드할 수 있도록 사용자 경험을 전면 개선했습니다.",
    "totalCommits": 1,
    "commits": [
      {
        "hash": "idb096",
        "date": "2026-11-10",
        "type": "fix",
        "scope": "storage",
        "message": "모바일 Safari 완성본 비디오(Blob) IndexedDB 보존 및 재접속 시 완성본 즉시 재생·다운로드 지원 (v0.9.6)",
        "rawSubject": "fix(storage): 모바일 Safari 완성본 비디오(Blob) IndexedDB 보존 및 재접속 시 완성본 즉시 재생·다운로드 지원 (v0.9.6)"
      }
    ]
  },
  {
    "version": "0.9.5",
    "title": "스토리지 설정 내 OPFS 가상 파일시스템 및 브라우저 캐시 비우기 기능 추가",
    "date": "2026-11-10",
    "type": "patch",
    "summary": "보관함 내 프로젝트를 모두 삭제한 이후에도 브라우저 Origin 스토리지(OPFS 잔여 임시 파일, Service Worker/CacheStorage 비디오 캐시, 리소스 버퍼)에 수백 MB가 남아있을 수 있던 현상을 완전히 해소하기 위해, 스튜디오 설정에 [저장 공간 정리 (캐시 비우기)] 버튼을 도입했습니다. 또한 아이폰에서 18개 이상의 고화질 영상을 동시 선택할 때 iOS 사진 선택창(Photo Picker)이 자체 메모리 초과로 닫히는 현상에 대응하여 기기 공간 확보 및 분할 추가 가이드를 마련했습니다.",
    "totalCommits": 1,
    "commits": [
      {
        "hash": "opfs095",
        "date": "2026-11-10",
        "type": "fix",
        "scope": "storage",
        "message": "OPFS 가상 파일시스템 및 잔여 브라우저 캐시 일괄 정리 기능 추가 (v0.9.5)",
        "rawSubject": "fix(storage): OPFS 가상 파일시스템 및 잔여 브라우저 캐시 일괄 정리 기능 추가 (v0.9.5)"
      }
    ]
  },
  {
    "version": "0.9.4",
    "title": "아이폰(iOS Safari) 대량 영상(18개+) 업로드 시 비디오 엘리먼트 디코더 고갈 및 새로고침 크래시 해결",
    "date": "2026-11-10",
    "type": "patch",
    "summary": "아이폰에서 18개 이상의 영상을 한 번에 업로드할 때 발생하던 Safari 새로고침(WebProcess Jetsam OOM) 크래시를 완전히 해결했습니다. <video> 엘리먼트를 여러 개 생성해 시크(seek)하는 무거운 방식 대신, QuickTime/MP4 컨테이너의 mvhd/tkhd 박스를 순수 바이너리로 파싱하여 디코더 가동 없이 0.05ms 만에 정확한 재생 길이, 해상도, 회전 각도를 즉각 추출하도록 혁신했습니다. 모바일에서는 첫 번째 영상에만 대표 썸네일을 가볍게 추출하고 나머지 영상은 디코더를 생성하지 않으며, 영상 처리 사이 40ms GC 틱을 보장합니다.",
    "totalCommits": 1,
    "commits": [
      {
        "hash": "upl094a",
        "date": "2026-11-10",
        "type": "fix",
        "scope": "video",
        "message": "아이폰 다중 영상(18개+) 업로드 시 순수 바이너리 MP4 메타데이터 파서 도입 및 불필요한 비디오 디코더 생성 차단으로 Safari 새로고침 크래시 해결 (v0.9.4)",
        "rawSubject": "fix(video): 아이폰 다중 영상(18개+) 업로드 시 순수 바이너리 MP4 메타데이터 파서 도입 및 불필요한 비디오 디코더 생성 차단으로 Safari 새로고침 크래시 해결 (v0.9.4)"
      }
    ]
  },
  {
    "version": "0.9.3",
    "title": "아이폰(iOS Safari) 다중 영상 내보내기 프레임 드랍 해결 및 디코더 1:1 동기화",
    "date": "2026-11-10",
    "type": "patch",
    "summary": "아이폰에서 다수의 영상을 편집·병합하여 다운로드할 때 발생하던 프레임 드랍(멈칫거림·건너뛰기) 현상을 해결했습니다. 벽시계 가상 보간 클럭으로 인한 중복/스킵 캡처를 제거하고 requestVideoFrameCallback 실측 미디어 시간 1:1 동기화, DOM 프리뷰 비디오 디코더 슬롯 임시 반환 및 다중 영상 전환 시 디코더 플러시를 적용했습니다.",
    "totalCommits": 1,
    "commits": [
      {
        "hash": "fps093a",
        "date": "2026-11-10",
        "type": "fix",
        "scope": "video",
        "message": "아이폰 다중 영상 내보내기 시 하드웨어 디코더 슬롯 독점 보장 및 실측 프레임 1:1 동기화로 프레임 드랍 해결",
        "rawSubject": "fix(video): 아이폰 다중 영상 내보내기 시 하드웨어 디코더 슬롯 독점 보장 및 실측 프레임 1:1 동기화로 프레임 드랍 해결"
      }
    ]
  },
  {
    "version": "0.9.2",
    "title": "아이폰(iOS Safari) 업로드 직후 자동 저장·메타데이터 파싱 메모리 크래시 원천 차단",
    "date": "2026-11-10",
    "type": "patch",
    "summary": "아이폰 XR 등 모바일 기기에서 다중 영상 업로드 직후 아무 버튼을 누르지 않아도 백그라운드 자동 저장(IndexedDB/OPFS 원본 Blob 직렬화)과 촬영일·GPS 메타데이터 중복 버퍼 스캔으로 인해 Safari가 강제 새로고침되던 문제를 완벽히 해결했습니다.",
    "totalCommits": 1,
    "commits": [
      {
        "hash": "ios092a",
        "date": "2026-11-10",
        "type": "fix",
        "scope": "video",
        "message": "아이폰 다중 영상 업로드 직후 자동 저장 Blob 직렬화 차단 및 메타데이터 단일 패스 경량화로 Safari 새로고침 크래시 해결",
        "rawSubject": "fix(video): 아이폰 다중 영상 업로드 직후 자동 저장 Blob 직렬화 차단 및 메타데이터 단일 패스 경량화로 Safari 새로고침 크래시 해결"
      }
    ]
  },
  {
    "version": "0.9.1",
    "title": "다중 영상 처리 메모리·디코더 최적화 및 메타데이터·성능 표기 개선",
    "date": "2026-11-10",
    "type": "patch",
    "summary": "모바일·PC 대량 영상 업로드 및 AI 하이라이트 분석·병합 시 비디오 디코더 즉시 해제, 단일 캔버스 재사용, 오디오 구간 슬라이싱으로 메모리 초과(OOM) 크래시를 방지하고, 촬영일자·GPS 인식 및 모델 성능 메트릭 표기를 정밀화했습니다.",
    "totalCommits": 4,
    "commits": [
      {
        "hash": "mem091a",
        "date": "2026-11-10",
        "type": "perf",
        "scope": "video",
        "message": "대량 영상 처리 시 비디오·캔버스 디코더 즉시 해제, 업로드 동시성 제어 및 오디오·자막 캔버스 메모리 최적화",
        "rawSubject": "perf(video): 대량 영상 처리 시 비디오·캔버스 디코더 즉시 해제, 업로드 동시성 제어 및 오디오·자막 캔버스 메모리 최적화"
      },
      {
        "hash": "4e4442b",
        "date": "2026-11-10",
        "type": "fix",
        "scope": "video",
        "message": "동영상 메타데이터(촬영일자·GPS) 파서 고도화 및 구글 포토 다운로드 영상 인식 개선",
        "rawSubject": "fix(video): 동영상 메타데이터(촬영일자·GPS) 파서 고도화 및 구글 포토 다운로드 영상 인식 개선"
      },
      {
        "hash": "0203382",
        "date": "2026-11-09",
        "type": "fix",
        "scope": "video",
        "message": "모델 선택 모달의 응답 속도 및 지연시간 표기 포맷 정밀화",
        "rawSubject": "fix(video): 모델 선택 모달의 응답 속도 및 지연시간 표기 포맷 정밀화"
      },
      {
        "hash": "9e4ebf2",
        "date": "2026-11-09",
        "type": "feat",
        "scope": "video",
        "message": "OpenRouter 실시간 성능 메트릭 연동 및 공식 벤치마크 보강",
        "rawSubject": "feat(video): OpenRouter 실시간 성능 메트릭 연동 및 공식 벤치마크 보강"
      }
    ]
  },
  {
    "version": "0.9.0",
    "title": "피드백 & 개선 요청 게시판 연동 및 패치노트 시스템 도입",
    "date": "2026-11-09",
    "type": "major",
    "summary": "서비스 이용 중 불편사항이나 개선 아이디어를 남길 수 있는 피드백 게시판 연동과 버전별 변경 사항을 확인할 수 있는 패치노트가 추가되었습니다.",
    "totalCommits": 2,
    "commits": [
      {
        "hash": "01291ac",
        "date": "2026-11-09",
        "type": "feat",
        "scope": "video",
        "message": "피드백 및 개선 요청 게시판 기능 추가 (1·2단계 개발자 처리 연동)",
        "rawSubject": "feat(video): 피드백 및 개선 요청 게시판 기능 추가 (1·2단계 개발자 처리 연동)"
      },
      {
        "hash": "584cb41",
        "date": "2026-11-09",
        "type": "refactor",
        "scope": "video",
        "message": "피드백 메뉴를 상단 탭에서 설정(Settings) 모달 내부로 재배치",
        "rawSubject": "refactor(video): 피드백 메뉴를 상단 탭에서 설정(Settings) 모달 내부로 재배치"
      }
    ]
  },
  {
    "version": "0.8.1",
    "title": "1080p(FHD) 및 720p 해상도 선택 내보내기 팝업 연동",
    "date": "2026-11-09",
    "type": "patch",
    "summary": "다운로드 시 1080p FHD 및 720p HD 해상도를 직접 선택할 수 있는 팝업 모달이 추가되고 우측 중복 설정 카드가 정리되었습니다.",
    "totalCommits": 3,
    "commits": [
      {
        "hash": "06bf2cd",
        "date": "2026-11-09",
        "type": "feat",
        "scope": "video",
        "message": "1080p(FHD) 및 720p 해상도 선택 내보내기 지원 및 스튜디오 UI 연동",
        "rawSubject": "feat(video): 1080p(FHD) 및 720p 해상도 선택 내보내기 지원 및 스튜디오 UI 연동"
      },
      {
        "hash": "e0273e2",
        "date": "2026-11-09",
        "type": "style",
        "scope": "video",
        "message": "내보내기 화질 선택 UI 디자인 시스템 적용 및 스타일 개선",
        "rawSubject": "style(video): 내보내기 화질 선택 UI 디자인 시스템 적용 및 스타일 개선"
      },
      {
        "hash": "258de0a",
        "date": "2026-11-09",
        "type": "refactor",
        "scope": "video",
        "message": "다운로드 클릭 시 해상도 선택 팝업 제공 및 우측 중복 설정 카드 제거",
        "rawSubject": "refactor(video): 다운로드 클릭 시 해상도 선택 팝업 제공 및 우측 중복 설정 카드 제거"
      }
    ]
  },
  {
    "version": "0.8.0",
    "title": "실시간 WYSIWYG 시퀀스 컴포지터 & BGM 배속 자동 동기화",
    "date": "2026-11-09",
    "type": "major",
    "summary": "캡컷 방식의 실시간 시퀀스 프리뷰 컴포지터 도입으로 내보내기 대기시간을 혁신적으로 단축하고, 배경음악 배속 자동 동기화 및 렌더링 프레임 끊김을 해결했습니다.",
    "totalCommits": 5,
    "commits": [
      {
        "hash": "094f651",
        "date": "2026-11-09",
        "type": "feat",
        "scope": "video",
        "message": "캡컷 방식 실시간 WYSIWYG 시퀀스 프리뷰 컴포지터 및 다운로드 시 단 1회 내보내기 워크플로우 전환",
        "rawSubject": "feat(video): 캡컷 방식 실시간 WYSIWYG 시퀀스 프리뷰 컴포지터 및 다운로드 시 단 1회 내보내기 워크플로우 전환"
      },
      {
        "hash": "7206e3f",
        "date": "2026-11-09",
        "type": "feat",
        "scope": "video",
        "message": "영상 길이에 맞춘 배경음악(BGM) 배속 자동 동기화 기능 구현",
        "rawSubject": "feat(video): 영상 길이에 맞춘 배경음악(BGM) 배속 자동 동기화 기능 구현"
      },
      {
        "hash": "947c9d1",
        "date": "2026-11-09",
        "type": "fix",
        "scope": "video",
        "message": "AI 분석 시작 시 진행률 초기화 및 N개 영상 균등 1/n 분할 진행률 엔진 적용",
        "rawSubject": "fix(video): AI 분석 시작 시 진행률 초기화 및 N개 영상 균등 1/n 분할 진행률 엔진 적용"
      },
      {
        "hash": "3413a88",
        "date": "2026-11-09",
        "type": "fix",
        "scope": "video",
        "message": "내보내기 영상 프레임 끊김(GOP 시크 스래싱·오프스크린 스로틀링·중간 flush) 해결 및 하드웨어 연속 디코딩 적용",
        "rawSubject": "fix(video): 내보내기 영상 프레임 끊김(GOP 시크 스래싱·오프스크린 스로틀링·중간 flush) 해결 및 하드웨어 연속 디코딩 적용"
      },
      {
        "hash": "ea979dd",
        "date": "2026-11-09",
        "type": "fix",
        "scope": "video",
        "message": "스토리지 엔진 및 보관 설정 UI 스타일 적용 및 미적용 클래스 수정",
        "rawSubject": "fix(video): 스토리지 엔진 및 보관 설정 UI 스타일 적용 및 미적용 클래스 수정"
      }
    ]
  },
  {
    "version": "0.7.0",
    "title": "WebCodecs GPU 하드웨어 가속 60fps 비디오 렌더러 구현",
    "date": "2026-11-08",
    "type": "major",
    "summary": "차세대 WebCodecs API 기반 하드웨어 가속 60fps 렌더러를 구축하여 영상 병합 속도를 대폭 향상하고 모바일 반응형 30fps 최적화 및 화면 꺼짐 방지(Screen Wake Lock)를 적용했습니다.",
    "totalCommits": 2,
    "commits": [
      {
        "hash": "aa7d27e",
        "date": "2026-11-08",
        "type": "feat",
        "scope": "video",
        "message": "WebCodecs GPU 하드웨어 가속 60fps 비디오 렌더러 구현 및 Fallback 연동",
        "rawSubject": "feat(video): WebCodecs GPU 하드웨어 가속 60fps 비디오 렌더러 구현 및 Fallback 연동"
      },
      {
        "hash": "a3d5e3c",
        "date": "2026-11-08",
        "type": "perf",
        "scope": "video",
        "message": "모바일/아이폰 WebCodecs 렌더러 반응형 30fps 최적화 및 Screen Wake Lock 적용",
        "rawSubject": "perf(video): 모바일/아이폰 WebCodecs 렌더러 반응형 30fps 최적화 및 Screen Wake Lock 적용"
      }
    ]
  },
  {
    "version": "0.6.0",
    "title": "원본 영상 기반 클립 구간 세밀 편집(Trim) 모달 및 대용량 OPFS 로드맵",
    "date": "2026-11-07",
    "type": "major",
    "summary": "클립 구간을 초 단위로 정밀하게 조절할 수 있는 세밀 편집(Trim) 모달 추가, 시퀀스 타임라인 실시간 스크러빙, 썸네일 AI 자동 줄바꿈 및 브라우저 대용량 저장소(OPFS) 로드맵을 구축했습니다.",
    "totalCommits": 12,
    "commits": [
      {
        "hash": "4216c0a",
        "date": "2026-11-07",
        "type": "feat",
        "scope": "video",
        "message": "영상 편집 옵션 변경 시 상단 '다시 병합' 버튼 표시 및 완료 시 자동 숨김",
        "rawSubject": "feat(video): 영상 편집 옵션 변경 시 상단 '다시 병합' 버튼 표시 및 완료 시 자동 숨김"
      },
      {
        "hash": "96d3ee1",
        "date": "2026-11-07",
        "type": "fix",
        "scope": "video",
        "message": "16:9 인물 크롭 위치 카드 세로 영상만 표시",
        "rawSubject": "fix(video): 16:9 인물 크롭 위치 카드 세로 영상만 표시"
      },
      {
        "hash": "fe7b5ee",
        "date": "2026-11-07",
        "type": "fix",
        "scope": "video",
        "message": "모바일 썸네일 액션 버튼 1줄 레이아웃 정렬 및 2줄 줄바꿈 수정",
        "rawSubject": "fix(video): 모바일 썸네일 액션 버튼 1줄 레이아웃 정렬 및 2줄 줄바꿈 수정"
      },
      {
        "hash": "f8759cb",
        "date": "2026-11-07",
        "type": "feat",
        "scope": "video",
        "message": "비효율적인 -0.5s/+0.5s 버튼 제거 및 원본 영상 기반 클립 구간 세밀 편집 모달 추가",
        "rawSubject": "feat(video): 비효율적인 -0.5s/+0.5s 버튼 제거 및 원본 영상 기반 클립 구간 세밀 편집 모달 추가"
      },
      {
        "hash": "65164a4",
        "date": "2026-11-07",
        "type": "feat",
        "scope": "video",
        "message": "문구 및 타임라인 수정 시 '다시 병합' 우선 표시 및 병합 완료 후 다운로드 버튼 노출",
        "rawSubject": "feat(video): 문구 및 타임라인 수정 시 '다시 병합' 우선 표시 및 병합 완료 후 다운로드 버튼 노출"
      },
      {
        "hash": "8c10b6b",
        "date": "2026-11-07",
        "type": "fix",
        "scope": "video",
        "message": "클립 구간 세밀 편집 모달 모바일 한 화면 최적화 (2컬럼 콤팩트 레이아웃)",
        "rawSubject": "fix(video): 클립 구간 세밀 편집 모달 모바일 한 화면 최적화 (2컬럼 콤팩트 레이아웃)"
      },
      {
        "hash": "34f92e2",
        "date": "2026-11-07",
        "type": "fix",
        "scope": "video",
        "message": "클립 상세 영역 내 중복된 '원본 영상 구간 조절' 카드 영역 제거",
        "rawSubject": "fix(video): 클립 상세 영역 내 중복된 '원본 영상 구간 조절' 카드 영역 제거"
      },
      {
        "hash": "dbe9864",
        "date": "2026-11-07",
        "type": "fix",
        "scope": "video",
        "message": "세밀 편집 모달 타임라인 빨간색 플레이헤드 드래그 터치 영역 및 모바일 크기 최적화",
        "rawSubject": "fix(video): 세밀 편집 모달 타임라인 빨간색 플레이헤드 드래그 터치 영역 및 모바일 크기 최적화"
      },
      {
        "hash": "db9d418",
        "date": "2026-11-07",
        "type": "fix",
        "scope": "video",
        "message": "모든 버튼 요소 및 버튼 클래스 텍스트/콘텐츠 중앙 정렬(center) 일관성 적용",
        "rawSubject": "fix(video): 모든 버튼 요소 및 버튼 클래스 텍스트/콘텐츠 중앙 정렬(center) 일관성 적용"
      },
      {
        "hash": "d2947f7",
        "date": "2026-11-07",
        "type": "fix",
        "scope": "video",
        "message": "시퀀스 타임라인 빨간색 플레이헤드 드래그 시 실시간 영상 프레임 갱신 및 터치 반응성 개선",
        "rawSubject": "fix(video): 시퀀스 타임라인 빨간색 플레이헤드 드래그 시 실시간 영상 프레임 갱신 및 터치 반응성 개선"
      },
      {
        "hash": "d4043ce",
        "date": "2026-11-07",
        "type": "fix",
        "scope": "video",
        "message": "썸네일 타이틀 AI 추천값 자동 동기화 및 글자 수에 따른 고정 폰트 2~3줄 자동 줄바꿈 지원",
        "rawSubject": "fix(video): 썸네일 타이틀 AI 추천값 자동 동기화 및 글자 수에 따른 고정 폰트 2~3줄 자동 줄바꿈 지원"
      },
      {
        "hash": "e75f87a",
        "date": "2026-11-07",
        "type": "feat",
        "scope": "video",
        "message": "대용량 영상 브라우저 스토리지 로드맵 구현 (OPFS 분리 저장, 쿼터 및 영구 보존 관리, 원본 영상 재연결 UX, 다중 코덱 지원)",
        "rawSubject": "feat(video): 대용량 영상 브라우저 스토리지 로드맵 구현 (OPFS 분리 저장, 쿼터 및 영구 보존 관리, 원본 영상 재연결 UX, 다중 코덱 지원)"
      }
    ]
  },
  {
    "version": "0.5.1",
    "title": "무정지(Zero-Freeze) 진행률 엔진 & 반응형 제논 점근 보간 시스템",
    "date": "2026-11-06",
    "type": "patch",
    "summary": "AI 영상 분석 중 진행률이 멈추지 않는 무정지 엔진 도입, 모바일 Blob 유실 방어 및 재생 URL 자동 복구 등 모바일 안정성을 대폭 강화했습니다.",
    "totalCommits": 20,
    "commits": [
      {
        "hash": "de3b404",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "AI 영상 분석 진행률 가중치 재조정 및 스트리밍 점근 보간으로 계단식 점프 현상 해결",
        "rawSubject": "fix(video): AI 영상 분석 진행률 가중치 재조정 및 스트리밍 점근 보간으로 계단식 점프 현상 해결"
      },
      {
        "hash": "ce681e1",
        "date": "2026-11-06",
        "type": "style",
        "scope": "video",
        "message": "프로젝트 및 극적 순간 목록 카드 테두리 불균형 두께 제거 및 사방 균일화",
        "rawSubject": "style(video): 프로젝트 및 극적 순간 목록 카드 테두리 불균형 두께 제거 및 사방 균일화"
      },
      {
        "hash": "f3252f2",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "영상 길이별 진행률 동적 가중치 분배 및 제논 점근 크롤링·실시간 메트릭 카운터 적용",
        "rawSubject": "fix(video): 영상 길이별 진행률 동적 가중치 분배 및 제논 점근 크롤링·실시간 메트릭 카운터 적용"
      },
      {
        "hash": "752bf23",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "구간별 제논 감속 점근(30%·60%·90%) 및 정밀 진행률 보간 적용",
        "rawSubject": "fix(video): 구간별 제논 감속 점근(30%·60%·90%) 및 정밀 진행률 보간 적용"
      },
      {
        "hash": "cb36fc0",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "상단 네비게이션 헤더 및 컨트롤 반응형 브레이크포인트 최적화와 문구 겹침·이탈 방지",
        "rawSubject": "fix(video): 상단 네비게이션 헤더 및 컨트롤 반응형 브레이크포인트 최적화와 문구 겹침·이탈 방지"
      },
      {
        "hash": "8fc1368",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "무정지(Zero-Freeze) 진행률 엔진 도입, 가짜 최저 속도 보장 및 심리학적 단계별 텍스트 전환 적용",
        "rawSubject": "fix(video): 무정지(Zero-Freeze) 진행률 엔진 도입, 가짜 최저 속도 보장 및 심리학적 단계별 텍스트 전환 적용"
      },
      {
        "hash": "9616316",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "유튜브 영상 공유 모달 내 소개 및 하이라이트 설명 다국어(i18n) 적용",
        "rawSubject": "fix(video): 유튜브 영상 공유 모달 내 소개 및 하이라이트 설명 다국어(i18n) 적용"
      },
      {
        "hash": "dc8a411",
        "date": "2026-11-06",
        "type": "style",
        "scope": "video",
        "message": "데스크탑 레이아웃 일부 수정",
        "rawSubject": "style(video): 데스크탑 레이아웃 일부 수정"
      },
      {
        "hash": "75a899b",
        "date": "2026-11-06",
        "type": "style",
        "scope": "video",
        "message": "데스크탑 레이아웃 일부 수정",
        "rawSubject": "style(video): 데스크탑 레이아웃 일부 수정"
      },
      {
        "hash": "98cfefa",
        "date": "2026-11-06",
        "type": "style",
        "scope": "video",
        "message": "보관함 화면 풀너비 확장 및 전체 영역 스크롤 적용",
        "rawSubject": "style(video): 보관함 화면 풀너비 확장 및 전체 영역 스크롤 적용"
      },
      {
        "hash": "6f19ca5",
        "date": "2026-11-06",
        "type": "style",
        "scope": "video",
        "message": "보관함 아이템 너비를 영상 공유 그리드와 동일하게 통일",
        "rawSubject": "style(video): 보관함 아이템 너비를 영상 공유 그리드와 동일하게 통일"
      },
      {
        "hash": "c14958f",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "업로드 영상 목록 모달 상단 요약(시간·용량·추가버튼) 줄바꿈 및 모바일 UI 깨짐 현상 수정",
        "rawSubject": "fix(video): 업로드 영상 목록 모달 상단 요약(시간·용량·추가버튼) 줄바꿈 및 모바일 UI 깨짐 현상 수정"
      },
      {
        "hash": "5511ff5",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "모바일 브라우저 원본 영상 Blob 소실 방어, 재생 URL 자동 복구 및 디코더 충돌 방지",
        "rawSubject": "fix(video): 모바일 브라우저 원본 영상 Blob 소실 방어, 재생 URL 자동 복구 및 디코더 충돌 방지"
      },
      {
        "hash": "b3ef5ee",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "팝업 활성화 중 배경 스크롤 잠금 및 터치·드래그 이벤트 전파 차단",
        "rawSubject": "fix(video): 팝업 활성화 중 배경 스크롤 잠금 및 터치·드래그 이벤트 전파 차단"
      },
      {
        "hash": "27a9ee0",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "영상 재생 프로그레스바 및 시퀀스 타임라인 플레이헤드 실시간 드래그 스크러빙 지원",
        "rawSubject": "fix(video): 영상 재생 프로그레스바 및 시퀀스 타임라인 플레이헤드 실시간 드래그 스크러빙 지원"
      },
      {
        "hash": "4d427d3",
        "date": "2026-11-07",
        "type": "fix",
        "scope": "video",
        "message": "하단 고정 상태바의 중복 시간 절약률 영역 제거 및 영상 요약만 노출",
        "rawSubject": "fix(video): 하단 고정 상태바의 중복 시간 절약률 영역 제거 및 영상 요약만 노출"
      },
      {
        "hash": "7ecab37",
        "date": "2026-11-07",
        "type": "fix",
        "scope": "video",
        "message": "모바일 AI 포착 극적 순간 씬 아이템의 썸네일·조절 버튼 레이아웃 겹침 수정",
        "rawSubject": "fix(video): 모바일 AI 포착 극적 순간 씬 아이템의 썸네일·조절 버튼 레이아웃 겹침 수정"
      },
      {
        "hash": "8350acb",
        "date": "2026-11-07",
        "type": "fix",
        "scope": "video",
        "message": "시퀀스 타임라인 영상 종료점 마감 정렬 및 원곡 배경음악 잔여 구간 연장 표시",
        "rawSubject": "fix(video): 시퀀스 타임라인 영상 종료점 마감 정렬 및 원곡 배경음악 잔여 구간 연장 표시"
      },
      {
        "hash": "2adf61e",
        "date": "2026-11-07",
        "type": "fix",
        "scope": "video",
        "message": "시간 절약률 요약 카드 제거 및 하단 상태바 시간 절약률 표시 복원",
        "rawSubject": "fix(video): 시간 절약률 요약 카드 제거 및 하단 상태바 시간 절약률 표시 복원"
      },
      {
        "hash": "93298ae",
        "date": "2026-11-07",
        "type": "fix",
        "scope": "video",
        "message": "씬 아이템 하단 중복 영상 방향 회전 카드 제거",
        "rawSubject": "fix(video): 씬 아이템 하단 중복 영상 방향 회전 카드 제거"
      }
    ]
  },
  {
    "version": "0.5.0",
    "title": "IndexedDB 스튜디오 작업 보관함 및 실시간 자동 저장 시스템",
    "date": "2026-11-06",
    "type": "major",
    "summary": "브라우저 IndexedDB 기반 스튜디오 작업 보관함을 구축하여 작업 중인 프로젝트가 실시간으로 자동 저장되고 언제든 복원할 수 있도록 지원합니다.",
    "totalCommits": 16,
    "commits": [
      {
        "hash": "898687f",
        "date": "2026-11-05",
        "type": "feat",
        "scope": "video",
        "message": "스튜디오 작업 보관함(IndexedDB) 및 자동 저장·불러오기 기능 구현",
        "rawSubject": "feat(video): 스튜디오 작업 보관함(IndexedDB) 및 자동 저장·불러오기 기능 구현"
      },
      {
        "hash": "3ee23a7",
        "date": "2026-11-06",
        "type": "feat",
        "scope": "video",
        "message": "스튜디오 상단 네비게이션에 보관함 탭 버튼 연결 및 IndexedDB 자동 저장 상태 연동",
        "rawSubject": "feat(video): 스튜디오 상단 네비게이션에 보관함 탭 버튼 연결 및 IndexedDB 자동 저장 상태 연동"
      },
      {
        "hash": "ce56614",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "빈 상태 자동저장 오류 수정 및 하단 고정 상태바(저장·시간절약률) UI 구현",
        "rawSubject": "fix(video): 빈 상태 자동저장 오류 수정 및 하단 고정 상태바(저장·시간절약률) UI 구현"
      },
      {
        "hash": "34ffca5",
        "date": "2026-11-06",
        "type": "style",
        "scope": "video",
        "message": "좌/우 패널 스크롤바 완전 숨김 처리",
        "rawSubject": "style(video): 좌/우 패널 스크롤바 완전 숨김 처리"
      },
      {
        "hash": "00135f3",
        "date": "2026-11-06",
        "type": "style",
        "scope": "video",
        "message": "좌/우 패널 여백 조절",
        "rawSubject": "style(video): 좌/우 패널 여백 조절"
      },
      {
        "hash": "ec42a56",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "타이틀 핑퐁 무한루프 및 자동저장 대기 멈춤 현상 수정",
        "rawSubject": "fix(video): 타이틀 핑퐁 무한루프 및 자동저장 대기 멈춤 현상 수정"
      },
      {
        "hash": "8947538",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "보관함에서 새 작업 시작 시 이전 세그먼트 및 스튜디오 상태 잔재 완전 초기화",
        "rawSubject": "fix(video): 보관함에서 새 작업 시작 시 이전 세그먼트 및 스튜디오 상태 잔재 완전 초기화"
      },
      {
        "hash": "196f585",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "영상 분석 모델 선택 및 폴백 목록에서 오류 빈발 Google Gemma 모델 제외",
        "rawSubject": "fix(video): 영상 분석 모델 선택 및 폴백 목록에서 오류 빈발 Google Gemma 모델 제외"
      },
      {
        "hash": "8897d34",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "아이폰 업로드 시 원본 촬영일자 메타데이터 우선 추출 및 파싱 개선",
        "rawSubject": "fix(video): 아이폰 업로드 시 원본 촬영일자 메타데이터 우선 추출 및 파싱 개선"
      },
      {
        "hash": "0fc52e4",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "하이라이트 생성 전 가짜 클립 및 시간 절약률 노출 제거, 원본 영상 미리보기 모드와 재생 실패 안내 추가",
        "rawSubject": "fix(video): 하이라이트 생성 전 가짜 클립 및 시간 절약률 노출 제거, 원본 영상 미리보기 모드와 재생 실패 안내 추가"
      },
      {
        "hash": "5d58ec3",
        "date": "2026-11-06",
        "type": "feat",
        "scope": "video",
        "message": "다국어(i18n) 번역 키 확장 및 모달 컴포넌트 다국어 지원 연동",
        "rawSubject": "feat(video): 다국어(i18n) 번역 키 확장 및 모달 컴포넌트 다국어 지원 연동"
      },
      {
        "hash": "5a610a0",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "헤더 및 앱 레벨 오류 배너·자막 다운로드 다국어(i18n) 누락 항목 추가 보완",
        "rawSubject": "fix(video): 헤더 및 앱 레벨 오류 배너·자막 다운로드 다국어(i18n) 누락 항목 추가 보완"
      },
      {
        "hash": "5f9e9b0",
        "date": "2026-11-06",
        "type": "style",
        "scope": "video",
        "message": "다국어(i18n) 파일 내 모든 이모지 제거 및 UI 텍스트 정제",
        "rawSubject": "style(video): 다국어(i18n) 파일 내 모든 이모지 제거 및 UI 텍스트 정제"
      },
      {
        "hash": "86683bc",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "업로드 영상 모달 메타데이터 줄바꿈·삭제 버튼 겹침 UI 수정 및 원본 영상 미리보기 다국어(i18n) 연동",
        "rawSubject": "fix(video): 업로드 영상 모달 메타데이터 줄바꿈·삭제 버튼 겹침 UI 수정 및 원본 영상 미리보기 다국어(i18n) 연동"
      },
      {
        "hash": "159bc21",
        "date": "2026-11-06",
        "type": "fix",
        "scope": "video",
        "message": "업로드 영상 목록 모달 메타데이터 폰트 축소(10px) 및 전용 CSS 분리로 텍스트-삭제버튼 겹침 현상 해결",
        "rawSubject": "fix(video): 업로드 영상 목록 모달 메타데이터 폰트 축소(10px) 및 전용 CSS 분리로 텍스트-삭제버튼 겹침 현상 해결"
      },
      {
        "hash": "4d80c39",
        "date": "2026-11-06",
        "type": "style",
        "scope": "video",
        "message": "업로드 영상 목록 모달 타이틀 크기 확대(13.5px) 및 좌측 정렬 수정",
        "rawSubject": "style(video): 업로드 영상 목록 모달 타이틀 크기 확대(13.5px) 및 좌측 정렬 수정"
      }
    ]
  },
  {
    "version": "0.4.1",
    "title": "AI 썸네일 추천 프레임 자동 연동 및 NLE 멀티트랙 타임라인 정밀 동기화",
    "date": "2026-11-05",
    "type": "patch",
    "summary": "AI가 가장 극적인 프레임을 분석하여 썸네일로 자동 추천하며, 시퀀스 타임라인 V1 영상과 A1 오디오 멀티트랙 동기화 및 끊김 현상을 개선했습니다.",
    "totalCommits": 13,
    "commits": [
      {
        "hash": "75b37de",
        "date": "2026-11-05",
        "type": "feat",
        "scope": "video",
        "message": "AI 직접 추천 썸네일 프레임 연동 및 썸네일 내 영상 오버레이 문구(상단·날짜·채널) 제거",
        "rawSubject": "feat(video): AI 직접 추천 썸네일 프레임 연동 및 썸네일 내 영상 오버레이 문구(상단·날짜·채널) 제거"
      },
      {
        "hash": "f6fef08",
        "date": "2026-11-05",
        "type": "fix",
        "scope": "video",
        "message": "데스크탑 모드 하단 불필요한 공백 제거",
        "rawSubject": "fix(video): 데스크탑 모드 하단 불필요한 공백 제거"
      },
      {
        "hash": "d91e81d",
        "date": "2026-11-05",
        "type": "fix",
        "scope": "video",
        "message": "지능 지수 미집계 모델을 최신 출시순으로 정렬",
        "rawSubject": "fix(video): 지능 지수 미집계 모델을 최신 출시순으로 정렬"
      },
      {
        "hash": "4ade89c",
        "date": "2026-11-05",
        "type": "feat",
        "scope": "video",
        "message": "시퀀스 타임라인 멀티트랙(V1 영상·A1 음악) 표시 및 음악 초과 클립 정리 기능 추가",
        "rawSubject": "feat(video): 시퀀스 타임라인 멀티트랙(V1 영상·A1 음악) 표시 및 음악 초과 클립 정리 기능 추가"
      },
      {
        "hash": "5e905b1",
        "date": "2026-11-05",
        "type": "perf",
        "scope": "video",
        "message": "영상 병합 프레임 페이싱 정밀 동기화 및 iOS/데스크탑 끊김 현상 개선",
        "rawSubject": "perf(video): 영상 병합 프레임 페이싱 정밀 동기화 및 iOS/데스크탑 끊김 현상 개선"
      },
      {
        "hash": "5fae131",
        "date": "2026-11-05",
        "type": "fix",
        "scope": "video",
        "message": "데스크탑 패널 하단 여백 복원 및 스크롤 끝 카드 잘림 방지",
        "rawSubject": "fix(video): 데스크탑 패널 하단 여백 복원 및 스크롤 끝 카드 잘림 방지"
      },
      {
        "hash": "fae81ce",
        "date": "2026-11-05",
        "type": "fix",
        "scope": "video",
        "message": "시퀀스 타임라인 세로줄 오류·클립 간 빈틈 제거 및 배경음악 미선택 UI 스타일 보정",
        "rawSubject": "fix(video): 시퀀스 타임라인 세로줄 오류·클립 간 빈틈 제거 및 배경음악 미선택 UI 스타일 보정"
      },
      {
        "hash": "46c0e8b",
        "date": "2026-11-05",
        "type": "fix",
        "scope": "video",
        "message": "데스크탑 패널 상하 하단 여백 제거 및 패널 자체 여백 추가",
        "rawSubject": "fix(video): 데스크탑 패널 상하 하단 여백 제거 및 패널 자체 여백 추가"
      },
      {
        "hash": "16cf52a",
        "date": "2026-11-05",
        "type": "feat",
        "scope": null,
        "message": "Revert \"fix(video): 데스크탑 패널 상하 하단 여백 제거 및 패널 자체 여백 추가\"",
        "rawSubject": "Revert \"fix(video): 데스크탑 패널 상하 하단 여백 제거 및 패널 자체 여백 추가\""
      },
      {
        "hash": "b05c728",
        "date": "2026-11-05",
        "type": "fix",
        "scope": "video",
        "message": "데스크탑 메인 상하 여백 제거 및 컬럼 내부 여백으로 잘림 방지",
        "rawSubject": "fix(video): 데스크탑 메인 상하 여백 제거 및 컬럼 내부 여백으로 잘림 방지"
      },
      {
        "hash": "4fa9cdc",
        "date": "2026-11-05",
        "type": "fix",
        "scope": "video",
        "message": "AI 추천 썸네일 프레임 버튼 넘침 방지·UI 보정 및 타이틀 토글 스위치 개선",
        "rawSubject": "fix(video): AI 추천 썸네일 프레임 버튼 넘침 방지·UI 보정 및 타이틀 토글 스위치 개선"
      },
      {
        "hash": "2e9d8f5",
        "date": "2026-11-05",
        "type": "feat",
        "scope": "video",
        "message": "헤더 브랜드 서브텍스트 배치·버튼 높이 통일·진행 모달 UI 개선 및 촬영 날짜 on/off 기능 추가",
        "rawSubject": "feat(video): 헤더 브랜드 서브텍스트 배치·버튼 높이 통일·진행 모달 UI 개선 및 촬영 날짜 on/off 기능 추가"
      },
      {
        "hash": "327366f",
        "date": "2026-11-05",
        "type": "refactor",
        "scope": "video",
        "message": "사용되지 않는 프로젝트 보관함 임포트 및 미사용 props 정리",
        "rawSubject": "refactor(video): 사용되지 않는 프로젝트 보관함 임포트 및 미사용 props 정리"
      }
    ]
  },
  {
    "version": "0.4.0",
    "title": "HyperFrames 키네틱 챕터 브릿지 모션 엔진 & GPS 역지오코딩",
    "date": "2026-11-04",
    "type": "major",
    "summary": "GSAP 결정론적 타임라인 기반 5단 키네틱 루버 와이프 챕터 브릿지 모션 엔진을 탑재하고, 촬영 날짜 플립 및 GPS 역지오코딩 장소명 자동 매핑을 지원합니다.",
    "totalCommits": 10,
    "commits": [
      {
        "hash": "4d869c0",
        "date": "2026-11-04",
        "type": "feat",
        "scope": "video",
        "message": "HyperFrames(GSAP 결정론적 타임라인) 기반 스토리 챕터 브릿지 모션 합성 엔진 구현",
        "rawSubject": "feat(video): HyperFrames(GSAP 결정론적 타임라인) 기반 스토리 챕터 브릿지 모션 합성 엔진 구현"
      },
      {
        "hash": "e26c1c9",
        "date": "2026-11-04",
        "type": "feat",
        "scope": "video",
        "message": "챕터 브릿지 모달 팝업 제거 및 5단 키네틱 루버 와이프·마스크 스플릿 타이포 연출 적용",
        "rawSubject": "feat(video): 챕터 브릿지 모달 팝업 제거 및 5단 키네틱 루버 와이프·마스크 스플릿 타이포 연출 적용"
      },
      {
        "hash": "7357529",
        "date": "2026-11-04",
        "type": "feat",
        "scope": "video",
        "message": "날짜 플립 탁상시계 및 장소 곡선 점선 이동 브릿지 연출 고도화",
        "rawSubject": "feat(video): 날짜 플립 탁상시계 및 장소 곡선 점선 이동 브릿지 연출 고도화"
      },
      {
        "hash": "764cf5e",
        "date": "2026-11-04",
        "type": "feat",
        "scope": "video",
        "message": "미디어 첨부 시 촬영일자 및 GPS 역지오코딩 장소명 자동 매핑 구현",
        "rawSubject": "feat(video): 미디어 첨부 시 촬영일자 및 GPS 역지오코딩 장소명 자동 매핑 구현"
      },
      {
        "hash": "b3bb872",
        "date": "2026-11-04",
        "type": "feat",
        "scope": "video",
        "message": "영상 패널 전체화면 확대 버튼 추가 및 재생 종료 후 처음부터 다시 재생 기능 구현",
        "rawSubject": "feat(video): 영상 패널 전체화면 확대 버튼 추가 및 재생 종료 후 처음부터 다시 재생 기능 구현"
      },
      {
        "hash": "aa9c261",
        "date": "2026-11-04",
        "type": "feat",
        "scope": "video",
        "message": "AI 포착 극적 순간 클립 리스트 촬영일시(시·분·초) 기준 시간순 정렬 기능 추가",
        "rawSubject": "feat(video): AI 포착 극적 순간 클립 리스트 촬영일시(시·분·초) 기준 시간순 정렬 기능 추가"
      },
      {
        "hash": "d3522e5",
        "date": "2026-11-04",
        "type": "feat",
        "scope": "video",
        "message": "AI 포착 극적 순간 영상 개별 90도 좌우 회전 기능 구현",
        "rawSubject": "feat(video): AI 포착 극적 순간 영상 개별 90도 좌우 회전 기능 구현"
      },
      {
        "hash": "47c3b6f",
        "date": "2026-11-04",
        "type": "style",
        "scope": "video",
        "message": "AI 포착 극적 순간 리스트 UI 개선 (썸네일 버튼 제거, 정렬 버튼 및 브릿지·촬영일시 스타일링)",
        "rawSubject": "style(video): AI 포착 극적 순간 리스트 UI 개선 (썸네일 버튼 제거, 정렬 버튼 및 브릿지·촬영일시 스타일링)"
      },
      {
        "hash": "fc41739",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "video",
        "message": "역지오코딩 CORS 오류 해결, 비디오 currentTime 예외 방어 및 AI 게이트웨이 503 자동 복구 구현",
        "rawSubject": "fix(video): 역지오코딩 CORS 오류 해결, 비디오 currentTime 예외 방어 및 AI 게이트웨이 503 자동 복구 구현"
      },
      {
        "hash": "860b100",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "video",
        "message": "역지오코딩 타임아웃 예외 처리 안정화 및 AI 썸네일 추천 사유 연동",
        "rawSubject": "fix(video): 역지오코딩 타임아웃 예외 처리 안정화 및 AI 썸네일 추천 사유 연동"
      }
    ]
  },
  {
    "version": "0.3.1",
    "title": "유튜브 호환 SRT 자막 다운로드 및 iOS Safari 재생 안정화",
    "date": "2026-11-04",
    "type": "patch",
    "summary": "유튜브 규격 다국어 SRT 자막 다운로드 지원, WebKit Bug 212275 회피, 캔버스 상시 하트비트 및 iOS Safari 하드웨어 디코더 파이프라인 안정화를 적용했습니다.",
    "totalCommits": 25,
    "commits": [
      {
        "hash": "271e49f",
        "date": "2026-11-04",
        "type": "style",
        "scope": "i18n",
        "message": "하단 자막 툴팁 문구 현행화",
        "rawSubject": "style(i18n): 하단 자막 툴팁 문구 현행화"
      },
      {
        "hash": "62aba72",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "video",
        "message": "비디오 스티칭 시 재생 지연 방어 및 캔버스 동기화 안정성 개선",
        "rawSubject": "fix(video): 비디오 스티칭 시 재생 지연 방어 및 캔버스 동기화 안정성 개선"
      },
      {
        "hash": "b5d6a9f",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "video",
        "message": "오버레이 오프스크린 캐싱 및 stalled 오인 버그 제거로 렌더링 프레임 드랍 해결",
        "rawSubject": "fix(video): 오버레이 오프스크린 캐싱 및 stalled 오인 버그 제거로 렌더링 프레임 드랍 해결"
      },
      {
        "hash": "4f0988e",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "video",
        "message": "상단 헤더 액션(새로시작·썸네일 다운로드) 정리 및 영상 다운로드 시퀀스 타임라인 하단 재배치",
        "rawSubject": "fix(video): 상단 헤더 액션(새로시작·썸네일 다운로드) 정리 및 영상 다운로드 시퀀스 타임라인 하단 재배치"
      },
      {
        "hash": "58f9f15",
        "date": "2026-11-04",
        "type": "style",
        "scope": "video",
        "message": "재병합 모달 오버레이 z-index 스타일 반영",
        "rawSubject": "style(video): 재병합 모달 오버레이 z-index 스타일 반영"
      },
      {
        "hash": "4a0197c",
        "date": "2026-11-04",
        "type": "feat",
        "scope": "video",
        "message": "데스크탑 설정 버튼 추가 및 만 나이(2살 미만 개월수) 표시 옵션 구현",
        "rawSubject": "feat(video): 데스크탑 설정 버튼 추가 및 만 나이(2살 미만 개월수) 표시 옵션 구현"
      },
      {
        "hash": "5f67c72",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "video",
        "message": "iOS Safari MP4 무음 오디오 트랙 블로킹 및 paused 상태 stop 유실 버그 수정",
        "rawSubject": "fix(video): iOS Safari MP4 무음 오디오 트랙 블로킹 및 paused 상태 stop 유실 버그 수정"
      },
      {
        "hash": "16d10cf",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "video",
        "message": "무음 영상 인코딩 시 오디오 코덱 MIME 제거 및 timeslice 1s 청크 스트리밍 적용",
        "rawSubject": "fix(video): 무음 영상 인코딩 시 오디오 코덱 MIME 제거 및 timeslice 1s 청크 스트리밍 적용"
      },
      {
        "hash": "eb6e754",
        "date": "2026-11-04",
        "type": "feat",
        "scope": "video",
        "message": "스튜디오 설정 내 자막 on/off 토글 및 유튜브 호환 다국어 SRT 자막 다운로드 기능 구현",
        "rawSubject": "feat(video): 스튜디오 설정 내 자막 on/off 토글 및 유튜브 호환 다국어 SRT 자막 다운로드 기능 구현"
      },
      {
        "hash": "1ef8d8e",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "video",
        "message": "WebKit Bug 212275 회피, 캔버스 상시 하트비트 및 VideoToolbox 플러시 딜레이 적용",
        "rawSubject": "fix(video): WebKit Bug 212275 회피, 캔버스 상시 하트비트 및 VideoToolbox 플러시 딜레이 적용"
      },
      {
        "hash": "53f582a",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "video",
        "message": "병합 실패 시 아이폰 상세 진단 리포트 및 원터치 복사 배너 적용",
        "rawSubject": "fix(video): 병합 실패 시 아이폰 상세 진단 리포트 및 원터치 복사 배너 적용"
      },
      {
        "hash": "2e2ad23",
        "date": "2026-11-04",
        "type": "feat",
        "scope": "video",
        "message": "AI 분석 모달 내 영상 썸네일 표시 및 실시간 작업·추론 단일 라인 표시로 개편",
        "rawSubject": "feat(video): AI 분석 모달 내 영상 썸네일 표시 및 실시간 작업·추론 단일 라인 표시로 개편"
      },
      {
        "hash": "5f154e3",
        "date": "2026-11-04",
        "type": "style",
        "scope": "video",
        "message": "AI 분석 모달 내 실시간 추론 박스 배경을 화이트톤으로 변경 및 텍스트 시인성 개선",
        "rawSubject": "style(video): AI 분석 모달 내 실시간 추론 박스 배경을 화이트톤으로 변경 및 텍스트 시인성 개선"
      },
      {
        "hash": "5ec2504",
        "date": "2026-11-04",
        "type": "style",
        "scope": "video",
        "message": "AI 분석 모달 내 중복 헤더 제거 및 실시간 작업 문구를 1줄 고정 말줄임·소형 폰트로 개편",
        "rawSubject": "style(video): AI 분석 모달 내 중복 헤더 제거 및 실시간 작업 문구를 1줄 고정 말줄임·소형 폰트로 개편"
      },
      {
        "hash": "e550387",
        "date": "2026-11-04",
        "type": "style",
        "scope": "video",
        "message": "AI 분석 모달 내 작업/추론 문구를 11px 소형 폰트 및 2줄 고정 높이 말줄임으로 개편",
        "rawSubject": "style(video): AI 분석 모달 내 작업/추론 문구를 11px 소형 폰트 및 2줄 고정 높이 말줄임으로 개편"
      },
      {
        "hash": "16838a7",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "video",
        "message": "모바일 Safari 구간 전환 시 멈춤 프레임 녹화 및 영상 재생 길이 초과 버그 수정",
        "rawSubject": "fix(video): 모바일 Safari 구간 전환 시 멈춤 프레임 녹화 및 영상 재생 길이 초과 버그 수정"
      },
      {
        "hash": "9b1b654",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "video",
        "message": "AI 분석 모달 디자인 복구 및 듀얼 워커 0ms 핑퐁 파이프라인 적용",
        "rawSubject": "fix(video): AI 분석 모달 디자인 복구 및 듀얼 워커 0ms 핑퐁 파이프라인 적용"
      },
      {
        "hash": "54d9d78",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "video",
        "message": "아이폰 저전력 모드 및 Safari 자동재생 차단 시 프레임 스텝 모드 자동 폴백 적용",
        "rawSubject": "fix(video): 아이폰 저전력 모드 및 Safari 자동재생 차단 시 프레임 스텝 모드 자동 폴백 적용"
      },
      {
        "hash": "a29bea1",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "video",
        "message": "대기 워커 백그라운드 자동재생으로 인한 2번째 씬 조기 스킵 버그 수정",
        "rawSubject": "fix(video): 대기 워커 백그라운드 자동재생으로 인한 2번째 씬 조기 스킵 버그 수정"
      },
      {
        "hash": "57e7e78",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "reportist-video",
        "message": "use single hardware decoder pipeline and active playback accumulator so scene 2 plays completely on iOS",
        "rawSubject": "fix(reportist-video): use single hardware decoder pipeline and active playback accumulator so scene 2 plays completely on iOS"
      },
      {
        "hash": "8148d28",
        "date": "2026-11-04",
        "type": "feat",
        "scope": "video",
        "message": "상단 헤더 내 데스크탑 AI 모델 선택 트리거 제거 (설정 모달로 일원화)",
        "rawSubject": "feat(video): 상단 헤더 내 데스크탑 AI 모델 선택 트리거 제거 (설정 모달로 일원화)"
      },
      {
        "hash": "4df8739",
        "date": "2026-11-04",
        "type": "feat",
        "scope": "video",
        "message": "영상 공유 화면 좌우 풀 너비 확장 및 5·4·3·2·1 반응형 그리드 적용",
        "rawSubject": "feat(video): 영상 공유 화면 좌우 풀 너비 확장 및 5·4·3·2·1 반응형 그리드 적용"
      },
      {
        "hash": "f601f9e",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "video",
        "message": "모바일에서 AI 포착 극적 순간 카드 헤더 찌그러짐 수정 및 액션 그룹 분리 정렬",
        "rawSubject": "fix(video): 모바일에서 AI 포착 극적 순간 카드 헤더 찌그러짐 수정 및 액션 그룹 분리 정렬"
      },
      {
        "hash": "96c8bee",
        "date": "2026-11-04",
        "type": "feat",
        "scope": "video",
        "message": "영상 업로드 패널 테두리 점선(dashed) 스타일 적용 및 호버 인터랙션 개선",
        "rawSubject": "feat(video): 영상 업로드 패널 테두리 점선(dashed) 스타일 적용 및 호버 인터랙션 개선"
      },
      {
        "hash": "e5bcd15",
        "date": "2026-11-04",
        "type": "fix",
        "scope": "video",
        "message": "모바일 AI 극적 순간 카드 헤더 내 불필요한 세로 공백 제거",
        "rawSubject": "fix(video): 모바일 AI 극적 순간 카드 헤더 내 불필요한 세로 공백 제거"
      }
    ]
  },
  {
    "version": "0.3.0",
    "title": "유튜브 영상 공유 커뮤니티 갤러리 및 DB 연동",
    "date": "2026-11-03",
    "type": "major",
    "summary": "완성된 하이라이트 영상을 사용자들과 공유할 수 있는 커뮤니티 갤러리 탭 및 Supabase DB 연동을 추가하고 모던 디자인 시스템 테마를 전면 적용했습니다.",
    "totalCommits": 10,
    "commits": [
      {
        "hash": "246609f",
        "date": "2026-11-03",
        "type": "feat",
        "scope": "video",
        "message": "유튜브 영상 공유 커뮤니티 갤러리 및 Supabase DB 연동 기능 추가",
        "rawSubject": "feat(video): 유튜브 영상 공유 커뮤니티 갤러리 및 Supabase DB 연동 기능 추가"
      },
      {
        "hash": "60eea53",
        "date": "2026-11-03",
        "type": "feat",
        "scope": "video",
        "message": "영상 공유 커뮤니티 UI 문구 다듬기 및 초기 시드 비디오 노출 처리",
        "rawSubject": "feat(video): 영상 공유 커뮤니티 UI 문구 다듬기 및 초기 시드 비디오 노출 처리"
      },
      {
        "hash": "4787fb2",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "AI 썸네일 프레임 캡처 및 미리보기 표시 오류 수정",
        "rawSubject": "fix(video): AI 썸네일 프레임 캡처 및 미리보기 표시 오류 수정"
      },
      {
        "hash": "47614d4",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "영상 공유 커뮤니티 UI를 기존 모던 디자인 시스템 및 카드 테마로 전면 통일",
        "rawSubject": "fix(video): 영상 공유 커뮤니티 UI를 기존 모던 디자인 시스템 및 카드 테마로 전면 통일"
      },
      {
        "hash": "ae3ab35",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "썸네일 상단 불필요 문구 및 배지 제거",
        "rawSubject": "fix(video): 썸네일 상단 불필요 문구 및 배지 제거"
      },
      {
        "hash": "e1a5b62",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "모바일 상단 네비게이션 탭 아이콘화 및 NEW 배지 제거로 우측 버튼 잘림 해결",
        "rawSubject": "fix(video): 모바일 상단 네비게이션 탭 아이콘화 및 NEW 배지 제거로 우측 버튼 잘림 해결"
      },
      {
        "hash": "be835f3",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "모바일 상단바 AI 모델/언어/설정 메뉴를 설정 모달로 분리하여 버튼 잘림 현상 해결",
        "rawSubject": "fix(video): 모바일 상단바 AI 모델/언어/설정 메뉴를 설정 모달로 분리하여 버튼 잘림 현상 해결"
      },
      {
        "hash": "a9fc7e3",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "모바일 상단바 영상 목록 및 액션 버튼 레이아웃 깨짐 현상 수정",
        "rawSubject": "fix(video): 모바일 상단바 영상 목록 및 액션 버튼 레이아웃 깨짐 현상 수정"
      },
      {
        "hash": "480987d",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "인트로 겹침 및 BGM 순간이동 버그 수정 (오디오 동기화·타임라인 오프셋 반영)",
        "rawSubject": "fix(video): 인트로 겹침 및 BGM 순간이동 버그 수정 (오디오 동기화·타임라인 오프셋 반영)"
      },
      {
        "hash": "5c78a8c",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "시퀀스 타임라인 인트로/아웃트로 싱크 불일치 버그 수정",
        "rawSubject": "fix(video): 시퀀스 타임라인 인트로/아웃트로 싱크 불일치 버그 수정"
      }
    ]
  },
  {
    "version": "0.2.1",
    "title": "다국어(i18n 7개국어) 지원 및 상단 헤더·모델 선택창 최적화",
    "date": "2026-11-03",
    "type": "patch",
    "summary": "영어/한국어 등 7개 언어 i18n 시스템 구축, 카드형 AI 비전 모델 선택 모달 개선, 아이폰 구간 병합 멈춤 버그를 수정했습니다.",
    "totalCommits": 14,
    "commits": [
      {
        "hash": "955a447",
        "date": "2026-11-02",
        "type": "fix",
        "scope": "video",
        "message": "브라우저 기본 body 마진 제거, 좌측 패널 축소 및 우측 패널 확장(44:56), 영상 100% 꽉 채움 적용",
        "rawSubject": "fix(video): 브라우저 기본 body 마진 제거, 좌측 패널 축소 및 우측 패널 확장(44:56), 영상 100% 꽉 채움 적용"
      },
      {
        "hash": "f37243c",
        "date": "2026-11-02",
        "type": "fix",
        "scope": "video",
        "message": "빈 영상 플레이어 모서리 검은 테두리(블리드) 제거 및 빈 상태/재생 상태 배경 스타일 분리",
        "rawSubject": "fix(video): 빈 영상 플레이어 모서리 검은 테두리(블리드) 제거 및 빈 상태/재생 상태 배경 스타일 분리"
      },
      {
        "hash": "5c420b1",
        "date": "2026-11-03",
        "type": "feat",
        "scope": "video",
        "message": "다국어(i18n) 시스템 구축 및 영어 기본값·한국어 포함 7개 언어 지원 적용",
        "rawSubject": "feat(video): 다국어(i18n) 시스템 구축 및 영어 기본값·한국어 포함 7개 언어 지원 적용"
      },
      {
        "hash": "2a91e2f",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "다국어 선택 UI를 모델 선택창 스타일의 모달 팝업으로 개편 및 CSS 깨짐 수정",
        "rawSubject": "fix(video): 다국어 선택 UI를 모델 선택창 스타일의 모달 팝업으로 개편 및 CSS 깨짐 수정"
      },
      {
        "hash": "d47a5bb",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "모바일 상단 헤더 레이아웃 최적화 및 1열 통합 세로 스크롤 지원",
        "rawSubject": "fix(video): 모바일 상단 헤더 레이아웃 최적화 및 1열 통합 세로 스크롤 지원"
      },
      {
        "hash": "b5f59c6",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "업로드 영상 팝업 버튼 스타일 및 상하단 영역 UI 정돈",
        "rawSubject": "fix(video): 업로드 영상 팝업 버튼 스타일 및 상하단 영역 UI 정돈"
      },
      {
        "hash": "fa839fa",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "AI 모델 선택 모달의 파라미터·지능티어·태그 등 다국어 번역 미흡 항목 전면 개선",
        "rawSubject": "fix(video): AI 모델 선택 모달의 파라미터·지능티어·태그 등 다국어 번역 미흡 항목 전면 개선"
      },
      {
        "hash": "fd82ceb",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "Nemotron 3.5 Super VL 모델 제거 및 전체 모델명에서 '(free)' 표기 삭제",
        "rawSubject": "fix(video): Nemotron 3.5 Super VL 모델 제거 및 전체 모델명에서 '(free)' 표기 삭제"
      },
      {
        "hash": "ccaa2db",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "Nemotron 3.5 Super VL 모델 필터링 제외 및 전체 모델명 '(free)' 표기 전면 삭제",
        "rawSubject": "fix(video): Nemotron 3.5 Super VL 모델 필터링 제외 및 전체 모델명 '(free)' 표기 전면 삭제"
      },
      {
        "hash": "0a6f3ef",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "모델 정렬 순서를 지능순으로 변경 및 최고 지능 모델 기본 선택 적용",
        "rawSubject": "fix(video): 모델 정렬 순서를 지능순으로 변경 및 최고 지능 모델 기본 선택 적용"
      },
      {
        "hash": "880ae0b",
        "date": "2026-11-03",
        "type": "feat",
        "scope": "video",
        "message": "배경음악 오디오 보관함 팝업 및 내장 음원 3종 선택 지원",
        "rawSubject": "feat(video): 배경음악 오디오 보관함 팝업 및 내장 음원 3종 선택 지원"
      },
      {
        "hash": "ba2004d",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "상단 헤더 로고를 관리자와 동일한 Reportist 브랜드 로고로 통일",
        "rawSubject": "fix(video): 상단 헤더 로고를 관리자와 동일한 Reportist 브랜드 로고로 통일"
      },
      {
        "hash": "6741f1a",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "모바일 배경음악 카드 레이아웃 오버플로 및 줄바꿈 깨짐 수정",
        "rawSubject": "fix(video): 모바일 배경음악 카드 레이아웃 오버플로 및 줄바꿈 깨짐 수정"
      },
      {
        "hash": "9169512",
        "date": "2026-11-03",
        "type": "fix",
        "scope": "video",
        "message": "아이폰 구간 병합 멈춤 해결 (타임아웃·프레임 스텝 폴백·MP4 녹화)",
        "rawSubject": "fix(video): 아이폰 구간 병합 멈춤 해결 (타임아웃·프레임 스텝 폴백·MP4 녹화)"
      }
    ]
  },
  {
    "version": "0.2.0",
    "title": "NLE 멀티트랙 스튜디오 & 디자인 전면 리뉴얼",
    "date": "2026-11-03",
    "type": "major",
    "summary": "NLE 멀티트랙 타임라인, BGM 신디사이저, Remotion 감성의 프로 스튜디오 에디터 구축 및 깔끔하고 직관적인 모던 디자인 시스템으로 전면 리뉴얼했습니다.",
    "totalCommits": 19,
    "commits": [
      {
        "hash": "2f76a9e",
        "date": "2026-10-28",
        "type": "feat",
        "scope": "video",
        "message": "Remotion 스타일 프로 비디오 스튜디오 에디터, NLE 멀티트랙 타임라인, BGM 신디사이저 및 클립 인스펙터 구현",
        "rawSubject": "feat(video): Remotion 스타일 프로 비디오 스튜디오 에디터, NLE 멀티트랙 타임라인, BGM 신디사이저 및 클립 인스펙터 구현"
      },
      {
        "hash": "e55142d",
        "date": "2026-10-28",
        "type": "feat",
        "scope": "video",
        "message": "첫 화면부터 Remotion 스타일 다크 NLE 스튜디오 에디터로 전면 개편",
        "rawSubject": "feat(video): 첫 화면부터 Remotion 스타일 다크 NLE 스튜디오 에디터로 전면 개편"
      },
      {
        "hash": "d3c0270",
        "date": "2026-10-28",
        "type": "feat",
        "scope": "video",
        "message": "깔끔하고 정갈한 16:9 AI 영상 스튜디오 전면 리뉴얼",
        "rawSubject": "feat(video): 깔끔하고 정갈한 16:9 AI 영상 스튜디오 전면 리뉴얼"
      },
      {
        "hash": "9fa14eb",
        "date": "2026-10-28",
        "type": "fix",
        "scope": "video",
        "message": "비디오 재생/일시정지 및 프로그레스 바 버그 수정, 16:9 인터랙티브 시퀀스 타임라인 에디터 트랙 추가",
        "rawSubject": "fix(video): 비디오 재생/일시정지 및 프로그레스 바 버그 수정, 16:9 인터랙티브 시퀀스 타임라인 에디터 트랙 추가"
      },
      {
        "hash": "4a44b97",
        "date": "2026-10-28",
        "type": "feat",
        "scope": "video",
        "message": "사용자 BGM 직접 업로드, 제목·채널·촬영일자 오버레이 자막, 인트로/아웃트로 옵션 및 병합 멈춤 버그 수정",
        "rawSubject": "feat(video): 사용자 BGM 직접 업로드, 제목·채널·촬영일자 오버레이 자막, 인트로/아웃트로 옵션 및 병합 멈춤 버그 수정"
      },
      {
        "hash": "982b8fa",
        "date": "2026-10-28",
        "type": "feat",
        "scope": "video",
        "message": "씬별 자막·촬영일자 편집, GPS 지도 연동, 인트로/아웃트로 동영상 삽입 및 AI 실시간 추론 콘솔 구현",
        "rawSubject": "feat(video): 씬별 자막·촬영일자 편집, GPS 지도 연동, 인트로/아웃트로 동영상 삽입 및 AI 실시간 추론 콘솔 구현"
      },
      {
        "hash": "cb7aefa",
        "date": "2026-10-29",
        "type": "fix",
        "scope": "video",
        "message": "영상 분석 추론 과정 실시간 스트리밍 적용 및 AI 추론 콘솔 멈춤 현상 해결",
        "rawSubject": "fix(video): 영상 분석 추론 과정 실시간 스트리밍 적용 및 AI 추론 콘솔 멈춤 현상 해결"
      },
      {
        "hash": "dfc0a2a",
        "date": "2026-10-29",
        "type": "feat",
        "scope": "video",
        "message": "선택 씬 자막·날짜·위치 편집을 'AI가 포착한 극적 순간' 목록 내 인라인으로 통합",
        "rawSubject": "feat(video): 선택 씬 자막·날짜·위치 편집을 'AI가 포착한 극적 순간' 목록 내 인라인으로 통합"
      },
      {
        "hash": "59cdebb",
        "date": "2026-10-29",
        "type": "fix",
        "scope": "video",
        "message": "AI가 포착한 극적 순간 목록의 재생 중 표시가 레이아웃을 흔들던 문제 수정",
        "rawSubject": "fix(video): AI가 포착한 극적 순간 목록의 재생 중 표시가 레이아웃을 흔들던 문제 수정"
      },
      {
        "hash": "3d19f71",
        "date": "2026-10-29",
        "type": "feat",
        "scope": "video,gateway",
        "message": "유튜브 링크·영상 키로 배경음악 오디오 추출 지원",
        "rawSubject": "feat(video,gateway): 유튜브 링크·영상 키로 배경음악 오디오 추출 지원"
      },
      {
        "hash": "3cd856a",
        "date": "2026-10-29",
        "type": "feat",
        "scope": "video",
        "message": "지능·속도·레이턴시 카드형 AI 모델 선택 모달 추가 및 가장 빠른 비전 모델 기본 선택",
        "rawSubject": "feat(video): 지능·속도·레이턴시 카드형 AI 모델 선택 모달 추가 및 가장 빠른 비전 모델 기본 선택"
      },
      {
        "hash": "8efc0a8",
        "date": "2026-10-31",
        "type": "revert",
        "scope": "youtube",
        "message": "유튜브 오디오 추출 기능 및 Analyzer 작업자 코드 전면 롤백",
        "rawSubject": "revert(youtube): 유튜브 오디오 추출 기능 및 Analyzer 작업자 코드 전면 롤백"
      },
      {
        "hash": "48d4afb",
        "date": "2026-11-02",
        "type": "feat",
        "scope": "video",
        "message": "와이드 스튜디오 레이아웃 확장 및 영상 상단 문구·BGM 업로드·우측 극적순간/인아웃트로 재배치",
        "rawSubject": "feat(video): 와이드 스튜디오 레이아웃 확장 및 영상 상단 문구·BGM 업로드·우측 극적순간/인아웃트로 재배치"
      },
      {
        "hash": "790f1be",
        "date": "2026-11-02",
        "type": "feat",
        "scope": "video",
        "message": "풀와이드 레이아웃 적용, 문구 및 인아웃트로 스위치 정렬 수정, 상단바 영상목록 모달 통합",
        "rawSubject": "feat(video): 풀와이드 레이아웃 적용, 문구 및 인아웃트로 스위치 정렬 수정, 상단바 영상목록 모달 통합"
      },
      {
        "hash": "71188dd",
        "date": "2026-11-02",
        "type": "feat",
        "scope": "video",
        "message": "하단 버튼 상단 헤더 이전 및 IDE 스타일 100vh 무스크롤 독립 패널 레이아웃 적용",
        "rawSubject": "feat(video): 하단 버튼 상단 헤더 이전 및 IDE 스타일 100vh 무스크롤 독립 패널 레이아웃 적용"
      },
      {
        "hash": "244c0a3",
        "date": "2026-11-02",
        "type": "feat",
        "scope": "video",
        "message": "Vercel 스타일 1px 직선 분할 패널 레이아웃 적용 (0px 갭, 둥근 모서리/여백 제거)",
        "rawSubject": "feat(video): Vercel 스타일 1px 직선 분할 패널 레이아웃 적용 (0px 갭, 둥근 모서리/여백 제거)"
      },
      {
        "hash": "526cb44",
        "date": "2026-11-02",
        "type": "feat",
        "scope": null,
        "message": "Revert \"feat(video): Vercel 스타일 1px 직선 분할 패널 레이아웃 적용 (0px 갭, 둥근 모서리/여백 제거)\"",
        "rawSubject": "Revert \"feat(video): Vercel 스타일 1px 직선 분할 패널 레이아웃 적용 (0px 갭, 둥근 모서리/여백 제거)\""
      },
      {
        "hash": "858a4bc",
        "date": "2026-11-02",
        "type": "feat",
        "scope": "video",
        "message": "좌측 패널 폭 최적화, 패널 여백 통일 및 카드 타이틀·아이콘 상단 좌측 밀착 정렬",
        "rawSubject": "feat(video): 좌측 패널 폭 최적화, 패널 여백 통일 및 카드 타이틀·아이콘 상단 좌측 밀착 정렬"
      },
      {
        "hash": "07b8c25",
        "date": "2026-11-02",
        "type": "feat",
        "scope": "video",
        "message": "모델 지능·속도 하드코딩 및 임의 추정치 제거, 원천 데이터 수신값 100% 신뢰 구조로 전환",
        "rawSubject": "feat(video): 모델 지능·속도 하드코딩 및 임의 추정치 제거, 원천 데이터 수신값 100% 신뢰 구조로 전환"
      }
    ]
  },
  {
    "version": "0.1.1",
    "title": "16:9 유튜브 스마트 크롭 및 실시간 추론 대시보드 개선",
    "date": "2026-11-03",
    "type": "patch",
    "summary": "16:9 유튜브 규격 스마트 크롭 정렬 및 비전 AI 실시간 추론 대시보드 파이프라인을 개선했습니다.",
    "totalCommits": 2,
    "commits": [
      {
        "hash": "f4a6631",
        "date": "2026-10-27",
        "type": "feat",
        "scope": "video",
        "message": "16:9 유튜브 규격 크롭, 영상 멈춤 버그 수정, 구간 삭제·재병합 및 실시간 추론 대시보드 구현",
        "rawSubject": "feat(video): 16:9 유튜브 규격 크롭, 영상 멈춤 버그 수정, 구간 삭제·재병합 및 실시간 추론 대시보드 구현"
      },
      {
        "hash": "48c37de",
        "date": "2026-10-28",
        "type": "fix",
        "scope": "video",
        "message": "16:9 소스 스마트 크롭 정렬(우측 여백/좌측 쏠림 해결), 유튜브 아이콘 크기 고정, 추론 콘솔 고대비 개선 및 파이프라인 자동 연결",
        "rawSubject": "fix(video): 16:9 소스 스마트 크롭 정렬(우측 여백/좌측 쏠림 해결), 유튜브 아이콘 크기 고정, 추론 콘솔 고대비 개선 및 파이프라인 자동 연결"
      }
    ]
  },
  {
    "version": "0.1.0",
    "title": "AI 극적 하이라이트 영상 생성기 최초 구축",
    "date": "2026-11-03",
    "type": "major",
    "summary": "OpenRouter 멀티모달 비전 모델 기반 다중 프레임 시각 분석 및 AI 극적 순간 자동 포착 하이라이트 생성기 초기 버전을 출시했습니다.",
    "totalCommits": 3,
    "commits": [
      {
        "hash": "f5e98a1",
        "date": "2026-10-27",
        "type": "feat",
        "scope": "video",
        "message": "AI 기반 극적 하이라이트 영상 생성기(reportist-video) 구축",
        "rawSubject": "feat(video): AI 기반 극적 하이라이트 영상 생성기(reportist-video) 구축"
      },
      {
        "hash": "4fae9f8",
        "date": "2026-10-27",
        "type": "feat",
        "scope": "chat,video,seo",
        "message": "Reportist 공식 브랜드 로고·파비콘 통합 적용 및 구글 검색엔진 최적화(SEO) 구축",
        "rawSubject": "feat(chat,video,seo): Reportist 공식 브랜드 로고·파비콘 통합 적용 및 구글 검색엔진 최적화(SEO) 구축"
      },
      {
        "hash": "096843e",
        "date": "2026-10-27",
        "type": "feat",
        "scope": "video,gateway",
        "message": "OpenRouter 비디오 잔액 오류 해결을 위한 다중 프레임 시각 분석 전환 및 게이트웨이 폴백 강화",
        "rawSubject": "feat(video,gateway): OpenRouter 비디오 잔액 오류 해결을 위한 다중 프레임 시각 분석 전환 및 게이트웨이 폴백 강화"
      }
    ]
  }
];
