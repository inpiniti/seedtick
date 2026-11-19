// Long-form pages: trust/legal documents, the launch article, and the
// use-case guides. English and Korean are localized; every other locale links
// to the English canonical so no page ships machine-translated legal copy.
//
// Section shape:
//   { heading, paragraphs?: string[], bullets?: string[], note?: string }

export const CONTENT_LOCALES = ["en", "ko"];

const PRIVACY_EN = {
  title: "Privacy Policy — PenguinCut",
  description:
    "How PenguinCut handles your videos: original files stay on your device, only sampled frames are sent for AI analysis, and renders happen in your browser.",
  eyebrow: "Legal",
  heading: "Privacy Policy",
  lead:
    "PenguinCut is built around a local-first architecture. This page explains exactly what stays on your device, what leaves it, and why.",
  updated: "2026-11-19",
  sections: [
    {
      heading: "The short version",
      paragraphs: [
        "Your original video files are never uploaded to PenguinCut. They stay in your browser and on your device.",
        "To find the highlight, PenguinCut samples a small set of frames and sends only those frames, plus a text prompt, to the AI model you choose. The final video is rendered locally in your browser.",
        "The marketing site does not use advertising trackers or third-party analytics scripts.",
      ],
    },
    {
      heading: "What stays on your device",
      paragraphs: [
        "Video files, extracted audio, thumbnails, project settings, captions, and the exported result stay on your device unless you choose to share them.",
        "Project data and your language preference are stored in your browser's local storage so a reload does not lose your work. Clearing site data removes it.",
      ],
    },
    {
      heading: "What is sent for AI analysis",
      paragraphs: [
        "PenguinCut decodes the video in your browser, selects representative frames, and sends those frames to the AI provider that powers your selected model. The request also includes the instructions needed to score moments and propose cuts.",
        "Frame sampling is deliberately small: the goal is to describe the footage, not to reconstruct it. Original clips and full-resolution video are not part of the request.",
        "If you connect your own API key, requests go directly from your browser to that provider under their terms and privacy policy. The key is stored locally in your browser and is not sent to PenguinCut.",
      ],
    },
    {
      heading: "What the website collects",
      paragraphs: [
        "The landing site and studio are static files. PenguinCut does not require an account and does not run its own analytics or advertising scripts.",
        "The hosting provider processes standard technical logs such as IP address, user agent, and request time to deliver and secure the site. The font stylesheet is loaded from jsDelivr, which also receives the request metadata needed to serve the file.",
      ],
      bullets: [
        "No advertising cookies.",
        "No cross-site tracking pixels.",
        "No sale of personal information.",
      ],
    },
    {
      heading: "Third-party services",
      paragraphs: [
        "Depending on the model you pick, frame analysis may be handled by a third-party AI provider. Those providers process the sampled frames under their own policies.",
        "The studio may load royalty-free music and font assets from their respective providers. Links to YouTube, GitHub, and X take you to services with their own privacy policies.",
      ],
    },
    {
      heading: "Your choices",
      paragraphs: [
        "You can clear project data and stored keys at any time through your browser's site-data settings. You can revoke an API key with the provider that issued it.",
        "If you do not want frames to leave your device, do not run AI analysis. You can still review footage and edit locally, but the automatic highlight suggestions require the model.",
      ],
    },
    {
      heading: "Children",
      paragraphs: [
        "PenguinCut is not directed at children under 13 and does not knowingly collect personal information from them.",
      ],
    },
    {
      heading: "Changes and contact",
      paragraphs: [
        "If this policy changes, the updated date at the top of this page changes with it. Material changes will be noted on the site.",
        "Questions or requests can be sent through the public GitHub repository or the official X account linked in the footer.",
      ],
    },
  ],
  related: ["terms", "about"],
};

const PRIVACY_KO = {
  title: "개인정보 처리방침 — 펭귄컷(PenguinCut)",
  description:
    "펭귄컷의 영상 처리 방식: 원본 파일은 기기에 남고, AI 분석에는 소량의 프레임만 전송되며, 최종 렌더링은 브라우저에서 이루어집니다.",
  eyebrow: "법적 고지",
  heading: "개인정보 처리방침",
  lead:
    "펭귄컷(PenguinCut)은 로컬 우선(local-first) 구조로 설계되었습니다. 무엇이 기기에 남고, 무엇이 기기 밖으로 나가는지 이 페이지에서 투명하게 설명합니다.",
  updated: "2026-11-19",
  sections: [
    {
      heading: "한눈에 보기",
      paragraphs: [
        "원본 영상 파일은 펭귄컷에 업로드되지 않습니다. 파일은 브라우저와 기기 안에 그대로 남습니다.",
        "하이라이트를 찾기 위해 펭귄컷은 소량의 프레임을 추출해, 선택한 AI 모델에 해당 프레임과 텍스트 지시문만 전송합니다. 최종 영상은 브라우저에서 로컬로 렌더링됩니다.",
        "마케팅 사이트에는 광고 추적기나 제3자 분석 스크립트를 넣지 않았습니다.",
      ],
    },
    {
      heading: "기기에 남는 것",
      paragraphs: [
        "영상 파일, 추출된 오디오, 썸네일, 프로젝트 설정, 자막, 내보낸 결과물은 사용자가 직접 공유하지 않는 한 기기에 남습니다.",
        "새로고침으로 작업이 사라지지 않도록 프로젝트 데이터와 언어 설정은 브라우저 로컬 스토리지에 저장됩니다. 사이트 데이터를 지우면 함께 삭제됩니다.",
      ],
    },
    {
      heading: "AI 분석을 위해 전송되는 것",
      paragraphs: [
        "펭귄컷은 브라우저에서 영상을 디코딩하고 대표 프레임을 골라, 선택한 모델을 제공하는 AI 사업자에게 전송합니다. 요청에는 순간을 평가하고 컷을 제안하는 데 필요한 지시문도 포함됩니다.",
        "프레임 샘플링은 의도적으로 소량입니다. 목적은 영상을 설명하는 것이지 원본을 재구성하는 것이 아닙니다. 원본 클립과 고해상도 영상 전체는 요청에 포함되지 않습니다.",
        "직접 API 키를 연결하면 요청은 해당 사업자의 약관과 개인정보 정책에 따라 브라우저에서 사업자로 직접 전송됩니다. 키는 브라우저에만 저장되며 펭귄컷으로 전송되지 않습니다.",
      ],
    },
    {
      heading: "웹사이트가 수집하는 정보",
      paragraphs: [
        "랜딩 페이지와 스튜디오는 정적 파일로 제공됩니다. 펭귄컷은 계정을 요구하지 않으며 자체 분석이나 광고 스크립트를 운영하지 않습니다.",
        "호스팅 사업자는 사이트 제공과 보안을 위해 IP 주소, 사용자 에이전트, 요청 시각 같은 표준 기술 로그를 처리합니다. 폰트 스타일시트는 jsDelivr에서 불러오며, 해당 요청에도 파일 제공에 필요한 메타데이터가 포함됩니다.",
      ],
      bullets: [
        "광고 쿠키 없음.",
        "교차 사이트 추적 픽셀 없음.",
        "개인정보 판매 없음.",
      ],
    },
    {
      heading: "제3자 서비스",
      paragraphs: [
        "선택한 모델에 따라 프레임 분석은 제3자 AI 사업자가 처리할 수 있습니다. 해당 사업자는 자체 정책에 따라 전송된 프레임을 처리합니다.",
        "스튜디오는 로열티 프리 음악과 폰트 자산을 각 제공처에서 불러올 수 있습니다. YouTube, GitHub, X 링크는 각 서비스의 개인정보 정책이 적용됩니다.",
      ],
    },
    {
      heading: "사용자의 선택",
      paragraphs: [
        "브라우저의 사이트 데이터 설정에서 프로젝트 데이터와 저장된 키를 언제든지 지울 수 있습니다. API 키는 발급한 사업자에서 폐기할 수 있습니다.",
        "프레임이 기기 밖으로 나가는 것을 원하지 않으면 AI 분석을 실행하지 않으면 됩니다. 영상을 검토하고 로컬에서 편집할 수는 있지만, 자동 하이라이트 제안에는 모델이 필요합니다.",
      ],
    },
    {
      heading: "아동",
      paragraphs: [
        "펭귄컷은 만 13세 미만 아동을 대상으로 하지 않으며, 아동의 개인정보를 알면서 수집하지 않습니다.",
      ],
    },
    {
      heading: "변경 및 문의",
      paragraphs: [
        "정책이 바뀌면 이 페이지 상단의 업데이트 날짜도 함께 바뀝니다. 중요한 변경은 사이트에 안내합니다.",
        "문의나 요청은 푸터에 연결된 공개 GitHub 저장소 또는 공식 X 계정으로 보낼 수 있습니다.",
      ],
    },
  ],
  related: ["terms", "about"],
};

