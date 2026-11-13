// SEO landing-page content and locale metadata.
// Edit this file, then run `npm run seo` to regenerate index.html, the localized
// landing pages, and sitemap.xml.

export const SITE = {
  origin: "https://penguincut.com",
  brand: "PenguinCut",
  appPath: "/studio",
  ogImage: "/og-penguincut.png",
  ogImageAlt:
    "PenguinCut — AI video highlight editor. Turn hours of footage into one cinematic highlight.",
  contentUpdated: "2026-11-13",
  // Search-engine verification tokens. Paste the exact values from Search Console
  // (Google) and Search Advisor (Naver), then run `npm run seo`. Empty values are
  // omitted so the generated pages never ship a stale or invalid meta tag.
  verification: {
    google: "",
    naver: "",
  },
};

export const HREFLANG_ALIASES = {
  en: ["en", "en-US"],
  ko: ["ko"],
  ja: ["ja"],
  zh: ["zh-Hans", "zh-CN"],
  es: ["es"],
  fr: ["fr"],
  de: ["de"],
};

export const LOCALES = [
  {
    code: "en",
    htmlLang: "en",
    hreflang: "en",
    ogLocale: "en_US",
    path: "/",
    label: "English",
    nativeLabel: "English",
    title: "PenguinCut — AI Video Highlight Editor",
    description:
      "Turn long videos into one cinematic highlight. PenguinCut uses AI to find the best moments, add captions and music, and export a polished 16:9 video in your browser.",
    keywords:
      "AI video highlight editor, AI highlight generator, video highlight maker, turn long videos into highlights, AI video editor, YouTube highlight, PenguinCut",
    nav: {
      features: "Features",
      how: "How it works",
      useCases: "Use cases",
      languages: "Languages",
      faq: "FAQ",
      open: "Open Studio",
    },
    hero: {
      badge: "AI video highlight editor",
      title: "Turn hours of footage into ",
      accent: "one cinematic highlight.",
      lead:
        "PenguinCut uses AI to find the climax in your videos, cut the noise, and stitch the best moments into a polished 16:9 highlight — with captions, music, and a cinematic intro and outro.",
      primary: "Open the Studio",
      secondary: "See how it works",
      trust: [
        "Your original videos stay on your device",
        "Runs in your browser",
        "No install required",
      ],
      visual: {
        windowTitle: "PenguinCut Studio",
        status: "AI analysis complete",
        badge: "6 climax moments found",
        cardTitle: "Highlight ready",
        cardMeta: "00:42 — 01:18 · 16:9",
        caption: "“This is the moment.”",
        export: "Export 16:9",
        timeline: "AI highlight timeline",
      },
    },
    strip: [
      "Built for travel films",
      "Family & celebrations",
      "Sports & action",
      "YouTube creators",
      "Weddings & events",
    ],
    features: {
      eyebrow: "The editor",
      title: "Everything you need to finish the highlight.",
      lead:
        "From finding the moment to exporting the final cut, PenguinCut handles the parts that take hours.",
      items: [
        {
          icon: "sparkles",
          title: "AI climax detection",
          desc:
            "Scans every clip and picks the moments with the strongest emotional and visual payoff.",
        },
        {
          icon: "captions",
          title: "Automatic captions",
          desc:
            "Generates subtitles and refines them with context, so every line reads cleanly.",
        },
        {
          icon: "layers",
          title: "Cinematic overlays",
          desc:
            "Add a title, channel name, date, and location with clean, broadcast-style typography.",
        },
        {
          icon: "film",
          title: "Intro, outro & chapter bridges",
          desc:
            "Open and close the film, and keep multi-day trips or events easy to follow.",
        },
        {
          icon: "music",
          title: "Music that fits",
          desc:
            "Choose royalty-free tracks, set the volume, and fit the score to the final cut.",
        },
        {
          icon: "shield",
          title: "Privacy by design",
          desc:
            "Your original videos are never uploaded. Only a small set of frames is sent for AI analysis.",
        },
      ],
    },
    how: {
      eyebrow: "How it works",
      title: "Three steps. One finished film.",
      lead:
        "No timeline wrangling, no manual scrubbing. Add your footage and let the AI find the story.",
      steps: [
        {
          title: "Add your clips",
          desc:
            "Drop in the videos from your trip, event, or shoot. PenguinCut reads them in your browser.",
        },
        {
          title: "Let the AI find the story",
          desc:
            "Choose a model and a reasoning level. PenguinCut scores the footage and proposes the strongest moments.",
        },
        {
          title: "Polish and export",
          desc:
            "Adjust the cuts, add captions and music, then render a 16:9 highlight ready for YouTube.",
        },
      ],
      note:
        "You stay in control: every suggested cut can be reviewed, trimmed, or replaced before export.",
    },
    useCases: {
      eyebrow: "Use cases",
      title: "Made for footage worth keeping.",
      lead:
        "If you have hours of video and only a minute to share, PenguinCut was built for you.",
      items: [
        {
          title: "Travel films",
          desc: "Turn a week of clips into a shareable trip highlight.",
        },
        {
          title: "Family & celebrations",
          desc:
            "Weddings, birthdays, and reunions, condensed to the moments that matter.",
        },
        {
          title: "Sports & action",
          desc:
            "Pull the decisive plays, runs, and finishes out of long game footage.",
        },
        {
          title: "Creators & channels",
          desc:
            "Produce a consistent highlight format for YouTube, Shorts, and social.",
        },
      ],
    },
    languages: {
      eyebrow: "Languages",
      title: "Speak your language.",
      lead:
        "The studio and this page are available in seven languages. Pick yours and start editing.",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Questions, answered.",
      lead: "Everything you need to know before your first highlight.",
      items: [
        {
          q: "What is PenguinCut?",
          a:
            "PenguinCut is a browser-based AI video highlight editor. It finds the strongest moments in your footage and turns them into one cinematic 16:9 video.",
        },
        {
          q: "Do my videos get uploaded?",
          a:
            "Your original video files stay on your device. PenguinCut extracts a small set of frames in your browser and sends only those frames to the AI model for analysis. The final render also happens in your browser.",
        },
        {
          q: "Is PenguinCut free?",
          a:
            "PenguinCut includes free AI models you can use right away. You can also connect your own API key to use other models.",
        },
        {
          q: "What video formats can I use?",
          a:
            "MP4, MOV, WebM, and other formats your browser can decode. MP4 (H.264) gives the most predictable results.",
        },
        {
          q: "How long does a highlight take?",
          a:
            "A short highlight usually takes a few minutes. Processing time depends on the length of your footage, your device, and the AI model you choose.",
        },
        {
          q: "Does it work on mobile?",
          a:
            "Yes. The studio runs in modern mobile browsers and handles large files with storage-aware settings. A desktop is recommended for long projects.",
        },
        {
          q: "Which languages are supported?",
          a:
            "English, Korean, Japanese, Chinese, Spanish, French, and German.",
        },
      ],
    },
    cta: {
      title: "Your next highlight is already in the footage.",
      lead: "Open PenguinCut and let the AI find it.",
      button: "Open the Studio",
      note: "No install. No upload of your original files. Just your browser.",
    },
    footer: {
      tagline:
        "AI video highlight editor. Made for the moments worth keeping.",
      product: "Product",
      language: "Languages",
      legal: "© {year} PenguinCut. All rights reserved.",
    },
  },
  {
    code: "ko",
    htmlLang: "ko",
    hreflang: "ko",
    ogLocale: "ko_KR",
    path: "/ko/",
    label: "Korean",
    nativeLabel: "한국어",
    title: "PenguinCut — AI 영상 하이라이트 에디터",
    description:
      "긴 영상을 하나의 시네마틱 하이라이트로. 펭귄컷(PenguinCut)은 AI로 가장 좋은 순간을 찾고, 자막과 음악을 더해 브라우저에서 16:9 영상으로 완성합니다.",
    keywords:
      "AI 영상 하이라이트, 하이라이트 편집, 영상 하이라이트 만들기, AI 영상 편집, 유튜브 하이라이트, 펭귄컷, 팽귄컷, PenguinCut",
    nav: {
      features: "기능",
      how: "사용 방법",
      useCases: "활용 사례",
      languages: "언어",
      faq: "FAQ",
      open: "스튜디오 열기",
    },
    hero: {
      badge: "AI 영상 하이라이트 에디터",
      title: "수시간의 영상을 ",
      accent: "하나의 시네마틱 하이라이트로.",
      lead:
        "펭귄컷(PenguinCut)은 AI로 영상 속 클라이맥스를 찾아내고, 불필요한 부분은 덜어내어 최고의 순간만 16:9 하이라이트로 이어 붙입니다. 자막, 음악, 인트로와 아웃트로까지 한 번에.",
      primary: "스튜디오 열기",
      secondary: "사용 방법 보기",
      trust: [
        "원본 영상은 기기에 그대로",
        "브라우저에서 바로 실행",
        "설치 없음",
      ],
      visual: {
        windowTitle: "PenguinCut 스튜디오",
        status: "AI 분석 완료",
        badge: "클라이맥스 6곳 발견",
        cardTitle: "하이라이트 준비 완료",
        cardMeta: "00:42 — 01:18 · 16:9",
        caption: "“바로 이 순간.”",
        export: "16:9로 내보내기",
        timeline: "AI 하이라이트 타임라인",
      },
    },
    strip: [
      "여행 영상",
      "가족과 기념일",
      "스포츠와 액션",
      "유튜브 크리에이터",
      "웨딩과 이벤트",
    ],
    features: {
      eyebrow: "에디터",
      title: "하이라이트를 완성하는 데 필요한 모든 것.",
      lead:
        "순간을 찾는 일부터 최종 컷을 내보내는 일까지, 시간이 오래 걸리는 작업은 PenguinCut이 처리합니다.",
      items: [
        {
          icon: "sparkles",
          title: "AI 클라이맥스 감지",
          desc:
            "모든 클립을 분석해 감정과 화면의 임팩트가 가장 큰 순간을 골라냅니다.",
        },
        {
          icon: "captions",
          title: "자동 자막",
          desc:
            "자막을 생성하고 문맥에 맞게 다듬어 모든 대사가 자연스럽게 읽히도록 합니다.",
        },
        {
          icon: "layers",
          title: "시네마틱 오버레이",
          desc:
            "제목, 채널명, 날짜, 장소를 깔끔한 방송 스타일 타이포그래피로 더합니다.",
        },
        {
          icon: "film",
          title: "인트로·아웃트로·챕터 브릿지",
          desc:
            "영상의 시작과 끝을 열고, 여러 날에 걸친 여행이나 행사도 쉽게 따라갈 수 있게 합니다.",
        },
        {
          icon: "music",
          title: "분위기에 맞는 음악",
          desc:
            "로열티 프리 트랙을 고르고 볼륨을 조절해 최종 컷에 어울리는 사운드를 만듭니다.",
        },
        {
          icon: "shield",
          title: "프라이버시 중심 설계",
          desc:
            "원본 영상은 업로드되지 않습니다. AI 분석에는 소량의 프레임만 전송됩니다.",
        },
      ],
    },
    how: {
      eyebrow: "사용 방법",
      title: "세 단계, 완성된 영상 하나.",
      lead:
        "타임라인을 붙잡고 씨름할 필요 없습니다. 영상을 넣고 AI가 이야기를 찾게 하세요.",
      steps: [
        {
          title: "클립 추가",
          desc:
            "여행, 행사, 촬영에서 찍은 영상을 넣으세요. PenguinCut이 브라우저에서 영상을 읽습니다.",
        },
        {
          title: "AI가 이야기를 찾게 하기",
          desc:
            "모델과 추론 수준을 고르면 PenguinCut이 영상을 평가해 가장 강한 순간을 제안합니다.",
        },
        {
          title: "다듬고 내보내기",
          desc:
            "컷을 조정하고 자막과 음악을 더한 뒤 유튜브에 바로 쓸 수 있는 16:9 하이라이트로 렌더링하세요.",
        },
      ],
      note:
        "모든 제안 컷은 내보내기 전에 검토하고 자르거나 바꿀 수 있습니다.",
    },
    useCases: {
      eyebrow: "활용 사례",
      title: "간직할 가치가 있는 영상을 위해.",
      lead:
        "수시간의 영상에서 1분만 공유하고 싶다면, PenguinCut이 답입니다.",
      items: [
        {
          title: "여행 영상",
          desc: "일주일치 클립을 공유하기 좋은 여행 하이라이트로.",
        },
        {
          title: "가족과 기념일",
          desc:
            "웨딩, 생일, 모임을 가장 중요한 순간만 남겨 응축합니다.",
        },
        {
          title: "스포츠와 액션",
          desc:
            "긴 경기 영상에서 결정적인 플레이와 피니시만 뽑아냅니다.",
        },
        {
          title: "크리에이터와 채널",
          desc:
            "유튜브, 쇼츠, 소셜에 맞는 일관된 하이라이트 포맷을 만듭니다.",
        },
      ],
    },
    languages: {
      eyebrow: "언어",
      title: "당신의 언어로 시작하세요.",
      lead:
        "스튜디오와 이 페이지는 7개 언어를 지원합니다. 언어를 고르고 편집을 시작하세요.",
    },
    faq: {
      eyebrow: "FAQ",
      title: "자주 묻는 질문",
      lead: "첫 하이라이트를 만들기 전에 알아두면 좋은 것들.",
      items: [
        {
          q: "펭귄컷(PenguinCut)은 무엇인가요?",
          a:
            "펭귄컷(PenguinCut)은 브라우저에서 동작하는 AI 영상 하이라이트 에디터입니다. 영상 속 가장 강한 순간을 찾아 하나의 시네마틱 16:9 영상으로 만들어 줍니다.",
        },
        {
          q: "영상이 업로드되나요?",
          a:
            "원본 영상 파일은 기기에 남습니다. PenguinCut은 브라우저에서 소량의 프레임을 추출해 AI 모델 분석에만 전송하며, 최종 렌더링도 브라우저에서 이루어집니다.",
        },
        {
          q: "무료인가요?",
          a:
            "PenguinCut에는 바로 사용할 수 있는 무료 AI 모델이 포함되어 있습니다. 다른 모델을 쓰고 싶다면 자신의 API 키를 연결할 수도 있습니다.",
        },
        {
          q: "어떤 영상 형식을 지원하나요?",
          a:
            "MP4, MOV, WebM 등 브라우저가 재생할 수 있는 형식을 지원합니다. 가장 안정적인 결과를 위해서는 MP4(H.264)를 권장합니다.",
        },
        {
          q: "하이라이트 만드는 데 얼마나 걸리나요?",
          a:
            "짧은 하이라이트는 보통 몇 분 안에 완성됩니다. 영상 길이, 기기 성능, 선택한 AI 모델에 따라 달라질 수 있습니다.",
        },
        {
          q: "모바일에서도 되나요?",
          a:
            "네. 최신 모바일 브라우저에서도 스튜디오가 동작하며, 큰 파일은 저장 공간을 고려해 처리합니다. 긴 프로젝트에는 데스크톱을 권장합니다.",
        },
        {
          q: "어떤 언어를 지원하나요?",
          a:
            "영어, 한국어, 일본어, 중국어, 스페인어, 프랑스어, 독일어를 지원합니다.",
        },
      ],
    },
    cta: {
      title: "다음 하이라이트는 이미 영상 속에 있습니다.",
      lead: "PenguinCut을 열고 AI가 찾게 하세요.",
      button: "스튜디오 열기",
      note:
        "설치 없음. 원본 파일 업로드 없음. 브라우저만 있으면 됩니다.",
    },
    footer: {
      tagline: "AI 영상 하이라이트 에디터. 간직할 순간을 위해.",
      product: "제품",
      language: "언어",
      legal: "© {year} PenguinCut. All rights reserved.",
    },
  },
  {
    code: "ja",
    htmlLang: "ja",
    hreflang: "ja",
    ogLocale: "ja_JP",
    path: "/ja/",
    label: "Japanese",
    nativeLabel: "日本語",
    title: "PenguinCut — AI動画ハイライトエディター",
    description:
      "長い動画をひとつのシネマティックなハイライトに。PenguinCutはAIで最高の瞬間を見つけ、字幕と音楽を加えて、ブラウザで16:9動画に仕上げます。",
    keywords:
      "AI動画ハイライト, ハイライト編集, 動画ハイライト作成, AI動画編集, YouTube ハイライト, PenguinCut",
    nav: {
      features: "機能",
      how: "使い方",
      useCases: "活用例",
      languages: "言語",
      faq: "FAQ",
      open: "スタジオを開く",
    },
    hero: {
      badge: "AI動画ハイライトエディター",
      title: "何時間もの映像を、",
      accent: "ひとつのシネマティックなハイライトへ。",
      lead:
        "PenguinCutはAIで映像のクライマックスを見つけ、不要な部分を削り、最高の瞬間だけを16:9のハイライトにまとめます。字幕、音楽、イントロ、アウトロも一度に。",
      primary: "スタジオを開く",
      secondary: "使い方を見る",
      trust: [
        "元の動画はデバイスに保存",
        "ブラウザで動作",
        "インストール不要",
      ],
      visual: {
        windowTitle: "PenguinCut スタジオ",
        status: "AI分析完了",
        badge: "クライマックスを6か所検出",
        cardTitle: "ハイライト準備完了",
        cardMeta: "00:42 — 01:18 · 16:9",
        caption: "「この瞬間だ。」",
        export: "16:9で書き出す",
        timeline: "AIハイライトタイムライン",
      },
    },
    strip: [
      "旅行動画",
      "家族と記念日",
      "スポーツとアクション",
      "YouTubeクリエイター",
      "ウェディングとイベント",
    ],
    features: {
      eyebrow: "エディター",
      title: "ハイライトを完成させるために必要なすべて。",
      lead:
        "瞬間を見つけることから最終カットの書き出しまで、時間のかかる作業はPenguinCutが担当します。",
      items: [
        {
          icon: "sparkles",
          title: "AIクライマックス検出",
          desc:
            "すべてのクリップを解析し、感情と映像のインパクトが最も強い瞬間を選び出します。",
        },
        {
          icon: "captions",
          title: "自動字幕",
          desc:
            "字幕を生成し、文脈に合わせて整えるので、すべてのセリフが自然に読めます。",
        },
        {
          icon: "layers",
          title: "シネマティックオーバーレイ",
          desc:
            "タイトル、チャンネル名、日付、場所を、放送風のすっきりしたタイポグラフィで追加します。",
        },
        {
          icon: "film",
          title: "イントロ・アウトロ・チャプターブリッジ",
          desc:
            "映像の始まりと終わりを演出し、数日にわたる旅行やイベントもわかりやすくつなぎます。",
        },
        {
          icon: "music",
          title: "映像に合う音楽",
          desc:
            "ロイヤリティフリーのトラックを選び、音量を調整して、最終カットに合うサウンドに仕上げます。",
        },
        {
          icon: "shield",
          title: "プライバシー重視の設計",
          desc:
            "元の動画はアップロードされません。AI分析には少量のフレームだけが送信されます。",
        },
      ],
    },
    how: {
      eyebrow: "使い方",
      title: "3ステップで、完成した映像を。",
      lead:
        "タイムラインと格闘する必要はありません。映像を追加して、AIにストーリーを見つけさせましょう。",
      steps: [
        {
          title: "クリップを追加",
          desc:
            "旅行、イベント、撮影の動画を追加します。PenguinCutがブラウザ上で読み込みます。",
        },
        {
          title: "AIにストーリーを見つけさせる",
          desc:
            "モデルと推論レベルを選ぶと、PenguinCutが映像を評価し、最も強い瞬間を提案します。",
        },
        {
          title: "仕上げて書き出す",
          desc:
            "カットを調整し、字幕と音楽を加えて、YouTube向けの16:9ハイライトを書き出します。",
        },
      ],
      note:
        "提案されたカットは、書き出す前にすべて確認・トリミング・差し替えできます。",
    },
    useCases: {
      eyebrow: "活用例",
      title: "残す価値のある映像のために。",
      lead:
        "何時間もの映像から1分だけ共有したいなら、PenguinCutが答えです。",
      items: [
        {
          title: "旅行動画",
          desc: "1週間分のクリップを、共有しやすい旅のハイライトに。",
        },
        {
          title: "家族と記念日",
          desc: "結婚式、誕生日、同窓会を、大切な瞬間だけに凝縮。",
        },
        {
          title: "スポーツとアクション",
          desc:
            "長い試合映像から、決定的なプレーとフィニッシュだけを抽出。",
        },
        {
          title: "クリエイターとチャンネル",
          desc:
            "YouTube、Shorts、SNS向けの一貫したハイライト形式を作成。",
        },
      ],
    },
    languages: {
      eyebrow: "言語",
      title: "あなたの言語で始めましょう。",
      lead:
        "スタジオとこのページは7言語に対応しています。言語を選んで編集を始めてください。",
    },
    faq: {
      eyebrow: "FAQ",
      title: "よくある質問",
      lead: "最初のハイライトを作る前に知っておきたいこと。",
      items: [
        {
          q: "PenguinCutとは？",
          a:
            "PenguinCutはブラウザで動くAI動画ハイライトエディターです。映像の中から最も強い瞬間を見つけ、ひとつのシネマティックな16:9動画に仕上げます。",
        },
        {
          q: "動画はアップロードされますか？",
          a:
            "元の動画ファイルはデバイスに残ります。PenguinCutはブラウザで少量のフレームを抽出し、AIモデルによる分析にのみ送信します。最終レンダリングもブラウザで行われます。",
        },
        {
          q: "無料ですか？",
          a:
            "PenguinCutにはすぐに使える無料のAIモデルが含まれています。別のモデルを使いたい場合は、自分のAPIキーを接続できます。",
        },
        {
          q: "対応している動画形式は？",
          a:
            "MP4、MOV、WebMなど、ブラウザが再生できる形式に対応しています。最も安定した結果にはMP4（H.264）をおすすめします。",
        },
        {
          q: "ハイライト作成にはどのくらいかかりますか？",
          a:
            "短いハイライトは通常数分で完成します。映像の長さ、デバイスの性能、選択したAIモデルによって変わります。",
        },
        {
          q: "モバイルでも使えますか？",
          a:
            "はい。最新のモバイルブラウザでも動作し、大きなファイルは保存容量を考慮して処理します。長いプロジェクトにはデスクトップをおすすめします。",
        },
        {
          q: "対応言語は？",
          a:
            "英語、韓国語、日本語、中国語、スペイン語、フランス語、ドイツ語に対応しています。",
        },
      ],
    },
    cta: {
      title: "次のハイライトは、すでに映像の中にあります。",
      lead: "PenguinCutを開いて、AIに見つけさせましょう。",
      button: "スタジオを開く",
      note:
        "インストール不要。元のファイルのアップロードも不要。ブラウザだけで完結します。",
    },
    footer: {
      tagline:
        "AI動画ハイライトエディター。残す価値のある瞬間のために。",
      product: "製品",
      language: "言語",
      legal: "© {year} PenguinCut. All rights reserved.",
    },
  },
  {
    code: "zh",
    htmlLang: "zh-Hans",
    hreflang: "zh-Hans",
    ogLocale: "zh_CN",
    path: "/zh/",
    label: "Chinese (Simplified)",
    nativeLabel: "简体中文",
    title: "PenguinCut — AI 视频精彩片段编辑器",
    description:
      "把数小时的素材变成一支电影感精彩片段。PenguinCut 用 AI 找到最精彩的瞬间，自动添加字幕和音乐，在浏览器中导出 16:9 视频。",
    keywords:
      "AI视频精彩片段, 视频高光剪辑, AI视频剪辑, 精彩片段生成器, YouTube 高光, PenguinCut",
    nav: {
      features: "功能",
      how: "使用方法",
      useCases: "使用场景",
      languages: "语言",
      faq: "常见问题",
      open: "打开工作室",
    },
    hero: {
      badge: "AI 视频精彩片段编辑器",
      title: "把数小时的素材，",
      accent: "变成一支电影感精彩片段。",
      lead:
        "PenguinCut 用 AI 找到视频中的高潮，去掉多余部分，只把最精彩的瞬间拼接成 16:9 的精彩片段，并自动加入字幕、音乐、片头和片尾。",
      primary: "打开工作室",
      secondary: "查看使用方法",
      trust: [
        "原始视频保留在你的设备上",
        "在浏览器中运行",
        "无需安装",
      ],
      visual: {
        windowTitle: "PenguinCut 工作室",
        status: "AI 分析完成",
        badge: "发现 6 个高潮瞬间",
        cardTitle: "精彩片段已就绪",
        cardMeta: "00:42 — 01:18 · 16:9",
        caption: "“就是这一刻。”",
        export: "导出 16:9",
        timeline: "AI 精彩片段时间线",
      },
    },
    strip: [
      "旅行影片",
      "家庭与纪念日",
      "运动与动作",
      "YouTube 创作者",
      "婚礼与活动",
    ],
    features: {
      eyebrow: "编辑器",
      title: "完成精彩片段所需的一切。",
      lead:
        "从寻找瞬间到导出最终成片，PenguinCut 帮你处理最耗时的部分。",
      items: [
        {
          icon: "sparkles",
          title: "AI 高潮检测",
          desc:
            "分析每个片段，挑选情感和画面冲击力最强的瞬间。",
        },
        {
          icon: "captions",
          title: "自动字幕",
          desc:
            "生成字幕并结合上下文润色，让每一句都清晰易读。",
        },
        {
          icon: "layers",
          title: "电影感叠加层",
          desc:
            "用干净的广播级排版添加标题、频道名、日期和地点。",
        },
        {
          icon: "film",
          title: "片头、片尾与章节过渡",
          desc:
            "为影片开场和收尾，让多天旅行或活动更容易理解。",
        },
        {
          icon: "music",
          title: "贴合氛围的音乐",
          desc:
            "选择免版税曲目，调整音量，让配乐与最终剪辑融为一体。",
        },
        {
          icon: "shield",
          title: "隐私优先设计",
          desc:
            "原始视频不会上传，只有少量画面帧会发送用于 AI 分析。",
        },
      ],
    },
    how: {
      eyebrow: "使用方法",
      title: "三个步骤，一支成片。",
      lead:
        "不用在时间线上反复拖拽。导入素材，让 AI 找到故事。",
      steps: [
        {
          title: "添加素材",
          desc:
            "导入旅行、活动或拍摄的视频，PenguinCut 会在浏览器中读取。",
        },
        {
          title: "让 AI 找到故事",
          desc:
            "选择模型和推理强度，PenguinCut 会评估素材并推荐最精彩的瞬间。",
        },
        {
          title: "精修并导出",
          desc:
            "调整剪辑，添加字幕和音乐，然后渲染适合 YouTube 的 16:9 精彩片段。",
        },
      ],
      note:
        "你始终掌握控制权：每个建议片段都可以在导出前查看、裁剪或替换。",
    },
    useCases: {
      eyebrow: "使用场景",
      title: "为值得留存的影像而做。",
      lead:
        "如果你有数小时的视频，却只想分享一分钟，PenguinCut 就是答案。",
      items: [
        {
          title: "旅行影片",
          desc: "把一周的片段变成易于分享的旅行精彩片段。",
        },
        {
          title: "家庭与纪念日",
          desc: "婚礼、生日和聚会，只留下最重要的瞬间。",
        },
        {
          title: "运动与动作",
          desc:
            "从长时间的比赛中提取关键回合和终结瞬间。",
        },
        {
          title: "创作者与频道",
          desc:
            "为 YouTube、Shorts 和社交媒体制作统一格式的精彩片段。",
        },
      ],
    },
    languages: {
      eyebrow: "语言",
      title: "用你的语言开始。",
      lead:
        "工作室和本页面支持七种语言。选择你的语言，开始剪辑。",
    },
    faq: {
      eyebrow: "常见问题",
      title: "常见问题解答",
      lead: "制作第一支精彩片段前需要了解的事。",
      items: [
        {
          q: "PenguinCut 是什么？",
          a:
            "PenguinCut 是一款在浏览器中运行的 AI 视频精彩片段编辑器。它会找到素材中最精彩的瞬间，并制作成一支电影感的 16:9 视频。",
        },
        {
          q: "视频会被上传吗？",
          a:
            "原始视频文件保留在你的设备上。PenguinCut 会在浏览器中提取少量画面帧，仅将这些帧发送给 AI 模型分析，最终渲染也在浏览器中完成。",
        },
        {
          q: "PenguinCut 免费吗？",
          a:
            "PenguinCut 内置可直接使用的免费 AI 模型。你也可以连接自己的 API 密钥来使用其他模型。",
        },
        {
          q: "支持哪些视频格式？",
          a:
            "支持 MP4、MOV、WebM 等浏览器可解码的格式。建议使用 MP4（H.264）以获得最稳定的结果。",
        },
        {
          q: "制作精彩片段需要多久？",
          a:
            "较短的精彩片段通常几分钟即可完成。具体时间取决于素材长度、设备性能和所选 AI 模型。",
        },
        {
          q: "手机上能用吗？",
          a:
            "可以。工作室可在现代手机浏览器中运行，并会针对大文件采用存储优化处理。长时间项目建议使用桌面端。",
        },
        {
          q: "支持哪些语言？",
          a:
            "英语、韩语、日语、中文、西班牙语、法语和德语。",
        },
      ],
    },
    cta: {
      title: "下一支精彩片段，已经在素材里。",
      lead: "打开 PenguinCut，让 AI 找到它。",
      button: "打开工作室",
      note:
        "无需安装，无需上传原始文件，只需浏览器。",
    },
    footer: {
      tagline:
        "AI 视频精彩片段编辑器。为值得留存的瞬间而做。",
      product: "产品",
      language: "语言",
      legal: "© {year} PenguinCut. 保留所有权利。",
    },
  },
  {
    code: "es",
    htmlLang: "es",
    hreflang: "es",
    ogLocale: "es_ES",
    path: "/es/",
    label: "Spanish",
    nativeLabel: "Español",
    title: "PenguinCut — Editor de highlights de vídeo con IA",
    description:
      "Convierte horas de material en un solo highlight cinematográfico. PenguinCut usa IA para encontrar los mejores momentos, añadir subtítulos y música, y exportar un vídeo 16:9 en tu navegador.",
    keywords:
      "editor de highlights con IA, generador de highlights, highlight de vídeo, editor de vídeo con IA, highlights para YouTube, PenguinCut",
    nav: {
      features: "Funciones",
      how: "Cómo funciona",
      useCases: "Casos de uso",
      languages: "Idiomas",
      faq: "FAQ",
      open: "Abrir estudio",
    },
    hero: {
      badge: "Editor de highlights de vídeo con IA",
      title: "Convierte horas de material en ",
      accent: "un solo highlight cinematográfico.",
      lead:
        "PenguinCut usa IA para encontrar el clímax de tus vídeos, eliminar el ruido y unir los mejores momentos en un highlight 16:9 cuidado, con subtítulos, música, intro y outro.",
      primary: "Abrir el estudio",
      secondary: "Ver cómo funciona",
      trust: [
        "Tus vídeos originales se quedan en tu dispositivo",
        "Funciona en tu navegador",
        "Sin instalación",
      ],
      visual: {
        windowTitle: "Estudio PenguinCut",
        status: "Análisis de IA completado",
        badge: "6 momentos clímax encontrados",
        cardTitle: "Highlight listo",
        cardMeta: "00:42 — 01:18 · 16:9",
        caption: "“Este es el momento.”",
        export: "Exportar 16:9",
        timeline: "Línea de tiempo del highlight con IA",
      },
    },
    strip: [
      "Vídeos de viaje",
      "Familia y celebraciones",
      "Deporte y acción",
      "Creadores de YouTube",
      "Bodas y eventos",
    ],
    features: {
      eyebrow: "El editor",
      title: "Todo lo que necesitas para terminar el highlight.",
      lead:
        "Desde encontrar el momento hasta exportar el corte final, PenguinCut se encarga de lo que lleva horas.",
      items: [
        {
          icon: "sparkles",
          title: "Detección de clímax con IA",
          desc:
            "Analiza cada clip y elige los momentos con mayor impacto emocional y visual.",
        },
        {
          icon: "captions",
          title: "Subtítulos automáticos",
          desc:
            "Genera subtítulos y los pule según el contexto para que cada línea se lea con claridad.",
        },
        {
          icon: "layers",
          title: "Capas cinematográficas",
          desc:
            "Añade título, nombre del canal, fecha y lugar con una tipografía limpia de estilo broadcast.",
        },
        {
          icon: "film",
          title: "Intro, outro y puentes de capítulo",
          desc:
            "Abre y cierra la película, y mantén fáciles de seguir los viajes o eventos de varios días.",
        },
        {
          icon: "music",
          title: "Música que encaja",
          desc:
            "Elige pistas libres de regalías, ajusta el volumen y adapta la banda sonora al corte final.",
        },
        {
          icon: "shield",
          title: "Privacidad desde el diseño",
          desc:
            "Tus vídeos originales nunca se suben. Solo se envían unos pocos fotogramas para el análisis de IA.",
        },
      ],
    },
    how: {
      eyebrow: "Cómo funciona",
      title: "Tres pasos. Una película terminada.",
      lead:
        "Sin pelear con la línea de tiempo. Añade tu material y deja que la IA encuentre la historia.",
      steps: [
        {
          title: "Añade tus clips",
          desc:
            "Incluye los vídeos de tu viaje, evento o rodaje. PenguinCut los lee en tu navegador.",
        },
        {
          title: "Deja que la IA encuentre la historia",
          desc:
            "Elige un modelo y un nivel de razonamiento. PenguinCut puntúa el material y propone los momentos más fuertes.",
        },
        {
          title: "Pule y exporta",
          desc:
            "Ajusta los cortes, añade subtítulos y música, y renderiza un highlight 16:9 listo para YouTube.",
        },
      ],
      note:
        "Tú tienes el control: cada corte sugerido se puede revisar, recortar o sustituir antes de exportar.",
    },
    useCases: {
      eyebrow: "Casos de uso",
      title: "Hecho para material que merece quedarse.",
      lead:
        "Si tienes horas de vídeo y solo un minuto para compartir, PenguinCut es para ti.",
      items: [
        {
          title: "Vídeos de viaje",
          desc:
            "Convierte una semana de clips en un highlight de viaje fácil de compartir.",
        },
        {
          title: "Familia y celebraciones",
          desc:
            "Bodas, cumpleaños y reencuentros, condensados en los momentos que importan.",
        },
        {
          title: "Deporte y acción",
          desc:
            "Extrae las jugadas decisivas, carreras y finales de partidos largos.",
        },
        {
          title: "Creadores y canales",
          desc:
            "Produce un formato de highlight coherente para YouTube, Shorts y redes sociales.",
        },
      ],
    },
    languages: {
      eyebrow: "Idiomas",
      title: "Habla tu idioma.",
      lead:
        "El estudio y esta página están disponibles en siete idiomas. Elige el tuyo y empieza a editar.",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Preguntas frecuentes",
      lead: "Todo lo que necesitas saber antes de tu primer highlight.",
      items: [
        {
          q: "¿Qué es PenguinCut?",
          a:
            "PenguinCut es un editor de highlights de vídeo con IA que funciona en el navegador. Encuentra los momentos más fuertes de tu material y los convierte en un vídeo cinematográfico 16:9.",
        },
        {
          q: "¿Se suben mis vídeos?",
          a:
            "Los archivos originales se quedan en tu dispositivo. PenguinCut extrae unos pocos fotogramas en el navegador y solo los envía al modelo de IA para el análisis. El render final también ocurre en el navegador.",
        },
        {
          q: "¿PenguinCut es gratis?",
          a:
            "PenguinCut incluye modelos de IA gratuitos listos para usar. También puedes conectar tu propia clave de API para usar otros modelos.",
        },
        {
          q: "¿Qué formatos de vídeo puedo usar?",
          a:
            "MP4, MOV, WebM y otros formatos que tu navegador pueda decodificar. Para resultados más predecibles, usa MP4 (H.264).",
        },
        {
          q: "¿Cuánto tarda un highlight?",
          a:
            "Un highlight corto suele tardar unos minutos. El tiempo depende de la duración del material, tu dispositivo y el modelo de IA elegido.",
        },
        {
          q: "¿Funciona en móvil?",
          a:
            "Sí. El estudio funciona en navegadores móviles modernos y gestiona archivos grandes con ajustes de almacenamiento. Para proyectos largos se recomienda un ordenador.",
        },
        {
          q: "¿Qué idiomas son compatibles?",
          a:
            "Inglés, coreano, japonés, chino, español, francés y alemán.",
        },
      ],
    },
    cta: {
      title: "Tu próximo highlight ya está en el material.",
      lead: "Abre PenguinCut y deja que la IA lo encuentre.",
      button: "Abrir el estudio",
      note:
        "Sin instalación. Sin subir tus archivos originales. Solo tu navegador.",
    },
    footer: {
      tagline:
        "Editor de highlights de vídeo con IA. Hecho para los momentos que merecen quedarse.",
      product: "Producto",
      language: "Idiomas",
      legal: "© {year} PenguinCut. Todos los derechos reservados.",
    },
  },
  {
    code: "fr",
    htmlLang: "fr",
    hreflang: "fr",
    ogLocale: "fr_FR",
    path: "/fr/",
    label: "French",
    nativeLabel: "Français",
    title: "PenguinCut — Éditeur de highlights vidéo par IA",
    description:
      "Transformez des heures de rushes en un seul highlight cinématographique. PenguinCut utilise l'IA pour trouver les meilleurs moments, ajouter sous-titres et musique, et exporter une vidéo 16:9 dans votre navigateur.",
    keywords:
      "éditeur de highlights IA, générateur de highlights, highlight vidéo, montage vidéo IA, highlights YouTube, PenguinCut",
    nav: {
      features: "Fonctionnalités",
      how: "Comment ça marche",
      useCases: "Cas d'usage",
      languages: "Langues",
      faq: "FAQ",
      open: "Ouvrir le studio",
    },
    hero: {
      badge: "Éditeur de highlights vidéo par IA",
      title: "Transformez des heures de rushes en ",
      accent: "un seul highlight cinématographique.",
      lead:
        "PenguinCut utilise l'IA pour trouver le climax de vos vidéos, couper le superflu et assembler les meilleurs moments en un highlight 16:9 soigné, avec sous-titres, musique, intro et outro.",
      primary: "Ouvrir le studio",
      secondary: "Voir comment ça marche",
      trust: [
        "Vos vidéos originales restent sur votre appareil",
        "Fonctionne dans votre navigateur",
        "Aucune installation",
      ],
      visual: {
        windowTitle: "Studio PenguinCut",
        status: "Analyse IA terminée",
        badge: "6 moments forts détectés",
        cardTitle: "Highlight prêt",
        cardMeta: "00:42 — 01:18 · 16:9",
        caption: "« C'est ce moment. »",
        export: "Exporter en 16:9",
        timeline: "Timeline du highlight par IA",
      },
    },
    strip: [
      "Films de voyage",
      "Famille et célébrations",
      "Sport et action",
      "Créateurs YouTube",
      "Mariages et événements",
    ],
    features: {
      eyebrow: "L'éditeur",
      title: "Tout ce qu'il faut pour terminer le highlight.",
      lead:
        "De la recherche du moment à l'export du montage final, PenguinCut s'occupe de ce qui prend des heures.",
      items: [
        {
          icon: "sparkles",
          title: "Détection des climax par IA",
          desc:
            "Analyse chaque clip et sélectionne les moments à l'impact émotionnel et visuel le plus fort.",
        },
        {
          icon: "captions",
          title: "Sous-titres automatiques",
          desc:
            "Génère des sous-titres et les affine selon le contexte pour que chaque réplique se lise clairement.",
        },
        {
          icon: "layers",
          title: "Habillage cinématographique",
          desc:
            "Ajoutez titre, nom de chaîne, date et lieu avec une typographie propre, façon broadcast.",
        },
        {
          icon: "film",
          title: "Intro, outro et transitions de chapitre",
          desc:
            "Ouvrez et fermez le film, et gardez les voyages ou événements sur plusieurs jours faciles à suivre.",
        },
        {
          icon: "music",
          title: "Une musique qui colle",
          desc:
            "Choisissez des titres libres de droits, réglez le volume et adaptez la musique au montage final.",
        },
        {
          icon: "shield",
          title: "Confidentialité dès la conception",
          desc:
            "Vos vidéos originales ne sont jamais envoyées. Seules quelques images sont transmises pour l'analyse IA.",
        },
      ],
    },
    how: {
      eyebrow: "Comment ça marche",
      title: "Trois étapes. Un film terminé.",
      lead:
        "Pas de bataille avec la timeline. Ajoutez vos rushes et laissez l'IA trouver l'histoire.",
      steps: [
        {
          title: "Ajoutez vos clips",
          desc:
            "Importez les vidéos de votre voyage, événement ou tournage. PenguinCut les lit dans votre navigateur.",
        },
        {
          title: "Laissez l'IA trouver l'histoire",
          desc:
            "Choisissez un modèle et un niveau de raisonnement. PenguinCut évalue les rushes et propose les moments les plus forts.",
        },
        {
          title: "Affinez et exportez",
          desc:
            "Ajustez les coupes, ajoutez sous-titres et musique, puis rendez un highlight 16:9 prêt pour YouTube.",
        },
      ],
      note:
        "Vous gardez le contrôle : chaque coupe proposée peut être revue, raccourcie ou remplacée avant l'export.",
    },
    useCases: {
      eyebrow: "Cas d'usage",
      title: "Pensé pour les images qui méritent d'être gardées.",
      lead:
        "Si vous avez des heures de vidéo et une minute à partager, PenguinCut est fait pour vous.",
      items: [
        {
          title: "Films de voyage",
          desc:
            "Transformez une semaine de clips en un highlight de voyage facile à partager.",
        },
        {
          title: "Famille et célébrations",
          desc:
            "Mariages, anniversaires et retrouvailles, condensés aux moments qui comptent.",
        },
        {
          title: "Sport et action",
          desc:
            "Extrayez les actions décisives, les courses et les finish de longues rencontres.",
        },
        {
          title: "Créateurs et chaînes",
          desc:
            "Produisez un format de highlight cohérent pour YouTube, Shorts et les réseaux sociaux.",
        },
      ],
    },
    languages: {
      eyebrow: "Langues",
      title: "Parlez votre langue.",
      lead:
        "Le studio et cette page sont disponibles en sept langues. Choisissez la vôtre et commencez à monter.",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Questions fréquentes",
      lead: "Tout ce qu'il faut savoir avant votre premier highlight.",
      items: [
        {
          q: "Qu'est-ce que PenguinCut ?",
          a:
            "PenguinCut est un éditeur de highlights vidéo par IA qui fonctionne dans le navigateur. Il trouve les moments les plus forts de vos rushes et les transforme en une vidéo cinématographique 16:9.",
        },
        {
          q: "Mes vidéos sont-elles envoyées ?",
          a:
            "Les fichiers originaux restent sur votre appareil. PenguinCut extrait quelques images dans le navigateur et ne les envoie qu'au modèle d'IA pour l'analyse. Le rendu final se fait aussi dans le navigateur.",
        },
        {
          q: "PenguinCut est-il gratuit ?",
          a:
            "PenguinCut inclut des modèles d'IA gratuits utilisables immédiatement. Vous pouvez aussi connecter votre propre clé API pour utiliser d'autres modèles.",
        },
        {
          q: "Quels formats vidéo sont pris en charge ?",
          a:
            "MP4, MOV, WebM et les autres formats que votre navigateur peut décoder. Pour des résultats plus prévisibles, utilisez MP4 (H.264).",
        },
        {
          q: "Combien de temps faut-il pour un highlight ?",
          a:
            "Un highlight court prend généralement quelques minutes. Le temps dépend de la durée des rushes, de votre appareil et du modèle d'IA choisi.",
        },
        {
          q: "Est-ce que ça marche sur mobile ?",
          a:
            "Oui. Le studio fonctionne dans les navigateurs mobiles modernes et gère les gros fichiers avec des réglages adaptés au stockage. Un ordinateur est recommandé pour les projets longs.",
        },
        {
          q: "Quelles langues sont prises en charge ?",
          a:
            "Anglais, coréen, japonais, chinois, espagnol, français et allemand.",
        },
      ],
    },
    cta: {
      title: "Votre prochain highlight est déjà dans les rushes.",
      lead: "Ouvrez PenguinCut et laissez l'IA le trouver.",
      button: "Ouvrir le studio",
      note:
        "Aucune installation. Aucun envoi de vos fichiers originaux. Juste votre navigateur.",
    },
    footer: {
      tagline:
        "Éditeur de highlights vidéo par IA. Pensé pour les moments qui méritent d'être gardés.",
      product: "Produit",
      language: "Langues",
      legal: "© {year} PenguinCut. Tous droits réservés.",
    },
  },
  {
    code: "de",
    htmlLang: "de",
    hreflang: "de",
    ogLocale: "de_DE",
    path: "/de/",
    label: "German",
    nativeLabel: "Deutsch",
    title: "PenguinCut — KI-Highlight-Editor für Videos",
    description:
      "Mach aus stundenlangem Filmmaterial ein einziges cineastisches Highlight. PenguinCut findet mit KI die besten Momente, fügt Untertitel und Musik hinzu und exportiert ein 16:9-Video im Browser.",
    keywords:
      "KI-Highlight-Editor, Highlight-Generator, Video-Highlights, KI-Videoschnitt, YouTube-Highlights, PenguinCut",
    nav: {
      features: "Funktionen",
      how: "So funktioniert's",
      useCases: "Anwendungsfälle",
      languages: "Sprachen",
      faq: "FAQ",
      open: "Studio öffnen",
    },
    hero: {
      badge: "KI-Highlight-Editor für Videos",
      title: "Mach aus stundenlangem Material ",
      accent: "ein einziges cineastisches Highlight.",
      lead:
        "PenguinCut findet mit KI den Höhepunkt in deinen Videos, schneidet das Unnötige weg und fügt die besten Momente zu einem sauberen 16:9-Highlight zusammen – mit Untertiteln, Musik, Intro und Outro.",
      primary: "Studio öffnen",
      secondary: "So funktioniert's",
      trust: [
        "Deine Originalvideos bleiben auf deinem Gerät",
        "Läuft im Browser",
        "Keine Installation",
      ],
      visual: {
        windowTitle: "PenguinCut Studio",
        status: "KI-Analyse abgeschlossen",
        badge: "6 Höhepunkte gefunden",
        cardTitle: "Highlight bereit",
        cardMeta: "00:42 — 01:18 · 16:9",
        caption: "„Das ist der Moment.“",
        export: "16:9 exportieren",
        timeline: "KI-Highlight-Timeline",
      },
    },
    strip: [
      "Reisefilme",
      "Familie & Feiern",
      "Sport & Action",
      "YouTube-Creator",
      "Hochzeiten & Events",
    ],
    features: {
      eyebrow: "Der Editor",
      title: "Alles, was du für das fertige Highlight brauchst.",
      lead:
        "Vom Finden des Moments bis zum Export des finalen Schnitts übernimmt PenguinCut die Arbeit, die sonst Stunden dauert.",
      items: [
        {
          icon: "sparkles",
          title: "KI-Höhepunkterkennung",
          desc:
            "Analysiert jeden Clip und wählt die Momente mit der stärksten emotionalen und visuellen Wirkung.",
        },
        {
          icon: "captions",
          title: "Automatische Untertitel",
          desc:
            "Erzeugt Untertitel und verfeinert sie mit Kontext, damit jede Zeile sauber lesbar ist.",
        },
        {
          icon: "layers",
          title: "Cineastische Overlays",
          desc:
            "Füge Titel, Kanalname, Datum und Ort in klarer Broadcast-Typografie hinzu.",
        },
        {
          icon: "film",
          title: "Intro, Outro & Kapitelbrücken",
          desc:
            "Eröffne und beende den Film und halte mehrtägige Reisen oder Events leicht nachvollziehbar.",
        },
        {
          icon: "music",
          title: "Musik, die passt",
          desc:
            "Wähle lizenzfreie Tracks, stelle die Lautstärke ein und passe den Sound an den finalen Schnitt an.",
        },
        {
          icon: "shield",
          title: "Datenschutz von Anfang an",
          desc:
            "Deine Originalvideos werden nie hochgeladen. Nur wenige Einzelbilder werden zur KI-Analyse übertragen.",
        },
      ],
    },
    how: {
      eyebrow: "So funktioniert's",
      title: "Drei Schritte. Ein fertiger Film.",
      lead:
        "Kein Kampf mit der Timeline. Füge dein Material hinzu und lass die KI die Geschichte finden.",
      steps: [
        {
          title: "Clips hinzufügen",
          desc:
            "Füge die Videos von deiner Reise, deinem Event oder Dreh hinzu. PenguinCut liest sie im Browser.",
        },
        {
          title: "Die KI die Geschichte finden lassen",
          desc:
            "Wähle ein Modell und ein Reasoning-Level. PenguinCut bewertet das Material und schlägt die stärksten Momente vor.",
        },
        {
          title: "Feinschliff und Export",
          desc:
            "Passe die Schnitte an, füge Untertitel und Musik hinzu und rendere ein 16:9-Highlight für YouTube.",
        },
      ],
      note:
        "Du behältst die Kontrolle: Jeder vorgeschlagene Schnitt kann vor dem Export geprüft, gekürzt oder ersetzt werden.",
    },
    useCases: {
      eyebrow: "Anwendungsfälle",
      title: "Gemacht für Material, das es wert ist, behalten zu werden.",
      lead:
        "Wenn du Stunden an Video und nur eine Minute zum Teilen hast, ist PenguinCut für dich gemacht.",
      items: [
        {
          title: "Reisefilme",
          desc: "Mach aus einer Woche Clips ein teilbares Reise-Highlight.",
        },
        {
          title: "Familie & Feiern",
          desc:
            "Hochzeiten, Geburtstage und Treffen, reduziert auf die Momente, die zählen.",
        },
        {
          title: "Sport & Action",
          desc:
            "Hol die entscheidenden Spielzüge, Läufe und Finishs aus langem Spielmaterial.",
        },
        {
          title: "Creator & Kanäle",
          desc:
            "Produziere ein konsistentes Highlight-Format für YouTube, Shorts und Social Media.",
        },
      ],
    },
    languages: {
      eyebrow: "Sprachen",
      title: "Sprich deine Sprache.",
      lead:
        "Das Studio und diese Seite sind in sieben Sprachen verfügbar. Wähle deine und starte den Schnitt.",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Häufige Fragen",
      lead: "Alles, was du vor deinem ersten Highlight wissen musst.",
      items: [
        {
          q: "Was ist PenguinCut?",
          a:
            "PenguinCut ist ein browserbasierter KI-Highlight-Editor für Videos. Er findet die stärksten Momente in deinem Material und macht daraus ein cineastisches 16:9-Video.",
        },
        {
          q: "Werden meine Videos hochgeladen?",
          a:
            "Die Originaldateien bleiben auf deinem Gerät. PenguinCut extrahiert im Browser einige wenige Einzelbilder und sendet nur diese zur Analyse an das KI-Modell. Auch das finale Rendering findet im Browser statt.",
        },
        {
          q: "Ist PenguinCut kostenlos?",
          a:
            "PenguinCut enthält kostenlose KI-Modelle, die du sofort nutzen kannst. Du kannst auch deinen eigenen API-Schlüssel verbinden, um andere Modelle zu verwenden.",
        },
        {
          q: "Welche Videoformate kann ich nutzen?",
          a:
            "MP4, MOV, WebM und andere Formate, die dein Browser dekodieren kann. Für die zuverlässigsten Ergebnisse empfiehlt sich MP4 (H.264).",
        },
        {
          q: "Wie lange dauert ein Highlight?",
          a:
            "Ein kurzes Highlight dauert meist einige Minuten. Die Zeit hängt von der Länge des Materials, deinem Gerät und dem gewählten KI-Modell ab.",
        },
        {
          q: "Funktioniert es auf dem Smartphone?",
          a:
            "Ja. Das Studio läuft in modernen mobilen Browsern und behandelt große Dateien mit speicherbewussten Einstellungen. Für lange Projekte empfiehlt sich ein Desktop.",
        },
        {
          q: "Welche Sprachen werden unterstützt?",
          a:
            "Englisch, Koreanisch, Japanisch, Chinesisch, Spanisch, Französisch und Deutsch.",
        },
      ],
    },
    cta: {
      title: "Dein nächstes Highlight steckt schon im Material.",
      lead: "Öffne PenguinCut und lass die KI es finden.",
      button: "Studio öffnen",
      note:
        "Keine Installation. Kein Upload deiner Originaldateien. Nur dein Browser.",
    },
    footer: {
      tagline:
        "KI-Highlight-Editor für Videos. Gemacht für Momente, die es wert sind, behalten zu werden.",
      product: "Produkt",
      language: "Sprachen",
      legal: "© {year} PenguinCut. Alle Rechte vorbehalten.",
    },
  },
];

export function getLocale(code) {
  return LOCALES.find((locale) => locale.code === code);
}
