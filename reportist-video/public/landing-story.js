/* Landing scroll story — canvas frame scrubbing, real product UI showcase,
   3-step playhead, dual-format morph and a tiny scroll HUD. No WebGL, no GSAP:
   landing.js owns the single rAF loop and calls __penguinStory(progress). */

(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const root = document.documentElement;
  const story = document.querySelector("[data-story]");

  // One deterministic subtitle beat. index.html belongs to the static
  // pipeline, so the text node is created here. Its opacity, rise and revealed
  // character count are all pure functions of scroll progress — no timers, no
  // keyframes — so scrubbing back un-reveals and drops the line again.
  const CAPTION_TEXT = "One frame changes everything.";
  const caption = story ? document.createElement("div") : null;
  let captionText = null;
  if (caption) {
    caption.className = "story-subtitle";
    captionText = document.createElement("span");
    captionText.textContent = CAPTION_TEXT;
    caption.appendChild(captionText);
    (story.querySelector(".story-sticky") || story).appendChild(caption);
  }

  if (!story || !root.classList.contains("has-motion-stage") || reduceMotion.matches) {
    // Reduced motion (or a stage that never turns on): final, static text only.
    if (caption && captionText) {
      caption.style.opacity = "1";
      captionText.style.transform = "none";
    }
    return;
  }

  if (caption) {
    caption.style.opacity = "0";
    captionText.style.transform = "translateY(18px)";
  }

  const canvas = story.querySelector("[data-story-canvas]");
  const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
  const thumbs = Array.from(story.querySelectorAll("[data-thumb]"));
  const chips = Array.from(story.querySelectorAll("[data-chip]"));
  const acts = Array.from(story.querySelectorAll("[data-story-act]"));
  const lock = story.querySelector("[data-story-lock]");
  const counter = story.querySelector("[data-story-counter]");
  const actLabel = story.querySelector("[data-story-act-label]");
  const bar = story.querySelector("[data-story-bar]");
  const tc = story.querySelector("[data-story-tc]");
  const cue = story.querySelector("[data-story-cue]");
  const playhead = story.querySelector("[data-story-playhead]");
  const stepRows = Array.from(story.querySelectorAll("[data-story-step]"));
  const uiFront = story.querySelector("[data-ui-front]");
  const uiBack = story.querySelector("[data-ui-back]");
  const uiRows = Array.from(story.querySelectorAll("[data-ui-row]"));
  const uiJumps = Array.from(story.querySelectorAll("[data-ui-jump]"));
  const uiTitle = story.querySelector("[data-ui-title]");
  const uiDesc = story.querySelector("[data-ui-desc]");
  const uiDots = Array.from(story.querySelectorAll("[data-ui-dot]"));
  const timeline = story.querySelector("[data-timeline]");
  const timelineLabel = story.querySelector("[data-timeline-label]");
  const peaks = Array.from(story.querySelectorAll("[data-peak]"));

  const FRAME_COUNT = 72;
  const frames = new Array(FRAME_COUNT);
  const mediaV = window.__PENGUIN_MEDIA_V ? `?v=${window.__PENGUIN_MEDIA_V}` : "";
  const frameUrl = (i) => `/media/frames/f-${String(i + 1).padStart(3, "0")}.webp${mediaV}`;
  const uiUrl = (i) => `/media/ui/ui-${String(i + 1).padStart(2, "0")}.webp${mediaV}`;
  let painted = -1;

  const preloadFrame = (index) => {
    if (index < 0 || index >= FRAME_COUNT || frames[index]) return;
    const img = new Image();
    img.src = frameUrl(index);
    frames[index] = img;
    if (img.decode) img.decode().catch(() => {});
  };

  // The first frame is enough for the stage; the rest streams in near the fold.
  preloadFrame(0);

  let started = false;
  const startPreload = () => {
    if (started) return;
    started = true;
    for (let i = 1; i < FRAME_COUNT; i += 1) preloadFrame(i);
    for (let i = 0; i < uiRows.length; i += 1) {
      const img = new Image();
      img.src = uiUrl(i);
      if (img.decode) img.decode().catch(() => {});
    }
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          startPreload();
          observer.disconnect();
        }
      },
      { rootMargin: "900px" }
    );
    observer.observe(story);
  } else {
    startPreload();
  }

  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  const pad = (value) => String(value).padStart(2, "0");
  const clock = (p) => {
    const total = Math.floor(p * (2 * 3600 + 18 * 60 + 40));
    return `${pad(Math.floor(total / 3600))}:${pad(
      Math.floor((total % 3600) / 60)
    )}:${pad(total % 60)}`;
  };

  // Caption beat sits inside act 0 (0–0.28): it starts exactly where the
  // capture chips light up (raw >= 0.62) and clears before act 1 takes over.
  const CAPTION_START = 0.28 * 0.62;
  const CAPTION_END = 0.272;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
  let captionVisible = false;

  const renderCaption = (progress) => {
    if (!caption || !captionText) return;
    if (progress <= CAPTION_START || progress >= CAPTION_END) {
      if (captionVisible) {
        captionVisible = false;
        captionText.textContent = "";
        captionText.style.transform = "translateY(18px)";
        caption.style.opacity = "0";
      }
      return;
    }
    captionVisible = true;
    const t = clamp01((progress - CAPTION_START) / (CAPTION_END - CAPTION_START));
    // The rise leads and settles early; characters keep arriving a little
    // longer. Both are monotonic in progress, so reverse scroll rewinds them.
    const rise = easeOutCubic(clamp01(t / 0.72));
    const reveal = easeOutQuad(clamp01((t - 0.06) / 0.94));
    const text = CAPTION_TEXT.slice(0, Math.round(CAPTION_TEXT.length * reveal));
    if (captionText.textContent !== text) captionText.textContent = text;
    captionText.style.transform = `translateY(${((1 - rise) * 18).toFixed(2)}px)`;
    caption.style.opacity = Math.min(1, t * 3).toFixed(3);
  };

  const drawFrame = (index) => {
    if (!ctx || index === painted) return;
    const img = frames[index];
    if (!img || !img.complete || !img.naturalWidth) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    const width = canvas.width;
    const height = canvas.height;
    let dw = width;
    let dh = width / ratio;
    if (dh < height) {
      dh = height;
      dw = height * ratio;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
    painted = index;
  };

  const sizeCanvas = () => {
    if (!canvas) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    painted = -1;
  };
  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);

  let activeAct = -1;
  let activeUi = -1;
  let frontIsFront = true;

  const showUi = (next) => {
    if (!uiFront || !uiBack) return;
    const hidden = frontIsFront ? uiBack : uiFront;
    const shown = frontIsFront ? uiFront : uiBack;
    if (hidden.getAttribute("src") !== next) hidden.src = next;
    const reveal = () => {
      hidden.classList.add("is-front");
      shown.classList.remove("is-front");
      frontIsFront = !frontIsFront;
    };
    if (hidden.complete && hidden.naturalWidth) requestAnimationFrame(reveal);
    else hidden.addEventListener("load", reveal, { once: true });
  };

  globalThis.__penguinStory = (p) => {
    const progress = clamp01(p);

    // Act boundaries: capture 0–.28, UI .28–.66, steps .66–.84, format .84–1.
    const act = progress < 0.28 ? 0 : progress < 0.66 ? 1 : progress < 0.84 ? 2 : 3;
    if (act !== activeAct) {
      activeAct = act;
      acts.forEach((node, i) => node.classList.toggle("is-active", i === act));
      story.dataset.act = String(act);
      if (actLabel) actLabel.textContent = `0${act + 1} / 04`;
    }

    if (act === 0) {
      const raw = clamp01(progress / 0.28);
      drawFrame(Math.min(FRAME_COUNT - 1, Math.floor(Math.pow(raw, 0.72) * FRAME_COUNT)));
      const captured = raw >= 0.62;
      chips.forEach((chip) => chip.classList.toggle("is-lit", captured));
      const thumbIndex = Math.min(5, Math.floor(clamp01((raw - 0.08) / 0.5) * 6));
      thumbs.forEach((thumb, i) => thumb.classList.toggle("is-focus", i === thumbIndex));
      if (lock) lock.classList.toggle("is-live", captured);
      if (counter) counter.textContent = pad(thumbIndex + 1);
    }

    if (act === 1) {
      const sub = clamp01((progress - 0.28) / 0.38);
      const index = Math.min(uiRows.length - 1, Math.floor(sub * uiRows.length));
      if (index !== activeUi) {
        activeUi = index;
        showUi(uiUrl(index));
        uiRows.forEach((row, i) => row.classList.toggle("is-current", i === index));
        uiDots.forEach((dot, i) => dot.classList.toggle("is-current", i === index));
        const dot = uiDots[index];
        if (dot) {
          if (uiTitle) uiTitle.textContent = dot.dataset.title || "";
          if (uiDesc) uiDesc.textContent = dot.dataset.desc || "";
        }
      }
    }

    if (act === 2) {
      const sub = clamp01((progress - 0.66) / 0.18);
      if (playhead) playhead.style.width = `${(sub * 100).toFixed(2)}%`;
      const step = Math.min(2, Math.floor(sub * 3));
      stepRows.forEach((row, i) => row.classList.toggle("is-current", i === step));
      if (timeline) {
        const state = step === 0 ? "raw" : step === 1 ? "scan" : "final";
        if (timeline.dataset.state !== state) timeline.dataset.state = state;
        timeline.style.setProperty("--scan-p", clamp01((sub - 1 / 3) * 3).toFixed(4));
        peaks.forEach((peak, i) =>
          peak.classList.toggle(
            "is-lit",
            state !== "raw" && i < Math.ceil(clamp01((sub - 1 / 3) * 3) * 6)
          )
        );
        // once the six cuts are stitched, relabel the head so the compression
        // reads as finished rather than still showing the raw runtime
        if (timelineLabel) {
          timelineLabel.textContent =
            state === "final" ? "6 CUTS · 00:36" : "3 CLIPS · 02:18:40";
        }
      }
    }

    if (bar) bar.style.transform = `scaleX(${progress.toFixed(4)})`;
    if (tc) tc.textContent = clock(progress);
    if (cue) cue.style.opacity = progress > 0.04 ? "0" : "1";
    renderCaption(progress);
  };

  for (const jump of uiJumps) {
    jump.addEventListener("click", () => {
      const index = Number(jump.dataset.uiJump);
      if (!Number.isFinite(index)) return;
      const docTop = story.getBoundingClientRect().top + window.scrollY;
      const height = Math.max(1, story.offsetHeight - window.innerHeight);
      globalThis.__penguinLenis?.scrollTo?.(
        docTop + (0.28 + ((index + 0.5) / uiRows.length) * 0.38) * height,
        { duration: 0.9 }
      );
    });
  }

  globalThis.__penguinStoryReady = true;
})();