const TERMS_EN = {
  title: "Terms of Service — PenguinCut",
  description:
    "The terms that apply when you use PenguinCut: free models, bring-your-own API keys, your ownership of your footage, and acceptable use.",
  eyebrow: "Legal",
  heading: "Terms of Service",
  lead:
    "These terms cover the PenguinCut website and studio. By using the service, you agree to them.",
  updated: "2026-11-19",
  sections: [
    {
      heading: "The service",
      paragraphs: [
        "PenguinCut is a browser-based video highlight editor. It samples frames from your footage, asks an AI model to identify the strongest moments, and renders a highlight on your device.",
        "The service is provided as-is. Features, supported formats, and available models can change as the product develops.",
      ],
    },
    {
      heading: "Free models and your own API key",
      paragraphs: [
        "PenguinCut includes free AI models that you can use without an account. Fair-use limits may apply to keep the free tier available to everyone.",
        "You may connect your own API key from a supported provider. You are responsible for that account, its usage charges, and compliance with the provider's terms. Keys are stored in your browser, not on a PenguinCut server.",
      ],
    },
    {
      heading: "Your content",
      paragraphs: [
        "You keep all rights to the videos, audio, images, and text you bring to PenguinCut. We do not claim ownership of your footage or the highlights you export.",
        "You are responsible for having the rights and permissions needed to use your footage, music, and any people or locations that appear in it.",
        "You grant PenguinCut only the limited permission needed to process your content on your device and to send sampled frames to the AI provider you select.",
      ],
    },
    {
      heading: "Acceptable use",
      paragraphs: [
        "Do not use PenguinCut to create or distribute content that is illegal, infringing, harassing, hateful, or sexually exploitative of minors.",
        "Do not attempt to disrupt the service, bypass usage limits, reverse engineer hosted components, or use the service to build a competing dataset from other people's content.",
      ],
    },
    {
      heading: "Third-party services",
      paragraphs: [
        "AI models, fonts, music, and hosting are provided by third parties. Their terms and availability apply in addition to these terms. PenguinCut is not responsible for third-party outages, model behavior, or pricing changes.",
      ],
    },
    {
      heading: "Availability, warranty, and liability",
      paragraphs: [
        "PenguinCut is provided without warranties of any kind, express or implied, including fitness for a particular purpose and non-infringement.",
        "To the maximum extent permitted by law, PenguinCut is not liable for indirect, incidental, special, or consequential damages, or for lost footage, lost profits, or lost opportunities. Keep your own backups of original footage.",
      ],
    },
    {
      heading: "Ending use",
      paragraphs: [
        "You can stop using PenguinCut at any time by closing the site and clearing its stored data. We may suspend access to protect the service or other users.",
      ],
    },
    {
      heading: "Changes, law, and contact",
      paragraphs: [
        "We may update these terms as the product changes. The updated date at the top of this page reflects the latest revision. Continued use after a change means you accept the revised terms.",
        "These terms are governed by the laws of the Republic of Korea, without limiting any mandatory consumer protections that apply where you live.",
        "Questions can be sent through the public GitHub repository or the official X account linked in the footer.",
      ],
    },
  ],
  related: ["privacy", "about"],
};

