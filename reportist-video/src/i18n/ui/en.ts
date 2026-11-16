// src/i18n/ui/en.ts
// 새 스튜디오 흐름에서 쓰는 UI 문구의 영어 번역.
// 키는 화면에 남아 있던 한국어 원문(공백 정규화)이며, 기존 dict에 없는 문구만 담는다.
export const uiEn: Record<string, string> = {
  '시작 화면': 'Opening',
  '영상 맨 앞에 나올 오프닝을 골라요. 스타일을 누르면 왼쪽 미리보기에서 바로 재생돼요.':
    'Choose the opening that plays at the very start. Tap a style to preview it instantly on the left.',
  '영상 올리기': 'Upload videos',
  '원본 준비': 'Source clips',
  '영상을 올리고 순서와 촬영 장소를 확인해요. 여러 개를 한 번에 올려도 돼요.':
    'Upload your clips, then check the order and shooting location. You can add several at once.',
  'AI 하이라이트': 'AI highlights',
  '장면 추출': 'Scene picks',
  'AI가 영상에서 가장 볼만한 장면만 골라 짧게 잘라줘요. 이 단계에서 한 번만 누르면 돼요.':
    'AI picks only the most watchable moments and trims them short. You only need to tap once here.',
  '장면 전환': 'Transition',
  '날짜나 장소가 바뀌는 장면 사이에 들어가는 전환이에요. 지금 스타일을 미리 골라둘 수 있어요.':
    'A transition between scenes where the date or place changes. You can preselect the style now.',
  '영상 마지막 인사를 골라요. 스타일을 누르면 왼쪽 미리보기에서 바로 재생돼요.':
    'Choose the sign-off at the end. Tap a style to preview it on the left.',
  배경음악: 'Background music',
  '영상 전체에 깔리는 노래를 골라요. 어떤 단계를 편집하든 언제든 바꿀 수 있어요.':
    'Choose the track that plays throughout the video. You can change it at any step.',
  '장면 다듬기': 'Trim scenes',
  'AI가 고른 장면 중 지금 선택한 컷 하나만 다듬어요. 타임라인에서 컷을 누르면 그 컷으로 바뀌어요.':
    'Fine-tune only the clip selected right now. Tap a clip on the timeline to switch to it.',
  '날짜나 장소가 바뀌는 컷 사이에 들어가는 장면 전환이에요. 켜 둔 곳만 타임라인에 표시돼요.':
    'A transition between clips where the date or place changes. Only enabled spots appear on the timeline.',
  '손목시계 회전': 'Watch spin',
  '달력 넘기기': 'Calendar flip',
  '네온 디지털': 'Neon digital',
  '구불구불 경로': 'Winding route',
  '3D 지구본': '3D globe',
  '탑승권 티켓': 'Boarding pass',
  '촬영일시 순으로 정렬했어요.': 'Sorted by capture time.',
  '9월 10일': 'Sep 10',
  '9월 12일': 'Sep 12',
  '9월 14일': 'Sep 14',
  '첫 장면': 'First scene',
  '다음 장면': 'Next scene',
  '주요 메뉴': 'Main menu',
  '편집 순서': 'Edit order',
  '처음 만드는 순서': 'Create order',
  '1번부터 8번까지, 순서대로만 눌러주세요': 'Steps 1 to 8 — just follow the order.',
  '1번부터 7번까지, 순서대로만 눌러주세요': 'Steps 1 to 7 — just follow the order.',
  '영상 올리기와 AI 하이라이트까지 이 화면에서 한 번에 끝나요.':
    'Upload and AI highlights are all done on this screen.',
  '썸네일': 'Thumbnail',
  '대표 이미지': 'Cover image',
  '유튜브에 올릴 16:9 대표 이미지를 만들어요. AI 추천 프레임과 타이틀을 그대로 쓸 수 있어요.':
    'Create the 16:9 cover image for YouTube. Use the AI-recommended frame and title as-is.',
  '편집한 영상과 자막 파일을 내려받아요. 모든 편집이 끝난 뒤 마지막으로 눌러주세요.':
    'Download the finished video and subtitle file. Press this last, after all editing is done.',
  '저장 가능': 'Ready to save',
  '타임라인을 움직이면 지금 위치에 맞는 설정만 오른쪽에 보여요.':
    'Move the timeline and the inspector shows only the settings for that spot.',
  '{count}개 준비됨': '{count} ready',
  '올리기 필요': 'Upload needed',
  '분석 중 {percent}%': 'Analyzing {percent}%',
  '{count}개 컷 완성': '{count} clips ready',
  '{count}개 컷': '{count} clips',
  '미리 고르기': 'Preselect',
  '{count}곳 켜짐': '{count} on',
  '{count}곳 가능': '{count} available',
  '자동 감지 없음': 'No auto-detect',
  '누락 영상 일괄 연결': 'Relink missing videos',
  '보관된 하이라이트 세션': 'Saved highlight session',
  'AI 하이라이트 영상': 'AI highlight video',
  '영상 내보내기 & 다운로드': 'Export & download',
  '새 영상 만들기': 'New video',
  '영상 하나만 올리면 시작돼요': 'Upload one video to start',
  '1번 인트로 → 2번 영상 올리기 → 3번 AI 하이라이트 → 4번 브릿지 → 5번 아웃트로 → 6번 노래':
    '1 Intro → 2 Upload → 3 AI highlights → 4 Bridge → 5 Outro → 6 Music',
  '새 프로젝트로 시작': 'Start a new project',
  '미리보기 재생': 'Play preview',
  '재선택 필요': 'Reselect needed',
  '배경음악이 영상 전체 길이에 맞춰 배속으로 딱 맞게 동기화돼요':
    'Music is speed-synced to match the full video length',
  '배속 동기화 ({speed}x · {duration})': 'Speed sync ({speed}x · {duration})',
  '🎵 {duration} 음악 끝': '🎵 {duration} music end',
  '장면 전환 {from} → {to} ({seconds}s) · 눌러서 수정':
    'Transition {from} → {to} ({seconds}s) · tap to edit',
  '여기를 누르면 날짜·장소가 바뀌는 장면 전환을 넣을 수 있어요':
    'Tap here to add a transition where the date or place changes',
  '노래 설정 열기': 'Open music settings',
  '{name} — {cycle}회차 반복 재생 구간 ({start} ~ {end}, +{extra}s)':
    '{name} — repeat #{cycle} ({start} ~ {end}, +{extra}s)',
  '{name} — 1회차 원곡 재생 ({start} ~ {end} / 원곡 총 {total})':
    '{name} — original track, pass 1 ({start} ~ {end} / total {total})',
  '{cycle}회차 반복 · {name}': 'Repeat #{cycle} · {name}',
  '+{seconds}s 반복': '+{seconds}s repeat',
  '{duration} / 원곡 {total}': '{duration} / original {total}',
  '필요할 때만 펼치기': 'Expand only when needed',
  'AI가 직접 추천한 베스트 프레임과 타이틀로 완성된 16:9 맞춤 썸네일이에요.':
    'A 16:9 thumbnail built from an AI-recommended frame and title.',
  '아래 하이라이트 장면의 [썸네일] 버튼을 눌러 배경 이미지를 바꿀 수도 있어요.':
    'You can also tap [Thumbnail] on a highlight scene below to change the background.',
  '인트로 모션을 미리 재생해요': 'Play the intro motion preview',
  '영상 끌어다 놓기': 'Drag & drop videos',
  '또는 눌러서 휴대폰 영상을 골라요. 여러 개를 한 번에 올려도 돼요.':
    'Or tap to pick videos from your phone. You can add several at once.',
  '촬영 장소 (예: 해운대 해수욕장)': 'Shooting location (e.g. Haeundae Beach)',
  '{name} 촬영 장소': 'Shooting location of {name}',
  '영상 빼기': 'Remove video',
  '{name} 빼기': 'Remove {name}',
  '영상 올리러 가기': 'Go to upload',
  'AI가 하이라이트를 찾고 있어요': 'AI is finding highlights',
  '2번 컷 다듬기': 'Trim clip in step 2',
  '장면 전환 (브릿지)': 'Transition (bridge)',
  '브릿지 미리보기': 'Bridge preview',
  '날짜 넘어가는 효과': 'Date transition',
  '장소 이동 효과': 'Location transition',
  '2번 컷으로 가기': 'Go to clip step',
  '컷 설정으로 가기': 'Go to clip settings',
  '장소 없음': 'No location',
  '날짜 없음': 'No date',
  '이 장면 전환 넣기': 'Add this transition',
  '모든 브릿지에 같은 스타일': 'Same style for all bridges',
  '이 장면 전환 켜기': 'Enable this transition',
  '자막 다운로드': 'Download subtitles',
  '다듬는 중...': 'Refining...',
  '이 컷만 보기': 'View this clip only',
  '원본 영상 추가 · AI 다시 뽑기': 'Add source video · Re-run AI',
  '원본 영상 추가': 'Add source video',
  'AI 하이라이트 다시 뽑기': 'Re-run AI highlights',
  '브릿지 단계에서 이 장면 전환을 설정해요': 'Set this transition in the bridge step',
  '브릿지 단계에서 이 장면 전환을 다시 켜요': 'Re-enable this transition in the bridge step',
  '반시계 90도 회전': 'Rotate 90° counterclockwise',
  '0°로 초기화': 'Reset to 0°',
  '시계 90도 회전': 'Rotate 90° clockwise',
  '아웃트로 모션을 미리 재생해요': 'Play the outro motion preview',
  '배경 음악': 'Background music',
  '내 파일': 'My file',
  '· {count}회 반복': '· repeats {count}×',
  '음악 빼기': 'Remove music',
  '영상 길이에 음악 맞추기': 'Fit music to video length',
  '영상 길이에 맞춰 {speed}x 속도로 재생돼요.': 'Plays at {speed}x to match the video length.',
  '끄면 원래 속도로 재생하고, 모자라면 처음부터 반복해요.':
    'When off, it plays at normal speed and loops from the start if too short.',
  '다른 노래 고르기': 'Choose another track',
  '영상 앞부분에서 음악을 미리 들어요': 'Preview the music from the start of the video',
  '3번 AI 하이라이트를 먼저 만들면 영상과 함께 들을 수 있어요':
    'Create AI highlights in step 3 to preview with the video',
  '보관함에서 고르기': 'Choose from library',
  '내 음악 올리기': 'Upload my music',
  '편집 단계 이동': 'Edit step navigation',
  '이전 단계': 'Previous step',
  '편집한 영상을 저장해요': 'Save the edited video',
  '3번 AI 하이라이트를 먼저 만들면 저장할 수 있어요': 'Create AI highlights in step 3 to save',
  '영상 저장하기': 'Save video',
  '다음 단계': 'Next step',
  '영상 썸네일': 'Video thumbnail',
  '하이라이트 영상을 병합하고 있어요': 'Merging highlight videos',
  '병합 진행률 (전체 {percent}%)': 'Merge progress ({percent}% overall)',
  '다른 탭이나 다른 앱을 다녀오셔도 작업이 안전하게 이어져요.':
    'Your work continues safely even if you switch tabs or apps.',
  '수정된 타임라인으로 영상을 병합하고 있어요': 'Merging with the updated timeline',
  '고화질 프레임과 자막, 오디오를 싱크에 맞춰 재합성 중입니다.':
    'Re-compositing HD frames, subtitles, and audio in sync.',
  '작업 상태바': 'Work status bar',
  '기기에 안전하게 보관 중...': 'Saving safely on this device...',
  '편집 정보만 기기에 저장됨 (초경량 모드)': 'Only edit info is stored on this device (light mode)',
  '최종 완성 영상이 기기에 보관됨': 'Final video saved on this device',
  '기기에 안전하게 보관됨': 'Saved safely on this device',
  '모든 브릿지에 같은 스타일을 적용했어요.': 'Applied the same style to all bridges.',
  '이전 장소': 'Previous place',
  '다음 장소': 'Next place',
  '병합 진행률': 'Merge progress',
  '이 영상은 미리보기를 재생할 수 없어요. 영상을 다시 올리거나 다른 형식(MP4)으로 시도해 주세요.':
    'This video cannot be previewed. Please upload it again or try another format (MP4).',
  'AI 하이라이트 만들기': 'Create AI highlights',
  '(전체 {percent}%)': '({percent}% overall)',
  'AI 썸네일 · 저장 준비': 'AI thumbnail · ready to save',
  'AI 컷이 아직 없어도 괜찮아요. 지금 스타일을 골라두면 AI 하이라이트가 끝난 뒤 날짜나 장소가 바뀌는 장면 사이에 자동으로 들어가요.':
    "No AI clips yet — that's fine. Pick a style now and it will be added automatically between scenes where the date or place changes after AI highlights finish.",
  'AI가 영상에서 가장 볼만한 장면만 골라 짧게 잘라줘요. 분석이 끝나면 바로 컷을 다듬을 수 있어요.':
    'AI picks only the most watchable moments and trims them short. Once analysis finishes, you can fine-tune the clips right away.',
  '{count}개': '{count}',
  '{count}개 클립 · {duration} 편집 구간이 안전하게 보관되어 있어요.':
    '{count} clips · {duration} of edits saved safely.',
  '{label} 설정': '{label} settings',
  '{step}단계': 'Step {step}',
  '{title} • 음악 길이({duration}) 초과 구간': '{title} • beyond music length ({duration})',
  '‹ 이전 전환': '‹ Previous transition',
  '‹ 이전 컷': '‹ Previous clip',
  '기기에 원본이 없어 다시 연결해야 해요. 영상 파일을 지참하셔야 이전 편집점과 분석 결과를 그대로 이어서 작업할 수 있어요.':
    'The originals are not on this device, so they need relinking. Bring the video files to continue from the same edits and analysis.',
  '날짜나 장소가 바뀌는 컷 사이에만 들어가요. 켜 둔 곳만 타임라인에 표시돼요.':
    'They only appear between clips where the date or place changes. Only enabled spots show on the timeline.',
  '다음 전환 ›': 'Next transition ›',
  '다음 컷 ›': 'Next clip ›',
  '먼저 2번 영상 올리기에서 영상을 하나 이상 올려주세요.':
    'Upload at least one video in step 2 first.',
  '목록 확인': 'View list',
  '버튼을 누르면 원하는 컷 사이에 브릿지를 직접 켤 수 있어요.':
    'Tap the button to turn on a bridge between any clips you want.',
  '분석 취소': 'Cancel analysis',
  '브릿지 {current} / {total}': 'Bridge {current} / {total}',
  '브릿지 건너뜀': 'Bridge skipped',
  '실제 브릿지는 날짜나 장소가 바뀌는 컷 사이에만 자동으로 들어가요.':
    'Bridges are only added automatically between clips where the date or place changes.',
  '아직 노래가 없어요. 보관함에서 고르거나 내 음악을 올려보세요.':
    'No music yet. Pick one from the library or upload your own.',
  '영상 전체에 깔리는 노래예요. 영상보다 짧으면 자동으로 반복되고, 길면 영상 끝에서 잘려요.':
    "This track plays throughout the video. If it's shorter it loops; if longer it's cut at the end.",
  '영상을 더 올리거나, 마음에 안 들면 AI에게 다시 골라달라고 할 수 있어요.':
    "Upload more videos, or ask AI to pick again if you're not happy.",
  '올린 순서대로 영상이 이어져요. 촬영 장소를 적어두면 브릿지가 더 자연스러워져요.':
    'Videos play in the order you upload them. Adding a shooting location makes bridges look more natural.',
  '올린 영상에서 AI가 하이라이트를 뽑아줘요.': 'AI pulls highlights from the videos you upload.',
  '원본 영상 {count}개의 연결이 필요해요': '{count} source videos need relinking',
  '자동 감지된 전환 지점이 없어요. 그래도 브릿지 스타일은 미리 골라둘 수 있어요. 타임라인의':
    'No transition points were detected automatically. You can still preselect a bridge style. On the timeline,',
  '컷 #{index}': 'Clip #{index}',
  '컷이 2개 이상이고, 컷마다 날짜나 장소가 달라야 브릿지가 자동으로 생겨요. 2번 컷에서 날짜·장소를 먼저 적어보세요.':
    'You need at least 2 clips with different dates or places for bridges to appear automatically. Add date and place in step 2 first.',
  '클릭하여 챕터 브릿지 다시 켜기': 'Click to re-enable the chapter bridge',
  '하이라이트 {count}개 완성': '{count} highlights ready',
  '% 단축':
    '% shorter',
  '(남은':
    '(remaining',
  ') 생성 전이어서 임시 저장소로 표시 중입니다. SQL 마이그레이션(':
    ') has not been created yet, so a temporary store is shown. Run the SQL migration (',
  ') 연결됨':
    ') connected',
  ')을 실행하시면 모든 사용자와 실시간 공유됩니다.':
    ') to share it live with every user.',
  '+0.1초':
    '+0.1s',
  '+1.0초':
    '+1.0s',
  '-0.1초':
    '-0.1s',
  '-1.0초':
    '-1.0s',
  '무결점 병합': 'Seamless merge',
  '커버 크롭 예정':
    'Will crop to cover',
  'AI REASONING LOG (실시간 추론 콘솔)':
    'AI REASONING LOG (live reasoning console)',
  'AI 극적 구간 감지 완료 (':
    'AI scene detection complete (',
  'AI 극적 구간 분석':
    'AI scene analysis',
  'AI 극적 장면 탐색 & 시네마틱 렌더링':
    'AI scene search & cinematic render',
  'AI 모델 & API Key':
    'AI Model & API Key',
  'AI 비전 모델 초기화 및 프레임 시퀀스 수신 대기 중...':
    'Initializing the AI vision model and waiting for the frame sequence...',
  'AI 원본 복원':
    'Restore AI original',
  'AI가 추천했던 원래 구간으로 복원':
    'Restore the clip AI originally suggested',
  'AI가 포착한 극적 순간 타임라인':
    'Timeline of the dramatic moments AI caught',
  'Reportist Video로 제작하여 유튜브에 공유된 하이라이트 영상들을 만나보세요.':
    'Browse highlight videos made with Reportist Video and shared on YouTube.',
  'Supabase DB 안내:':
    'Supabase DB notice:',
  '⌨️ 모델 응답 생성 중 (실시간)':
    '⌨️ Generating model response (live)',
  '⚡ 프레임 리샘플링 중...':
    '⚡ Resampling frames...',
  '✂️ 시네마틱 캔버스 무결점 병합 중...':
    '✂️ Merging seamlessly on a cinematic canvas...',
  '✂️ 수정된 구간으로 즉시 다시 병합하기':
    '✂️ Re-merge with the edited clips now',
  '가로/세로 비율에 맞춰 인물 중심으로 16:9 규격화되고 멈춤 구간 없이 매끄럽게 병합되었어요.':
    'Framed to 16:9 around people and merged smoothly with no frozen moments.',
  '강릉':
    'Gangneung',
  '개 구간 (':
    ' clips (',
  '개 구간)':
    ' clips)',
  '개 구간: 약':
    ' clips: about',
  '개 구간이 제외되었습니다.':
    ' clips were removed.',
  '개 프로젝트 ·':
    ' projects ·',
  '개)':
    ')',
  '검색어 지우기':
    'Clear search',
  '경량':
    'Light',
  '구간을 수정한 후':
    'After adjusting the range, ',
  '그다음은':
    'Then just follow',
  '기기에 저장된 미디어 용량':
    'Media stored on this device',
  '꺼짐':
    'Off',
  '다시 병합':
    'Re-merge',
  '대기':
    'Waiting',
  '대화면 전체화면':
    'Large fullscreen',
  '도쿄 시부야 & 신주쿠':
    'Tokyo Shibuya & Shinjuku',
  '마음에 들지 않는 구간은 우측 휴지통 버튼으로 직접 삭제하고 다시 병합할 수 있어요.':
    'Remove any clip you don’t want with the trash button, then merge again.',
  '모델이 첫 토큰을 생성할 때까지 대기 중...':
    'Waiting for the model to produce its first token...',
  "모든 구간이 제외되었습니다. '원래대로 복구' 버튼을 눌러 구간을 되돌려보세요.":
    'All clips were removed. Use “Restore” to bring them back.',
  '모든 프로젝트와 원본 영상, 편집 데이터가 기기에서 완전히 삭제됩니다.\n이 작업은 되돌릴 수 없습니다. 계속할까요?':
    "Every project, source video and edit on this device will be deleted.\nThis cannot be undone. Continue?",
  '모든 프로젝트와 원본 영상을 기기에서 영구 삭제해요. 되돌릴 수 없어요.':
    'Permanently deletes every project and source video from this device. This cannot be undone.',
  '미리보기':
    'Preview',
  '버튼을 통해 최종 영상에 적용돼요.':
    ' button to apply it to the final video.',
  '부산':
    'Busan',
  '브':
    'BR',
  '브라우저 임시 파일과 OPFS 캐시만 비워요. 프로젝트는 그대로 유지돼요.':
    'Clears only browser temp files and the OPFS cache. Your projects stay as they are.',
  '브라우저 캐시와 OPFS 임시 파일을 정리했습니다. 프로젝트는 그대로 유지돼요.':
    'Cleared the browser cache and OPFS temp files. Your projects are untouched.',
  '사용 중: {p1} · 남은 공간: {p2}':
    'In use: {p1} · Free: {p2}',
  '삭제 중...':
    'Deleting...',
  '새로 만들기':
    'Start over',
  '새로 병합 중...':
    'Merging again...',
  '서울':
    'Seoul',
  '선택 구간:':
    'Selected range:',
  '순서로만 따라가면 끝나요.':
    ' in that order and you’re done.',
  '스튜디오로 이동':
    'Go to studio',
  '아웃트로 모션 템플릿':
    'Outro motion templates',
  '앱 내부:':
    'In the app:',
  '없음':
    'None',
  '영상 다운로드 (':
    'Download video (',
  '영상 분석 및 하이라이트 병합 중 ({p1}/{p2})':
    'Analyzing videos and merging highlights ({p1}/{p2})',
  '완전 삭제':
    'Delete all',
  '원래대로 복구':
    'Restore',
  '원본':
    'Source',
  '원본 영상 총합':
    'Total source length',
  '유튜브 화면 비율':
    'YouTube aspect ratio',
  '을 누르면 타임라인에 즉시 반영되며, 상단의':
    ' to apply it to the timeline right away, then use the ',
  '이 하이라이트 구간 제외하기':
    'Remove this highlight clip',
  '인트로 모션 템플릿':
    'Intro motion templates',
  '인트로/아웃트로 모션 적용 완료':
    'Intro/outro motion applied',
  '자':
    ' chars',
  '작업 중단하기':
    'Stop work',
  '잠시만 기다려주세요...':
    'Just a moment...',
  '장':
    ' photos',
  '저장공간 최적화 (DB 압축)':
    'Optimize storage (compress DB)',
  '저장공간 최적화에 실패했습니다. 프로젝트를 개별 삭제해 보세요.':
    'Couldn’t optimize storage. Try deleting projects one by one.',
  '저장소 완전 비우기':
    'Erase all storage',
  '저장소를 비우는 데 실패했습니다.':
    'Failed to clear storage.',
  '저장소를 완전히 비웠습니다.':
    'Storage fully cleared.',
  '전체 {p11} 중 {p22}% 사용 중':
    '{p22}% of {p11} used',
  '주요 프레임 추출':
    'Key frame extraction',
  '준비됨':
    'Ready',
  '지루한 빌드업을 덜어내고, 인물에 맞춘 화면 비율로 가장 결정적인 순간만 엮고 있어요.':
    'Cutting the slow build-up and stitching only the most decisive moments into a ratio-matched frame.',
  '창 모드로 축소':
    'Shrink to window',
  '최적화':
    'Optimize',
  '최적화 중...':
    'Optimizing...',
  '축소':
    'Shrink',
  '캐시 정리':
    'Clear cache',
  '켜짐':
    'On',
  '클릭하여 이 장면으로 이동':
    'Click to jump to this scene',
  '타임라인 구간 선택':
    'Select a timeline range',
  '타임라인을 누르거나 빨간색 선을 드래그하여 재생 위치를 탐색하세요':
    'Tap the timeline or drag the red line to find a position',
  '프로젝트 {p1}개를 유지한 채 저장소를 최적화했습니다.':
    'Optimized storage while keeping {p1} projects.',
  '프로젝트를 유지한 채 DB를 재구성해, 삭제 후 남은 고아 파일과 잔여 용량을 회수해요.':
    'Rebuilds the DB without touching projects to reclaim orphaned files and leftover space.',
  '하이라이트 길이':
    'Highlight length',
  '하이라이트 생성 준비 중...':
    'Preparing highlights...',
  '현재 Supabase 테이블(':
    'The current Supabase table (',
  '현재 분석 중':
    'Analyzing now',
  '화면 확대':
    'Expand view',
  '🎉 16:9 유튜브 맞춤 하이라이트 영상 완성!':
    '🎉 Your 16:9 YouTube highlight video is ready!',
  '💭 모델 사고 과정 (실시간)':
    '💭 Model reasoning (live)',
  '📍 끝점으로':
    '📍 Set as end',
  '📍 시작점으로':
    '📍 Set as start',
  '📸 캔버스 기반 14개 핵심 프레임 추출 중...':
    '📸 Extracting 14 key frames from the canvas...',
  '🧠 AI 멀티모달 긴장도(Tension) 추론 중...':
    '🧠 AI multimodal tension inference in progress...',
  '인트로':
    'Intro',
  '아웃트로':
    'Outro',
  '마무리':
    'Closing',
  '노래':
    'Music',
  '컷':
    'Clips',
  '브릿지':
    'Bridge',
  '선택한':
    'Selected',
  '시청해 주셔서 감사합니다': 'Thank you for watching',
  'AI 하이라이트를 먼저 만들면 저장할 수 있어요': 'Create AI highlights first, then you can save.',
  '저장 준비 중...': 'Preparing to save...',
  '다운로드로 가기': 'Go to download',
  "AI 하이라이트를 만들면 썸네일을 함께 준비할 수 있어요": "Create AI highlights and a thumbnail gets prepared too",
  "아직 완성된 썸네일이 없어요": "No finished thumbnail yet",
  "3번 AI 하이라이트에서 영상을 분석하면 AI가 가장 잘 나온 장면으로 16:9 썸네일을 만들어줘요.": "Analyze the video in step 3 AI highlights and AI builds a 16:9 thumbnail from the best-looking frame.",
  "현재 영상 화면을 그대로 캡처하거나, AI 하이라이트를 다시 뽑아 추천 프레임을 받아보세요.": "Capture the current video frame as-is, or re-run AI highlights to get a recommended frame.",
  "3번 AI 하이라이트로 가기": "Go to step 3 AI highlights",
  "현재 화면으로 만들기": "Use current frame",
  "영상 저장 · 다운로드": "Save · Download",
  "편집을 모두 마쳤어요. 완성된 영상과 자막, 썸네일을 여기서 한 번에 내려받을 수 있어요.": "All editing is done. Download the finished video, subtitles and thumbnail here in one go.",
  "완성된 영상": "Finished video",
  " · 원본보다 {percent}% 짧아요": " · {percent}% shorter than the source",
  "썸네일 다시 저장": "Save thumbnail again",
  "저장 버튼을 누르면 해상도를 고르고 최종 영상을 만들 수 있어요. 저장이 끝나면 이 화면에서 언제든 다시 받을 수 있어요.": "Press save to choose a resolution and render the final video. Once saved, you can download it again from this screen anytime.",
  "3번 AI 하이라이트를 만들면 완성된 영상을 저장할 수 있어요.": "Create the step 3 AI highlights to save the finished video.",
  "AI 하이라이트 컷을 먼저 만든 뒤 저장할 수 있어요.": "Create the AI highlight clips first, then you can save.",
  "새 영상 포맷 고르기": "Choose a video format",
  "만들기 전에 화면 비율을 골라주세요.": "Pick the aspect ratio first.",
  "가로 16:9": "Landscape 16:9",
  "세로 9:16": "Vertical 9:16",
  "유튜브·동영상 사이트": "YouTube & video sites",
  "릴스·쇼츠·틱톡": "Reels · Shorts · TikTok",
  "인스타그램 릴스": "Instagram Reels",
  "유튜브 쇼츠": "YouTube Shorts",
  "틱톡": "TikTok",
  "이 포맷으로 시작하기": "Start with this format",
  "인물 가로 위치": "Subject horizontal position",
  "왼쪽": "Left",
  "가운데": "Center",
  "오른쪽": "Right",
};
