// src/i18n/types.ts - Multilingual types and interface definitions for Reportist Video

export type Locale = 'en' | 'ko' | 'ja' | 'zh' | 'es' | 'fr' | 'de';

export interface LocaleInfo {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
}

export interface Dictionary {
  meta: {
    title: string;
    description: string;
    keywords: string;
  };
  common: {
    brandName: string;
    taglineBadge: string;
    loading: string;
    cancel: string;
    close: string;
    save: string;
    delete: string;
    edit: string;
    confirm: string;
    retry: string;
    error: string;
    success: string;
    sec: string;
    total: string;
    videos: string;
    noVideos: string;
    actions: string;
    language: string;
    timeSec: string;
    fileSizeMb: string;
  };
  header: {
    aiModel: string;
    loadingModels: string;
    selectModel: string;
    uploadedVideos: string;
    startAiHighlight: string;
    analyzingAi: string;
    reStitch: string;
    stitching: string;
    download: string;
    reset: string;
    reStitchTitle: string;
    downloadTitle: string;
    selectModelTitle: string;
    manageVideosTitle: string;
  };
  player: {
    leftTitleLabel: string;
    leftTitlePlaceholder: string;
    rightTitleLabel: string;
    rightTitlePlaceholder: string;
    defaultTitleText: string;
    defaultChannelText: string;
    play: string;
    pause: string;
    rewind5s: string;
    forward5s: string;
    mute: string;
    unmute: string;
    emptyTitle: string;
    emptyDesc: string;
    selectVideoFiles: string;
    seekTooltip: string;
  };
  sequencer: {
    title: string;
    clipsCount: string;
    hint: string;
    clipTitle: string;
  };
  bgm: {
    title: string;
    desc: string;
    volume: string;
    myAudioFile: string;
    applied: string;
    changeFile: string;
    deleteBgm: string;
    uploadButton: string;
    uploadHint: string;
  };
  introOutro: {
    introTitle: string;
    introDesc: string;
    outroTitle: string;
    outroDesc: string;
    uploadIntro: string;
    uploadOutro: string;
    removeVideo: string;
    introApplied: string;
    introDefault: string;
    outroApplied: string;
    outroDefault: string;
    outroDefaultText: string;
  };
  dramaticClips: {
    title: string;
    desc: string;
    totalIntervals: string;
    bottomSubtitleToggle: string;
    bottomSubtitleTitle: string;
    emptyNotice: string;
    nowPlaying: string;
    trimMinus: string;
    trimPlus: string;
    excludeInterval: string;
    editorTitle: string;
    editorHint: string;
    subtitleLabel: string;
    subtitlePlaceholder: string;
    dateLabel: string;
    datePlaceholder: string;
    locationLabel: string;
    locationPlaceholder: string;
    checkMapMarker: string;
    naverMap: string;
    googleMap: string;
    cropLabel: string;
    aiRecommended: string;
    cropTop: string;
    cropCenter: string;
    cropBottom: string;
  };
  summaryCard: {
    timeSavedRate: string;
    reducedBy: string;
    originalVideo: string;
    highlightVideo: string;
  };
  processingModal: {
    title: string;
    defaultDesc: string;
    youtubeSpec: string;
    reasoningHeader: string;
    phaseExtract: string;
    phaseAnalyze: string;
    phaseStitch: string;
    phaseProcessing: string;
    waitingModel: string;
    waitingFirstToken: string;
    reasoningProcess: string;
    responseGeneration: string;
    charsCount: string;
    cancelButton: string;
  };
  mapModal: {
    title: string;
    noGpsTitle: string;
    noGpsDesc: string;
    viewNaverMap: string;
    viewGoogleMap: string;
    close: string;
  };
  modelModal: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    sortLabel: string;
    filterModality: string;
    filterAll: string;
    filterImage: string;
    filterVideo: string;
    filterAudio: string;
    sortSpeed: string;
    sortIntelligence: string;
    sortNewest: string;
    sortContext: string;
    providerAll: string;
    badgeFastest: string;
    badgeRecommended: string;
    badgeNew: string;
    speedUnit: string;
    ttftUnit: string;
    metricIntelligence: string;
    metricSpeed: string;
    metricTtft: string;
    metricContext: string;
    noModels: string;
    close: string;
    tagCoding: string;
    tagEffort: string;
    modalityText: string;
    modalityImage: string;
    modalityVideo: string;
    modalityAudio: string;
    benchmarkTip: string;
    speedTiers: {
      ultra: string;
      fast: string;
      balanced: string;
      slow: string;
      unmeasured: string;
    };
  };
  videoListModal: {
    title: string;
    desc: string;
    addMoreVideos: string;
    emptyTitle: string;
    emptyDesc: string;
    selectFiles: string;
    analyzingResolution: string;
    deleteVideo: string;
    close: string;
    totalDurationLabel: string;
    totalSizeLabel: string;
  };
  languageModal: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    tip: string;
    defaultBadge: string;
    supportedBadge: string;
    close: string;
  };
  logs: {
    pipelineStart: string;
    reusingSegments: string;
    extractingFrames: string;
    framesExtracted: string;
    streamConnected: string;
    reasoningStarted: string;
    jsonStarted: string;
    streamFallback: string;
    reasoningComplete: string;
    segmentsConfirmed: string;
    stitchingStart: string;
    stitchingProgress: string;
    stitchingComplete: string;
    cancelledByUser: string;
    genericError: string;
    reStitchError: string;
    noClimaxFound: string;
    statusExtracting: string;
    statusAnalyzing: string;
    statusReasoning: string;
    cropTopName: string;
    cropCenterName: string;
    cropBottomName: string;
  };
  prompt: {
    languageInstruction: string;
    examples: string;
  };
}

export const LOCALES: LocaleInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
];