const TERMS_KO = {
  title: "이용약관 — 펭귄컷(PenguinCut)",
  description:
    "펭귄컷 이용약관: 무료 모델, 직접 연결하는 API 키, 사용자의 영상 소유권, 금지되는 사용 행위를 안내합니다.",
  eyebrow: "법적 고지",
  heading: "이용약관",
  lead:
    "이 약관은 펭귄컷(PenguinCut) 웹사이트와 스튜디오 이용에 적용됩니다. 서비스를 사용하면 이 약관에 동의한 것으로 봅니다.",
  updated: "2026-11-19",
  sections: [
    {
      heading: "서비스",
      paragraphs: [
        "펭귄컷은 브라우저 기반 영상 하이라이트 에디터입니다. 영상에서 프레임을 샘플링하고, AI 모델에 가장 강한 순간을 식별하도록 요청한 뒤, 사용자의 기기에서 하이라이트를 렌더링합니다.",
        "서비스는 있는 그대로 제공됩니다. 제품이 발전하면서 기능, 지원 형식, 사용 가능한 모델은 바뀔 수 있습니다.",
      ],
    },
    {
      heading: "무료 모델과 직접 연결하는 API 키",
      paragraphs: [
        "펭귄컷에는 계정 없이 사용할 수 있는 무료 AI 모델이 포함되어 있습니다. 모든 사용자에게 무료 티어를 유지하기 위해 공정 사용 한도가 적용될 수 있습니다.",
        "지원되는 사업자의 API 키를 직접 연결할 수 있습니다. 해당 계정, 사용 요금, 사업자 약관 준수는 사용자의 책임입니다. 키는 펭귄컷 서버가 아니라 브라우저에 저장됩니다.",
      ],
    },
    {
      heading: "사용자의 콘텐츠",
      paragraphs: [
        "펭귄컷에 가져온 영상, 오디오, 이미지, 텍스트에 대한 모든 권리는 사용자에게 있습니다. 회사는 사용자의 영상이나 내보낸 하이라이트에 대한 소유권을 주장하지 않습니다.",
        "영상, 음악, 등장하는 인물과 장소를 사용하는 데 필요한 권리와 허가를 확보할 책임은 사용자에게 있습니다.",
        "사용자는 기기에서 콘텐츠를 처리하고 선택한 AI 사업자에게 샘플 프레임을 전송하는 데 필요한 최소한의 허락만 펭귄컷에 부여합니다.",
      ],
    },
    {
      heading: "금지되는 사용",
      paragraphs: [
        "불법, 권리 침해, 괴롭힘, 혐오, 미성년자 성적 착취에 해당하는 콘텐츠를 만들거나 유포하는 데 펭귄컷을 사용해서는 안 됩니다.",
        "서비스를 방해하거나 사용 한도를 우회하거나 호스팅 구성 요소를 역설계하거나, 다른 사람의 콘텐츠로 경쟁 데이터셋을 구축하는 데 서비스를 사용해서는 안 됩니다.",
      ],
    },
    {
      heading: "제3자 서비스",
      paragraphs: [
        "AI 모델, 폰트, 음악, 호스팅은 제3자가 제공합니다. 해당 약관과 가용성이 이 약관에 추가로 적용됩니다. 펭귄컷은 제3자의 장애, 모델 동작, 가격 변경에 대해 책임지지 않습니다.",
      ],
    },
    {
      heading: "가용성, 보증, 책임",
      paragraphs: [
        "펭귄컷은 특정 목적 적합성과 비침해성을 포함해 명시적이든 묵시적이든 어떠한 보증도 없이 제공됩니다.",
        "법이 허용하는 최대 범위에서 펭귄컷은 간접적, 부수적, 특별, 결과적 손해나 영상 분실, 이익 상실, 기회 상실에 대해 책임지지 않습니다. 원본 영상은 사용자가 직접 백업해 주세요.",
      ],
    },
    {
      heading: "이용 종료",
      paragraphs: [
        "사이트를 닫고 저장된 데이터를 지우면 언제든지 이용을 중단할 수 있습니다. 서비스와 다른 사용자를 보호하기 위해 접근을 일시 중단할 수 있습니다.",
      ],
    },
    {
      heading: "변경, 준거법, 문의",
      paragraphs: [
        "제품 변경에 따라 약관을 업데이트할 수 있습니다. 이 페이지 상단의 업데이트 날짜가 최신 개정을 나타냅니다. 변경 후 계속 사용하면 개정 약관에 동의한 것으로 봅니다.",
        "이 약관은 대한민국 법률의 적용을 받으며, 거주 지역의 강행 소비자 보호 규정을 제한하지 않습니다.",
        "문의는 푸터에 연결된 공개 GitHub 저장소 또는 공식 X 계정으로 보낼 수 있습니다.",
      ],
    },
  ],
  related: ["privacy", "about"],
};

const ABOUT_EN = {
  title: "About PenguinCut — the AI video highlight editor",
  description:
    "Why PenguinCut exists: a browser-based, local-first AI editor that turns hours of footage into one cinematic highlight without uploading originals.",
  eyebrow: "Company",
  heading: "About PenguinCut",
  lead:
    "PenguinCut (펭귄컷) is an independent, browser-based AI video highlight editor for people with hours of footage and a minute to share.",
  updated: "2026-11-19",
  sections: [
    {
      heading: "Why we built it",
      paragraphs: [
        "Most trips, games, weddings, and family events produce more footage than anyone can edit. The moment worth sharing is usually in there, but finding it means scrubbing through hours of video.",
        "PenguinCut started from a simple question: what if the editor watched the footage for you and handed you the six cuts that matter?",
        "The answer is a focused tool rather than a full timeline suite. Add your clips, let the AI find the story, then polish and export.",
      ],
    },
    {
      heading: "What PenguinCut does",
      paragraphs: [
        "The studio samples frames in your browser, asks an AI model to score the strongest emotional and visual moments, and proposes a short highlight. It then adds captions, cinematic overlays, chapter bridges, and music before rendering.",
        "Every suggestion is editable. You can review, trim, replace, or reorder cuts before exporting a 16:9 film for YouTube or a 9:16 cut for Shorts.",
      ],
    },
    {
      heading: "Local-first by design",
      paragraphs: [
        "Your original files stay on your device. Only sampled frames and instructions are sent to the AI provider you choose, and the final render happens in your browser.",
        "That architecture is better for privacy, cheaper to run, and fast enough to feel instant on a normal laptop. It also means the product can offer free models without turning your footage into the product.",
      ],
    },
    {
      heading: "How the project is run",
      paragraphs: [
        "PenguinCut is built as an independent project. The web app is developed in the open on GitHub, and the public site documents the privacy model and terms in plain language.",
        "The product is available in English, Korean, Japanese, Chinese, Spanish, French, and German.",
      ],
    },
    {
      heading: "Official channels",
      paragraphs: [
        "Product news and demo films are published on the PenguinCut YouTube channel. Code, issues, and release notes live on GitHub. Short updates are posted on X.",
        "For business, press, or partnership questions, reach out through the GitHub repository or the X account. We read every message.",
      ],
      bullets: [
        "YouTube: @penguincut_ai",
        "GitHub: github.com/inpiniti/penguincut",
        "X: @penguincut_ai",
      ],
    },
  ],
  related: ["blog/introducing-penguincut", "privacy", "terms"],
};

const ABOUT_KO = {
  title: "소개 — 펭귄컷(PenguinCut) AI 영상 하이라이트 에디터",
  description:
    "펭귄컷은 왜 만들어졌을까요? 원본 업로드 없이 브라우저에서 수시간의 영상을 하나의 시네마틱 하이라이트로 만드는 로컬 우선 AI 에디터입니다.",
  eyebrow: "회사 소개",
  heading: "펭귄컷 소개",
  lead:
    "펭귄컷(PenguinCut)은 수시간의 영상과 1분의 공유 시간을 가진 사람을 위한 독립 브라우저 기반 AI 영상 하이라이트 에디터입니다.",
  updated: "2026-11-19",
  sections: [
    {
      heading: "왜 만들었나",
      paragraphs: [
        "여행, 경기, 결혼식, 가족 행사는 대부분 편집할 수 있는 양보다 많은 영상을 남깁니다. 공유할 가치가 있는 순간은 분명 그 안에 있지만, 찾으려면 수시간의 영상을 처음부터 끝까지 훑어야 합니다.",
        "펭귄컷은 간단한 질문에서 시작했습니다. 에디터가 대신 영상을 보고, 정말 중요한 여섯 컷을 건네주면 어떨까?",
        "그래서 만든 것은 거대한 타임라인 제품이 아니라 집중된 도구입니다. 클립을 넣고, AI가 이야기를 찾게 하고, 다듬어 내보내면 됩니다.",
      ],
    },
    {
      heading: "펭귄컷이 하는 일",
      paragraphs: [
        "스튜디오는 브라우저에서 프레임을 샘플링하고, AI 모델에 감정과 화면 임팩트가 가장 강한 순간을 평가하도록 요청해 짧은 하이라이트를 제안합니다. 이어서 자막, 시네마틱 오버레이, 챕터 브릿지, 음악을 더한 뒤 렌더링합니다.",
        "모든 제안은 수정할 수 있습니다. 내보내기 전에 컷을 검토하고 자르거나 바꾸거나 순서를 조정해, YouTube용 16:9 영상 또는 Shorts용 9:16 컷으로 만들 수 있습니다.",
      ],
    },
    {
      heading: "로컬 우선 설계",
      paragraphs: [
        "원본 파일은 기기에 남습니다. 선택한 AI 사업자에게는 샘플 프레임과 지시문만 전송되며, 최종 렌더링은 브라우저에서 이루어집니다.",
        "이 구조는 개인정보 보호에 유리하고 운영 비용이 낮으며, 일반 노트북에서도 즉각적으로 느껴질 만큼 빠릅니다. 사용자의 영상을 상품으로 삼지 않고도 무료 모델을 제공할 수 있는 이유이기도 합니다.",
      ],
    },
    {
      heading: "프로젝트 운영 방식",
      paragraphs: [
        "펭귄컷은 독립 프로젝트로 만들어집니다. 웹 앱은 GitHub에서 공개적으로 개발되며, 공식 사이트는 개인정보 처리 방식과 약관을 쉬운 언어로 문서화합니다.",
        "제품은 영어, 한국어, 일본어, 중국어, 스페인어, 프랑스어, 독일어를 지원합니다.",
      ],
    },
    {
      heading: "공식 채널",
      paragraphs: [
        "제품 소식과 데모 영상은 펭귄컷 YouTube 채널에 올라갑니다. 코드, 이슈, 릴리스 노트는 GitHub에서 확인할 수 있고, 짧은 소식은 X에 게시합니다.",
        "비즈니스, 언론, 제휴 문의는 GitHub 저장소나 X 계정으로 보내 주세요. 모든 메시지를 읽습니다.",
      ],
      bullets: [
        "YouTube: @penguincut_ai",
        "GitHub: github.com/inpiniti/penguincut",
        "X: @penguincut_ai",
      ],
    },
  ],
  related: ["blog/introducing-penguincut", "privacy", "terms"],
};

const BLOG_EN = {
  title: "Introducing PenguinCut — AI highlights without uploading your footage",
  description:
    "How PenguinCut turns hours of video into one cinematic highlight: local frame sampling, AI climax detection, browser rendering, and a 16:9 & 9:16 export.",
  eyebrow: "Blog",
  heading: "Introducing PenguinCut",
  lead:
    "PenguinCut turns hours of footage into one cinematic highlight — and it does it without uploading your original videos.",
  updated: "2026-11-19",
  sections: [
    {
      heading: "The problem with footage",
      paragraphs: [
        "A weekend trip can produce 40 GB of video. A single game can run two hours. A wedding can span three cameras and an entire day.",
        "Traditional editors assume you already know which moment matters. They give you a timeline and a pair of scissors. But the hard part is not cutting — it is finding. That is the part PenguinCut automates.",
      ],
    },
    {
      heading: "What PenguinCut does",
      paragraphs: [
        "Add your clips, choose an AI model and a reasoning level, and PenguinCut scores the footage, proposes the strongest moments, and assembles a short highlight.",
        "The result is a finished film with captions, a title overlay, chapter bridges between days or scenes, music, and a cinematic intro and outro. Export it as 16:9 for YouTube or 9:16 for Shorts.",
      ],
    },
    {
      heading: "How the local-first pipeline works",
      paragraphs: [
        "PenguinCut decodes video in the browser using the same media APIs that power web players. It samples representative frames instead of uploading the file.",
        "Those frames and a structured prompt go to the AI model you select. The model returns a story plan: which moments to keep, how long each cut should run, and what the captions should say.",
        "The studio then renders the final video locally. Your original footage, the sampled frames after analysis, and the exported file never need to touch a PenguinCut server.",
      ],
      bullets: [
        "Original video: stays on your device.",
        "AI analysis: sampled frames plus instructions only.",
        "Rendering: in your browser.",
        "Export: 16:9 for YouTube or 9:16 for Shorts, chosen when you start the project.",
      ],
    },
    {
      heading: "Why local-first matters",
      paragraphs: [
        "Privacy is the obvious benefit. A family video or an unreleased game does not need to sit on someone else's storage just to get a highlight.",
        "The second benefit is speed and cost. Moving less data means faster iteration, and rendering on the user's device keeps the free tier sustainable.",
        "The third is control. Every AI suggestion is a draft, not a final cut. You can review, trim, replace, and reorder before export.",
      ],
    },
    {
      heading: "What's next",
      paragraphs: [
        "The roadmap focuses on better story structure, stronger caption accuracy, and more format presets for creators who publish every week.",
        "The product is available in seven languages, and the privacy model and terms are documented in plain language so you can decide whether it fits your workflow.",
      ],
    },
    {
      heading: "Try it",
      paragraphs: [
        "Open the studio, add a clip you already have, and watch the first highlight come together. No install, no account, and no upload of your original files.",
      ],
    },
  ],
  related: ["use-cases/youtube-highlights", "use-cases/travel-vlog-highlights", "about"],
};

const BLOG_KO = {
  title: "펭귄컷 출시 — 원본 업로드 없이 만드는 AI 하이라이트",
  description:
    "펭귄컷이 수시간의 영상을 하나의 시네마틱 하이라이트로 만드는 방법: 로컬 프레임 샘플링, AI 클라이맥스 감지, 브라우저 렌더링, 16:9 & 9:16 내보내기.",
  eyebrow: "블로그",
  heading: "펭귄컷을 소개합니다",
  lead:
    "펭귄컷(PenguinCut)은 수시간의 영상을 하나의 시네마틱 하이라이트로 만듭니다. 원본 영상을 업로드하지 않고서도요.",
  updated: "2026-11-19",
  sections: [
    {
      heading: "영상 편집의 진짜 문제",
      paragraphs: [
        "주말 여행 한 번에 40GB의 영상이 남을 수 있습니다. 경기 하나는 두 시간을 넘고, 결혼식은 카메라 세 대와 하루 종일의 기록을 남깁니다.",
        "기존 편집기는 어떤 순간이 중요한지 이미 알고 있다고 가정합니다. 타임라인과 가위를 건네줄 뿐이죠. 하지만 어려운 일은 자르는 것이 아니라 찾는 것입니다. 펭귄컷은 바로 그 일을 자동화합니다.",
      ],
    },
    {
      heading: "펭귄컷이 하는 일",
      paragraphs: [
        "클립을 넣고 AI 모델과 추론 수준을 고르면, 펭귄컷이 영상을 평가해 가장 강한 순간을 제안하고 짧은 하이라이트로 엮습니다.",
        "결과물은 자막, 제목 오버레이, 날짜나 장면 사이의 챕터 브릿지, 음악, 시네마틱 인트로와 아웃트로를 갖춘 완성된 영상입니다. YouTube용 16:9 또는 Shorts용 9:16으로 내보낼 수 있습니다.",
      ],
    },
    {
      heading: "로컬 우선 파이프라인",
      paragraphs: [
        "펭귄컷은 웹 플레이어가 사용하는 것과 같은 미디어 API로 브라우저에서 영상을 디코딩합니다. 파일을 업로드하는 대신 대표 프레임을 샘플링합니다.",
        "그 프레임과 구조화된 지시문이 선택한 AI 모델로 전달됩니다. 모델은 어떤 순간을 남길지, 각 컷을 얼마나 길게 할지, 자막을 어떻게 쓸지에 대한 스토리 계획을 돌려줍니다.",
        "스튜디오는 최종 영상을 로컬에서 렌더링합니다. 원본 영상과 분석 후의 샘플 프레임, 내보낸 파일은 펭귄컷 서버를 거치지 않아도 됩니다.",
      ],
      bullets: [
        "원본 영상: 기기에 그대로.",
        "AI 분석: 샘플 프레임과 지시문만.",
        "렌더링: 브라우저에서.",
        "내보내기: 새 프로젝트를 시작할 때 고른 16:9 또는 9:16.",
      ],
    },
    {
      heading: "로컬 우선이 중요한 이유",
      paragraphs: [
        "가장 분명한 장점은 개인정보 보호입니다. 가족 영상이나 아직 공개되지 않은 경기 영상을 하이라이트로 만들기 위해 다른 사람의 저장소에 올릴 필요가 없습니다.",
        "두 번째는 속도와 비용입니다. 옮기는 데이터가 적으면 반복이 빨라지고, 사용자 기기에서 렌더링하면 무료 티어를 지속할 수 있습니다.",
        "세 번째는 통제권입니다. 모든 AI 제안은 최종 컷이 아니라 초안입니다. 내보내기 전에 검토하고, 자르고, 바꾸고, 순서를 조정할 수 있습니다.",
      ],
    },
    {
      heading: "다음 단계",
      paragraphs: [
        "로드맵은 더 나은 이야기 구조, 더 정확한 자막, 매주 꾸준히 올리는 크리에이터를 위한 포맷 프리셋에 집중합니다.",
        "제품은 7개 언어를 지원하며, 개인정보 처리 방식과 약관을 쉬운 언어로 문서화해 누구나 자신의 작업 흐름에 맞는지 판단할 수 있게 했습니다.",
      ],
    },
    {
      heading: "직접 사용해 보기",
      paragraphs: [
        "스튜디오를 열고 이미 가지고 있는 클립을 넣어 첫 하이라이트가 완성되는 과정을 지켜보세요. 설치도, 계정도, 원본 파일 업로드도 필요 없습니다.",
      ],
    },
  ],
  related: ["use-cases/youtube-highlights", "use-cases/travel-vlog-highlights", "about"],
};

const YOUTUBE_EN = {
  title: "YouTube highlight videos with AI — a practical guide",
  description:
    "Turn long recordings into YouTube highlights and Shorts with PenguinCut: what to capture, how to structure six cuts, and the specs that matter.",
  eyebrow: "Guide",
  heading: "How to make YouTube highlight videos with AI",
  lead:
    "Long recordings are full of great moments. This guide shows how to turn them into a tight YouTube highlight — and a matching Shorts cut — without editing for hours.",
  updated: "2026-11-19",
  sections: [
    {
      heading: "Who this is for",
      paragraphs: [
        "Creators publishing gameplay, reactions, interviews, vlogs, or event recaps. If your raw footage runs 30 minutes or more and your published video should run 3 to 10 minutes, a highlight workflow will save the most time.",
      ],
    },
    {
      heading: "What makes a good highlight",
      paragraphs: [
        "A highlight is not a shortened recording. It is a small story with a hook, escalation, and a payoff.",
        "The first two seconds decide whether someone keeps watching. Start on the strongest visual or line, not on a logo or a slow establishing shot. Then alternate between context and payoff so the viewer always knows why the next cut matters.",
      ],
      bullets: [
        "Open on the peak, then explain how you got there.",
        "Keep one idea per cut; six cuts is usually enough for a short highlight.",
        "Use captions for every spoken line that carries the story.",
        "End on a clear payoff, not on trailing footage.",
      ],
    },
    {
      heading: "Step by step with PenguinCut",
      paragraphs: [
        "Add the full recording or a set of clips. PenguinCut reads them in your browser and samples frames for analysis.",
        "Choose a model and a reasoning level, then let the AI propose the strongest moments. Review the story plan: reorder cuts, trim the start and end, and replace anything that does not fit.",
        "Add captions, a title overlay, chapter bridges, and music. Choose 16:9 for the main video or 9:16 for Shorts when you start the project.",
      ],
    },
    {
      heading: "Specs that matter",
      paragraphs: [
        "YouTube's main player is built for 16:9. Shorts is vertical 9:16. Keep the important subject near the center of the frame so the vertical crop still reads.",
        "Captions improve retention and accessibility. Keep them short enough to read in one glance, and avoid covering faces or on-screen text.",
      ],
    },
    {
      heading: "A repeatable weekly workflow",
      paragraphs: [
        "Record with the highlight in mind: capture clean audio, hold shots a second longer than feels necessary, and note the moments you already know you want.",
        "After recording, export one highlight and one Short. Reuse the same intro, caption style, and music palette so your channel feels consistent.",
        "Watch the first 30 seconds of your own video. If the hook is not clear, recut before publishing.",
      ],
    },
    {
      heading: "Frequently asked",
      paragraphs: [
        "Do I need to upload the full video? No. PenguinCut analyzes sampled frames and renders locally; the original file stays on your device.",
        "Can I edit the AI's choices? Yes. Every proposed cut can be reviewed, trimmed, replaced, or reordered before export.",
        "Can I make both formats? Yes, as two projects. Each project is created in 16:9 or 9:16, so start one of each.",
      ],
    },
  ],
  related: ["blog/introducing-penguincut", "use-cases/travel-vlog-highlights", "use-cases/sports-highlights"],
};

const YOUTUBE_KO = {
  title: "AI로 만드는 YouTube 하이라이트 영상 가이드",
  description:
    "펭귄컷으로 긴 녹화 영상을 YouTube 하이라이트와 Shorts로 만드는 방법: 무엇을 찍고, 여섯 컷을 어떻게 구성하고, 어떤 규격을 맞출지 안내합니다.",
  eyebrow: "가이드",
  heading: "AI로 YouTube 하이라이트 영상 만들기",
  lead:
    "긴 녹화 영상에는 좋은 순간이 가득합니다. 이 가이드는 몇 시간씩 편집하지 않고도 짧은 YouTube 하이라이트와 Shorts 컷을 만드는 방법을 설명합니다.",
  updated: "2026-11-19",
  sections: [
    {
      heading: "이 가이드가 필요한 사람",
      paragraphs: [
        "게임 플레이, 리액션, 인터뷰, 브이로그, 행사 요약을 올리는 크리에이터. 원본이 30분 이상이고 최종 영상이 3~10분이라면 하이라이트 워크플로가 가장 많은 시간을 아껴 줍니다.",
      ],
    },
    {
      heading: "좋은 하이라이트의 조건",
      paragraphs: [
        "하이라이트는 단순히 줄인 녹화 영상이 아닙니다. 훅, 고조, 보상이 있는 작은 이야기입니다.",
        "처음 2초가 시청 지속을 결정합니다. 로고나 느린 풍경 샷이 아니라 가장 강한 장면이나 대사로 시작하세요. 그다음 맥락과 보상을 번갈아 배치해 다음 컷이 왜 중요한지 항상 보여 줍니다.",
      ],
      bullets: [
        "절정으로 시작하고, 거기까지 온 과정을 설명합니다.",
        "컷 하나에 아이디어 하나. 짧은 하이라이트라면 여섯 컷이면 충분합니다.",
        "이야기를 전달하는 모든 대사에는 자막을 넣습니다.",
        "끝은 명확한 보상으로. 흘러가는 영상으로 마무리하지 않습니다.",
      ],
    },
    {
      heading: "펭귄컷으로 하는 단계별 작업",
      paragraphs: [
        "전체 녹화 영상이나 클립 묶음을 넣으세요. 펭귄컷이 브라우저에서 영상을 읽고 분석용 프레임을 샘플링합니다.",
        "모델과 추론 수준을 고른 뒤 AI가 가장 강한 순간을 제안하게 하세요. 스토리 계획을 검토하면서 컷 순서를 바꾸고, 시작과 끝을 자르고, 맞지 않는 컷은 교체합니다.",
        "자막, 제목 오버레이, 챕터 브릿지, 음악을 더하세요. 새 프로젝트를 시작할 때 본편용 16:9 또는 Shorts용 9:16을 고릅니다.",
      ],
    },
    {
      heading: "중요한 규격",
      paragraphs: [
        "YouTube 본편 플레이어는 16:9에 맞춰져 있고, Shorts는 세로 9:16입니다. 세로 크롭에서도 화면이 읽히도록 중요한 피사체를 프레임 중앙 가까이에 두세요.",
        "자막은 시청 지속과 접근성을 높입니다. 한눈에 읽을 수 있을 만큼 짧게 유지하고, 얼굴이나 화면 자막을 가리지 않게 배치하세요.",
      ],
    },
    {
      heading: "매주 반복할 수 있는 워크플로",
      paragraphs: [
        "하이라이트를 염두에 두고 촬영하세요. 깨끗한 오디오를 확보하고, 필요하다고 느끼는 것보다 1초 더 길게 샷을 유지하고, 꼭 쓰고 싶은 순간을 메모해 두세요.",
        "촬영 후에는 하이라이트 하나와 Short 하나를 내보내세요. 같은 인트로, 자막 스타일, 음악 팔레트를 재사용하면 채널의 일관성이 생깁니다.",
        "자신의 영상 첫 30초를 직접 보세요. 훅이 분명하지 않다면 공개 전에 다시 자르세요.",
      ],
    },
    {
      heading: "자주 묻는 질문",
      paragraphs: [
        "전체 영상을 업로드해야 하나요? 아닙니다. 펭귄컷은 샘플 프레임을 분석하고 로컬에서 렌더링하며, 원본 파일은 기기에 남습니다.",
        "AI가 고른 컷을 수정할 수 있나요? 네. 모든 제안 컷은 내보내기 전에 검토, 자르기, 교체, 순서 변경이 가능합니다.",
        "두 가지 포맷을 동시에 만들 수 있나요? 네, 프로젝트를 두 개 만들면 됩니다. 포맷은 새 프로젝트를 시작할 때 고르므로 하나는 16:9, 다른 하나는 9:16으로 시작하세요.",
      ],
    },
  ],
  related: ["blog/introducing-penguincut", "use-cases/travel-vlog-highlights", "use-cases/sports-highlights"],
};

const TRAVEL_EN = {
  title: "Travel vlog highlights — turn a trip into one shareable film",
  description:
    "A practical guide to travel vlog highlights: what to shoot, how to structure a multi-day trip, and how PenguinCut finds the moments automatically.",
  eyebrow: "Guide",
  heading: "How to make a travel vlog highlight",
  lead:
    "A week of travel can leave you with hundreds of clips and no time to edit. Here is a repeatable way to turn a trip into one shareable highlight.",
  updated: "2026-11-19",
  sections: [
    {
      heading: "Why travel footage piles up",
      paragraphs: [
        "Travel is continuous. You film the walk, the view, the meal, the reaction, and the same view again at sunset. Individually the clips are fine; together they are a storage problem.",
        "A highlight solves the sharing problem by choosing a small number of moments and arranging them into a story. The goal is not to document everything. It is to make someone feel what the trip felt like.",
      ],
    },
    {
      heading: "What to capture",
      paragraphs: [
        "Shoot fewer, longer clips. Hold each shot for at least five seconds so there is room to trim. Capture clean ambient audio and one or two spoken reactions.",
        "Collect the moments that carry the story: arrival, a discovery, something going wrong, the payoff, and a closing shot. Those five beats are enough for a strong travel highlight.",
      ],
      bullets: [
        "One establishing shot per place.",
        "One close-up detail that captures the texture of the trip.",
        "One reaction or line that explains why the moment mattered.",
        "One closing shot with space for a title.",
      ],
    },
    {
      heading: "Step by step with PenguinCut",
      paragraphs: [
        "Group the trip's clips in one project and add them to PenguinCut. The studio reads them in your browser and samples frames for analysis.",
        "Let the AI propose the strongest moments, then shape the story: day one, the turn, the payoff. Use chapter bridges between days or locations so the film stays easy to follow.",
        "Add captions for spoken lines, a title with the place and date, and music that matches the pace. Export 16:9 for YouTube and 9:16 for a vertical recap.",
      ],
    },
    {
      heading: "A simple structure for a multi-day trip",
      paragraphs: [
        "Open on the destination, not on the airport. Establish the place in one shot, then move through two or three experiences, and close on the feeling you want to leave with.",
        "Keep the film short. Three to six minutes is usually enough for a personal trip; a single-day highlight can be under two minutes.",
      ],
    },
    {
      heading: "Frequently asked",
      paragraphs: [
        "Can I mix footage from several cameras? Yes, as long as your browser can decode the files. MP4 (H.264) gives the most predictable results.",
        "Do I need to upload the trip footage? No. The originals stay on your device; only sampled frames are sent for AI analysis.",
        "Can I make a vertical version for social? Yes. Start the project in 9:16 for Shorts, Reels, and TikTok-style feeds.",
      ],
    },
  ],
  related: ["use-cases/youtube-highlights", "use-cases/sports-highlights", "blog/introducing-penguincut"],
};

const TRAVEL_KO = {
  title: "여행 브이로그 하이라이트 — 한 번의 여행을 하나의 영상으로",
  description:
    "여행 브이로그 하이라이트 가이드: 무엇을 찍고, 여러 날의 여행을 어떻게 구성하고, 펭귄컷이 중요한 순간을 자동으로 찾는 방법을 안내합니다.",
  eyebrow: "가이드",
  heading: "여행 브이로그 하이라이트 만드는 방법",
  lead:
    "일주일의 여행은 수백 개의 클립과 편집할 시간 없음으로 끝나기 쉽습니다. 이 가이드는 한 번의 여행을 공유하기 좋은 하나의 하이라이트로 바꾸는 반복 가능한 방법을 설명합니다.",
  updated: "2026-11-19",
  sections: [
    {
      heading: "여행 영상이 쌓이는 이유",
      paragraphs: [
        "여행은 끊임없이 이어집니다. 걷는 장면, 풍경, 식사, 반응, 그리고 같은 풍경을 다시 노을에 찍습니다. 하나씩 보면 괜찮지만 모이면 저장 공간 문제가 됩니다.",
        "하이라이트는 소수의 순간을 골라 이야기로 엮어 공유 문제를 해결합니다. 목표는 모든 것을 기록하는 것이 아니라, 그 여행이 어땠는지 느끼게 하는 것입니다.",
      ],
    },
    {
      heading: "무엇을 찍을까",
      paragraphs: [
        "클립은 적게, 길게 찍으세요. 각 샷을 최소 5초는 유지해야 자를 여유가 생깁니다. 깨끗한 현장 음과 한두 개의 말소리 반응을 담아 두세요.",
        "이야기를 끌고 가는 순간을 모으세요. 도착, 발견, 예상치 못한 일, 보상, 마무리 샷. 이 다섯 비트만으로도 강한 여행 하이라이트가 됩니다.",
      ],
      bullets: [
        "장소마다 한 개의 설정 샷.",
        "여행의 질감을 담는 디테일 클로즈업 한 개.",
        "그 순간이 왜 중요했는지 설명하는 반응이나 대사 한 개.",
        "제목을 얹을 여유가 있는 마무리 샷 한 개.",
      ],
    },
    {
      heading: "펭귄컷으로 하는 단계별 작업",
      paragraphs: [
        "여행 클립을 하나의 프로젝트로 묶어 펭귄컷에 넣으세요. 스튜디오가 브라우저에서 영상을 읽고 분석용 프레임을 샘플링합니다.",
        "AI가 가장 강한 순간을 제안하게 한 뒤 이야기를 다듬으세요. 첫째 날, 전환점, 보상. 날짜나 장소 사이에 챕터 브릿지를 넣으면 영상을 따라가기 쉬워집니다.",
        "대사에는 자막을, 장소와 날짜가 담긴 제목을, 속도에 맞는 음악을 더하세요. YouTube용 16:9와 세로 요약용 9:16을 내보냅니다.",
      ],
    },
    {
      heading: "여러 날 여행의 간단한 구조",
      paragraphs: [
        "공항이 아니라 목적지로 시작하세요. 한 샷으로 장소를 소개하고, 두세 개의 경험을 지나, 남기고 싶은 감정으로 마무리합니다.",
        "영상은 짧게 유지하세요. 개인 여행이라면 3~6분이면 충분하고, 하루짜리 하이라이트는 2분 이내로도 만들 수 있습니다.",
      ],
    },
    {
      heading: "자주 묻는 질문",
      paragraphs: [
        "여러 카메라의 영상을 섞을 수 있나요? 브라우저가 디코딩할 수 있다면 가능합니다. MP4(H.264)가 가장 안정적입니다.",
        "여행 영상을 업로드해야 하나요? 아닙니다. 원본은 기기에 남고, AI 분석에는 샘플 프레임만 전송됩니다.",
        "소셜용 세로 영상도 만들 수 있나요? 네. 프로젝트를 9:16으로 시작하면 Shorts, Reels, TikTok형 피드용 세로 영상을 만들 수 있습니다.",
      ],
    },
  ],
  related: ["use-cases/youtube-highlights", "use-cases/sports-highlights", "blog/introducing-penguincut"],
};

const SPORTS_EN = {
  title: "Sports highlight videos — pull the decisive plays from long game footage",
  description:
    "How to make sports highlights from full-game footage: what to capture, how to build a play sequence, and how PenguinCut finds the decisive moments.",
  eyebrow: "Guide",
  heading: "How to make sports highlight videos",
  lead:
    "A full game is mostly waiting. A highlight is the part people rewatch. This guide shows how to find and assemble the plays that decide the match.",
  updated: "2026-11-19",
  sections: [
    {
      heading: "The problem with full-game footage",
      paragraphs: [
        "A 90-minute match contains a handful of decisive moments. Reviewing it manually means scrubbing through long stretches where nothing happens.",
        "A highlight compresses the match into a sequence of plays: the build-up, the finish, the reaction, and the turning point. The result is easier to share with players, parents, coaches, and fans.",
      ],
    },
    {
      heading: "What to capture",
      paragraphs: [
        "Keep the camera steady and wide enough to follow the action. Capture clean ambient sound so the crowd and the play are audible.",
        "If you can, note the timestamps of the best plays while watching. That gives the AI a strong starting point and makes review faster.",
      ],
      bullets: [
        "Decisive plays and finishes.",
        "The reaction after the play.",
        "The scoreboard or clock when it explains the stakes.",
        "One closing shot of the team or the field.",
      ],
    },
    {
      heading: "Step by step with PenguinCut",
      paragraphs: [
        "Add the full game or a set of clips. PenguinCut samples frames in your browser and sends only those frames for AI analysis.",
        "Let the AI propose the strongest moments, then build the sequence: build-up, finish, reaction. Trim each cut so it starts just before the action and ends on the reaction.",
        "Add captions for commentary or player names, a title with the teams and date, and music that matches the energy. Export 16:9 for YouTube and 9:16 for Shorts.",
      ],
    },
    {
      heading: "A structure that works",
      paragraphs: [
        "Open with the single best play, then rewind to the build-up. Group plays by period or momentum. End on the decisive moment or the team reaction.",
        "Keep the highlight short enough to rewatch. Two to five minutes works for most games; a single-athlete reel can be under 90 seconds.",
      ],
    },
    {
      heading: "Frequently asked",
      paragraphs: [
        "Can PenguinCut handle long game files? Yes, within your browser's file and memory limits. For very long recordings, splitting by half or period gives more predictable results.",
        "Can I add player names and captions? Yes. Captions and title overlays can be edited before export.",
        "Do I need to upload the game footage? No. The original stays on your device; only sampled frames are sent for analysis.",
      ],
    },
  ],
  related: ["use-cases/youtube-highlights", "use-cases/travel-vlog-highlights", "blog/introducing-penguincut"],
};

const SPORTS_KO = {
  title: "스포츠 하이라이트 영상 — 긴 경기에서 결정적 플레이만 뽑기",
  description:
    "전체 경기 영상으로 스포츠 하이라이트를 만드는 방법: 무엇을 찍고, 플레이 시퀀스를 어떻게 구성하고, 펭귄컷이 결정적 순간을 찾는지 안내합니다.",
  eyebrow: "가이드",
  heading: "스포츠 하이라이트 영상 만드는 방법",
  lead:
    "전체 경기는 대부분 기다림입니다. 하이라이트는 사람들이 다시 보는 부분입니다. 이 가이드는 경기를 결정짓는 플레이를 찾아 엮는 방법을 설명합니다.",
  updated: "2026-11-19",
  sections: [
    {
      heading: "전체 경기 영상의 문제",
      paragraphs: [
        "90분 경기에는 결정적인 순간이 몇 개뿐입니다. 직접 검토하려면 아무 일도 일어나지 않는 긴 구간을 처음부터 끝까지 훑어야 합니다.",
        "하이라이트는 경기를 플레이 시퀀스로 압축합니다. 전개, 마무리, 반응, 전환점. 선수, 학부모, 코치, 팬과 공유하기 훨씬 쉬운 결과물이 됩니다.",
      ],
    },
    {
      heading: "무엇을 찍을까",
      paragraphs: [
        "카메라는 고정하고, 경기 전체를 따라갈 수 있을 만큼 넓게 잡으세요. 관중과 플레이 소리가 들리도록 현장 음을 깨끗하게 녹음합니다.",
        "가능하다면 경기를 보면서 좋은 플레이의 타임스탬프를 메모하세요. AI가 시작점을 잡기 쉬워지고 검토도 빨라집니다.",
      ],
      bullets: [
        "결정적 플레이와 마무리.",
        "플레이 직후의 반응.",
        "승부의 맥락을 설명하는 스코어보드나 시계.",
        "팀이나 경기장을 담은 마무리 샷.",
      ],
    },
    {
      heading: "펭귄컷으로 하는 단계별 작업",
      paragraphs: [
        "전체 경기 영상이나 클립 묶음을 넣으세요. 펭귄컷이 브라우저에서 프레임을 샘플링하고, 그 프레임만 AI 분석에 전송합니다.",
        "AI가 가장 강한 순간을 제안하게 한 뒤 시퀀스를 구성하세요. 전개, 마무리, 반응. 각 컷이 플레이 직전에 시작해 반응에서 끝나도록 자릅니다.",
        "해설이나 선수 이름 자막, 팀과 날짜를 담은 제목, 에너지에 맞는 음악을 더하세요. YouTube용 16:9와 Shorts용 9:16을 내보냅니다.",
      ],
    },
    {
      heading: "효과적인 구성",
      paragraphs: [
        "가장 좋은 플레이로 시작한 뒤 전개로 돌아가세요. 피리어드나 흐름에 따라 플레이를 묶고, 결정적 순간이나 팀의 반응으로 마무리합니다.",
        "다시 보고 싶을 만큼 짧게 유지하세요. 대부분의 경기는 2~5분이면 충분하고, 한 선수의 릴은 90초 이내로도 만들 수 있습니다.",
      ],
    },
    {
      heading: "자주 묻는 질문",
      paragraphs: [
        "긴 경기 파일도 처리할 수 있나요? 브라우저의 파일 및 메모리 한도 안에서 가능합니다. 아주 긴 녹화는 전반/후반처럼 나눠 작업하면 결과가 더 안정적입니다.",
        "선수 이름과 자막을 넣을 수 있나요? 네. 내보내기 전에 자막과 제목 오버레이를 편집할 수 있습니다.",
        "경기 영상을 업로드해야 하나요? 아닙니다. 원본은 기기에 남고, 분석에는 샘플 프레임만 전송됩니다.",
      ],
    },
  ],
  related: ["use-cases/youtube-highlights", "use-cases/travel-vlog-highlights", "blog/introducing-penguincut"],
};

export const CONTENT_PAGES = [
  { slug: "privacy", kind: "legal", en: PRIVACY_EN, ko: PRIVACY_KO },
  { slug: "terms", kind: "legal", en: TERMS_EN, ko: TERMS_KO },
  { slug: "about", kind: "about", en: ABOUT_EN, ko: ABOUT_KO },
  {
    slug: "blog/introducing-penguincut",
    kind: "article",
    en: BLOG_EN,
    ko: BLOG_KO,
  },
  {
    slug: "use-cases/youtube-highlights",
    kind: "article",
    en: YOUTUBE_EN,
    ko: YOUTUBE_KO,
  },
  {
    slug: "use-cases/travel-vlog-highlights",
    kind: "article",
    en: TRAVEL_EN,
    ko: TRAVEL_KO,
  },
  {
    slug: "use-cases/sports-highlights",
    kind: "article",
    en: SPORTS_EN,
    ko: SPORTS_KO,
  },
];

export function contentPath(page, code) {
  return code === "ko" ? `/ko/${page.slug}/` : `/${page.slug}/`;
}

export function findContentPage(slug) {
  return CONTENT_PAGES.find((page) => page.slug === slug) || null;
}

export function contentLabel(page, code) {
  return page[code]?.heading || page.en.heading;
}
