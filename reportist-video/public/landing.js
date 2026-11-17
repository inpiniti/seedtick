(() => {
  const nav = document.querySelector("[data-nav]");
  const toggle = document.querySelector("[data-nav-toggle]");
  const langSwitcher = document.querySelector(".lang-switcher");

  if (nav && toggle) {
    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      if (open) globalThis.__penguinLenis?.stop?.();
      else globalThis.__penguinLenis?.start?.();
    };

    toggle.addEventListener("click", () => {
      setOpen(!nav.classList.contains("is-open"));
    });

    nav.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("a")) {
        setOpen(false);
      }
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (
        nav.classList.contains("is-open") &&
        target instanceof Node &&
        !nav.contains(target) &&
        !toggle.contains(target)
      ) {
        setOpen(false);
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 840) setOpen(false);
    });
  }

  if (langSwitcher) {
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (
        langSwitcher.open &&
        target instanceof Node &&
        !langSwitcher.contains(target)
      ) {
        langSwitcher.open = false;
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (langSwitcher?.open) langSwitcher.open = false;
    if (nav?.classList.contains("is-open")) {
      nav.classList.remove("is-open");
      toggle?.setAttribute("aria-expanded", "false");
      toggle?.focus();
    }
  });
})();

/* ---------- Overlay header: transparent only at the very top ---------- */

(() => {
  // The landing hero runs full-bleed under a transparent header; the solid
  // sticky header returns as soon as the page scrolls past the fold. The
  // overlay drops while the mobile nav is open so the menu stays readable.
  const hero = document.querySelector(".hero");
  if (!hero) return;

  const toggle = document.querySelector("[data-nav-toggle]");
  const root = document.documentElement;

  const sync = () => {
    const navOpen = toggle
      ? toggle.getAttribute("aria-expanded") === "true"
      : false;
    root.classList.toggle("is-hero-top", window.scrollY < 24 && !navOpen);
  };

  const scheduleSync = () => requestAnimationFrame(sync);

  window.addEventListener("scroll", scheduleSync, { passive: true });
  window.addEventListener("resize", scheduleSync);
  document.addEventListener("click", scheduleSync);
  document.addEventListener("keydown", scheduleSync);
  document.addEventListener("visibilitychange", sync);
  sync();
})();

/* ---------- Promo film: ambient loops + modal player ---------- */

(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const modal = document.querySelector("[data-video-modal]");
  const player = modal?.querySelector("[data-video-player]");
  const openers = Array.from(document.querySelectorAll("[data-video-open]"));
  const closeButton = modal?.querySelector("[data-video-close]");
  const ambients = Array.from(
    document.querySelectorAll(
      "[data-hero-bg], [data-cta-loop], [data-theater-video]"
    )
  ).filter((node) => node instanceof HTMLVideoElement);
  const active = new WeakSet();
  let lastFocus = null;

  const isFilmOpen = () =>
    Boolean(modal && (modal.open || modal.hasAttribute("open")));

  const canPlayAmbient = () =>
    !reduceMotion.matches && !document.hidden && !isFilmOpen();

  const play = (video) => {
    const attempt = video.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        video.dispatchEvent(new Event("ambient-blocked"));
      });
    }
  };

  const setAmbient = (video, on) => {
    if (on) active.add(video);
    else active.delete(video);
    if (on && canPlayAmbient()) play(video);
    else video.pause();
  };

  if (ambients.length) {
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            setAmbient(entry.target, entry.isIntersecting);
          }
        },
        { threshold: 0.15 }
      );

      for (const video of ambients) observer.observe(video);
    } else {
      for (const video of ambients) setAmbient(video, true);
    }

    document.addEventListener("visibilitychange", () => {
      for (const video of ambients) {
        if (document.hidden) video.pause();
        else if (active.has(video)) setAmbient(video, true);
      }
    });

    reduceMotion.addEventListener?.("change", () => {
      for (const video of ambients) {
        if (reduceMotion.matches) video.pause();
        else if (active.has(video)) setAmbient(video, true);
      }
    });
  }

  /* ---------- Inline theater: sound toggle, chapters, progress ---------- */

  const theater = document.querySelector("[data-theater]");
  const theaterVideo = theater
    ? theater.querySelector("[data-theater-video]")
    : null;

  if (theater && theaterVideo instanceof HTMLVideoElement) {
    const soundButton = theater.querySelector("[data-theater-sound]");
    const playButton = theater.querySelector("[data-theater-play]");
    const progressBar = theater.querySelector("[data-theater-progress]");
    const chapters = Array.from(
      theater.querySelectorAll("[data-theater-chapter]")
    );

    const sync = () => {
      const duration = theaterVideo.duration;
      const time = theaterVideo.currentTime;

      if (progressBar && Number.isFinite(duration) && duration > 0) {
        progressBar.style.width = `${Math.min(
          100,
          (time / duration) * 100
        )}%`;
      }

      let activeIndex = 0;
      for (let index = 0; index < chapters.length; index += 1) {
        const start = Number(chapters[index].dataset.time);
        if (Number.isFinite(start) && time + 0.25 >= start) activeIndex = index;
      }

      chapters.forEach((chapter, index) => {
        const isActive = index === activeIndex;
        chapter.classList.toggle("is-active", isActive);
        if (isActive) chapter.setAttribute("aria-current", "step");
        else chapter.removeAttribute("aria-current");
      });
    };

    const setSound = (on) => {
      theaterVideo.muted = !on;
      if (soundButton) {
        soundButton.classList.toggle("is-on", on);
        soundButton.setAttribute("aria-pressed", String(on));
      }
      if (on && theaterVideo.paused) play(theaterVideo);
    };

    soundButton?.addEventListener("click", () => {
      setSound(theaterVideo.muted);
    });

    for (const chapter of chapters) {
      chapter.addEventListener("click", () => {
        const time = Number(chapter.dataset.time);
        if (Number.isFinite(time)) theaterVideo.currentTime = time;
        play(theaterVideo);
        sync();
      });
    }

    playButton?.addEventListener("click", () => {
      play(theaterVideo);
    });

    theaterVideo.addEventListener("play", () => {
      if (playButton) playButton.hidden = true;
    });

    theaterVideo.addEventListener("pause", () => {
      if (playButton) playButton.hidden = false;
    });

    theaterVideo.addEventListener("ambient-blocked", () => {
      if (playButton) playButton.hidden = false;
    });

    if (reduceMotion.matches && playButton) playButton.hidden = false;

    reduceMotion.addEventListener?.("change", () => {
      if (reduceMotion.matches && playButton) playButton.hidden = false;
    });

    theaterVideo.addEventListener("timeupdate", sync);
    theaterVideo.addEventListener("seeked", sync);
    theaterVideo.addEventListener("loadedmetadata", sync);
    sync();
  }

  if (!modal || !player) return;

  const teardown = () => {
    player.pause();
    document.documentElement.classList.remove("is-film-open");
    globalThis.__penguinLenis?.start?.();
    const focusTarget = lastFocus;
    lastFocus = null;
    if (focusTarget instanceof HTMLElement && document.contains(focusTarget)) {
      focusTarget.focus();
    }
    for (const video of ambients) {
      if (active.has(video)) setAmbient(video, true);
    }
  };

  const openFilm = () => {
    lastFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    for (const video of ambients) video.pause();

    if (!player.getAttribute("src") && player.dataset.videoSrc) {
      player.src = player.dataset.videoSrc;
    }

    if (typeof modal.showModal === "function" && !modal.open) {
      modal.showModal();
    } else {
      modal.setAttribute("open", "");
    }

    document.documentElement.classList.add("is-film-open");
    globalThis.__penguinLenis?.stop?.();
    player.currentTime = 0;
    play(player);
  };

  const closeFilm = () => {
    if (typeof modal.close === "function" && modal.open) {
      modal.close();
    } else {
      modal.removeAttribute("open");
      teardown();
    }
  };

  for (const opener of openers) {
    opener.addEventListener("click", openFilm);
  }

  closeButton?.addEventListener("click", closeFilm);

  modal.addEventListener("close", teardown);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeFilm();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isFilmOpen() && typeof modal.close !== "function") {
      closeFilm();
    }
  });
})();

/* ---------- 9:16 portrait switch (Shorts · Reels · TikTok · phones) ---------- */

(() => {
  // Small viewports get the 9:16 cut of the story film so it fills a phone
  // instead of letterboxing. Desktop keeps the 16:9 master.
  const media = window.matchMedia("(max-width: 680px)");
  const theaterVideo = document.querySelector("[data-theater-video]");
  const theaterSource =
    theaterVideo instanceof HTMLVideoElement
      ? theaterVideo.querySelector("source")
      : null;
  const modalVideo = document.querySelector("[data-video-player]");

  const swap = (url) => url.replace("/media/promo-", "/media/promo-v-");
  const unswap = (url) => url.replace("/media/promo-v-", "/media/promo-");
  const localeOf = (url) => (String(url).match(/promo-(?:v-)?([a-z]{2})\.mp4/) || [])[1];

  const applyTheater = (portrait) => {
    if (!theaterVideo || !theaterSource) return;
    const current = theaterSource.getAttribute("src") || "";
    const next = portrait ? swap(current) : unswap(current);
    if (next === current) return;

    const wasPlaying = !theaterVideo.paused;
    const resumeAt = theaterVideo.currentTime;
    theaterSource.setAttribute("src", next);
    theaterVideo.setAttribute("width", portrait ? "720" : "1280");
    theaterVideo.setAttribute("height", portrait ? "1280" : "720");
    const code = localeOf(next);
    if (code) {
      theaterVideo.poster = portrait
        ? `/media/poster-v-${code}.webp`
        : `/media/result-${code}.webp`;
    }

    const onMetadata = () => {
      theaterVideo.removeEventListener("loadedmetadata", onMetadata);
      if (Number.isFinite(resumeAt)) {
        try {
          theaterVideo.currentTime = Math.min(resumeAt, Math.max(0, theaterVideo.duration - 0.1));
        } catch {
          /* the seek may land before the film is ready; start from the top */
        }
      }
      if (wasPlaying) {
        const attempt = theaterVideo.play();
        if (attempt && typeof attempt.catch === "function") attempt.catch(() => {});
      }
    };
    theaterVideo.addEventListener("loadedmetadata", onMetadata);
    theaterVideo.load();
  };

  const applyModal = (portrait) => {
    if (!(modalVideo instanceof HTMLVideoElement)) return;
    const src = modalVideo.dataset.videoSrc;
    if (!src) return;
    const next = portrait ? swap(src) : unswap(src);
    modalVideo.dataset.videoSrc = next;
    const code = localeOf(next);
    modalVideo.poster = code && portrait
      ? `/media/poster-v-${code}.webp`
      : "/media/hero-poster.webp";
    modalVideo.setAttribute("width", portrait ? "720" : "1280");
    modalVideo.setAttribute("height", portrait ? "1280" : "720");
    // If the 16:9 file was already loaded, swap it too so the modal
    // matches the new orientation without a reload.
    if (modalVideo.getAttribute("src")) modalVideo.src = next;
  };

  const applyAll = () => {
    applyTheater(media.matches);
    applyModal(media.matches);
  };
  applyAll();

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", applyAll);
  } else if (typeof media.addListener === "function") {
    media.addListener(applyAll);
  }
})();

/* ---------- Scroll Director: Lenis inertia + moment-capture motion ---------- */

(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const root = document.documentElement;

  const hero = document.querySelector(".hero");
  const reelViewport = document.querySelector("[data-reel]");
  const reelTrack = reelViewport
    ? reelViewport.querySelector("[data-reel-track]")
    : null;
  const reelFrames = reelViewport
    ? Array.from(reelViewport.querySelectorAll("[data-reel-frame]"))
    : [];
  const reelCount = reelViewport
    ? reelViewport.querySelector("[data-reel-count]")
    : null;
  const climaxFrame = reelViewport
    ? reelViewport.querySelector("[data-climax]")
    : null;
  const tcHud = document.querySelector("[data-tc-hud]");
  const tcTime = tcHud ? tcHud.querySelector("[data-tc-time]") : null;
  const tcState = tcHud ? tcHud.querySelector("[data-tc-state]") : null;
  const stepFill = document.querySelector("[data-step-fill]");
  const stepSection = stepFill ? stepFill.closest("section") : null;
  const stepCards = stepSection
    ? Array.from(stepSection.querySelectorAll(".step-card"))
    : [];
  const header = document.querySelector(".site-header");

  // Living Film Stack — 3D sticky stages (features) and re-assembly (how).
  const featSection = document.querySelector("[data-stack-features]");
  const featStage = featSection
    ? featSection.querySelector("[data-stack-stage]")
    : null;
  const featSticky = featStage
    ? featStage.querySelector("[data-stack-sticky]")
    : null;
  const featStack = featStage ? featStage.querySelector("[data-film-stack]") : null;
  const featLayers = featStack
    ? Array.from(featStack.querySelectorAll(".film-layer"))
    : [];
  const featPanels = featStage
    ? Array.from(featStage.querySelectorAll("[data-stack-panel]"))
    : [];
  const featTicks = featStage
    ? Array.from(featStage.querySelectorAll("[data-stack-tick]"))
    : [];
  let featActive = -1;

  const howSection = document.querySelector("[data-how-section]");
  const howStage = howSection ? howSection.querySelector("[data-how-stage]") : null;
  const howSticky = howStage ? howStage.querySelector("[data-how-sticky]") : null;
  const howViewport = howStage ? howStage.querySelector("[data-how-viewport]") : null;
  const howStack = howStage ? howStage.querySelector("[data-film-stack]") : null;
  const howLayers = howStack
    ? Array.from(howStack.querySelectorAll(".film-layer"))
    : [];
  const howPanels = howStage
    ? Array.from(howStage.querySelectorAll("[data-how-panel]"))
    : [];
  const howTicks = howStage
    ? Array.from(howStage.querySelectorAll("[data-how-tick]"))
    : [];
  let howActive = -1;
  const HOW_LAYER_START = [0.0, 0.02, 0.3, 0.37, 0.44, 0.51];
  const HOW_LAYER_END = [0.3, 0.32, 0.52, 0.58, 0.64, 0.7];
  const HOW_STEP_LAYERS = [[0, 1], [2, 3, 4], [5]];

  const theaterSection = document.querySelector(".theater");
  const useCaseCards = Array.from(document.querySelectorAll(".use-case-card"));

  // The stages only engage when the visitor can appreciate motion and the
  // viewport is tall enough for a sticky stage. Otherwise the classic grids
  // stay visible and the stages stay display: none.
  const lowHeight = window.matchMedia("(max-height: 540px)");
  const stagesOn =
    !reduceMotion.matches && !lowHeight.matches && Boolean(featStage || howStage);
  if (stagesOn) root.classList.add("has-3d-stages");

  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  const pad = (value) => String(value).padStart(2, "0");
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const smoothstep = (t) => t * t * (3 - 2 * t);

  // Lenis: inertial wheel scrolling on desktop; touch stays native (syncTouch).
  let lenis = null;
  if (window.Lenis && !reduceMotion.matches) {
    lenis = new window.Lenis({
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 1,
    });
    globalThis.__penguinLenis = lenis;
  }

  let lastY = window.scrollY || 0;
  let smoothVelocity = 0;
  const RAW_RUNTIME_SECONDS = 2 * 3600 + 18 * 60 + 40; // "02:18:40" of raw footage

  const formatClock = (seconds) => {
    const total = Math.floor(seconds);
    return `${pad(Math.floor(total / 3600))}:${pad(
      Math.floor((total % 3600) / 60)
    )}:${pad(total % 60)}`;
  };

  const update = () => {
    const y = window.scrollY || root.scrollTop || 0;
    const vh = window.innerHeight;

    // Velocity (px per frame), lightly smoothed for the filmstrip lean
    const instant = y - lastY;
    lastY = y;
    smoothVelocity = smoothVelocity * 0.82 + instant * 0.18;
    const velocity =
      lenis && Number.isFinite(lenis.velocity)
        ? lenis.velocity
        : smoothVelocity * 3;
    const skew = Math.max(-4.5, Math.min(4.5, velocity * 0.06));

    // Hero scrub: background pushes in, copy lifts away
    if (hero) {
      const heroDistance = Math.max(1, hero.offsetHeight * 0.9);
      hero.style.setProperty("--hero-p", clamp01(y / heroDistance).toFixed(4));
    }

    // Raw-footage timecode HUD
    const maxScroll = Math.max(1, root.scrollHeight - vh);
    const progress = clamp01(y / maxScroll);
    if (tcTime) tcTime.textContent = formatClock(progress * RAW_RUNTIME_SECONDS);

    // Moment Capture Reel: scroll drives the filmstrip, focus snaps each frame
    let climaxLocked = false;
    if (reelViewport && reelTrack) {
      const rect = reelViewport.getBoundingClientRect();
      const p = clamp01((vh * 0.95 - rect.top) / (rect.height + vh * 0.7));
      const maxTranslate = Math.max(
        0,
        reelTrack.scrollWidth - reelViewport.clientWidth
      );
      reelTrack.style.transform = `translate3d(${(-p * maxTranslate).toFixed(
        1
      )}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;

      const viewportCenter = window.innerWidth / 2;
      let focusedIndex = -1;
      let focusedDistance = Infinity;

      reelFrames.forEach((frame, index) => {
        const frameRect = frame.getBoundingClientRect();
        const distance = Math.abs(
          frameRect.left + frameRect.width / 2 - viewportCenter
        );
        const isFocus =
          distance < Math.min(frameRect.width * 0.72, window.innerWidth * 0.42);
        frame.classList.toggle("is-focus", isFocus);
        if (isFocus && distance < focusedDistance) {
          focusedDistance = distance;
          focusedIndex = index;
        }
      });

      if (reelCount && focusedIndex >= 0) {
        reelCount.textContent = pad(focusedIndex + 1);
      }

      if (climaxFrame) {
        const climaxRect = climaxFrame.getBoundingClientRect();
        const distance = Math.abs(
          climaxRect.left + climaxRect.width / 2 - viewportCenter
        );
        climaxLocked =
          distance <
            Math.min(climaxRect.width * 0.78, window.innerWidth * 0.46) ||
          p > 0.82;
        climaxFrame.classList.toggle("is-locked", climaxLocked);
      }
    }

    if (tcHud) {
      tcHud.dataset.locked = String(climaxLocked);
      if (tcState) {
        tcState.textContent = climaxLocked
          ? tcHud.dataset.lockedText || ""
          : tcHud.dataset.scanningText || "";
      }
    }

    // How-it-works: progress rail fills, steps activate in order
    if (stepFill && stepSection) {
      const rect = stepSection.getBoundingClientRect();
      const p = clamp01(
        (vh * 0.82 - rect.top) / (rect.height + vh * 0.3)
      );
      stepFill.style.width = `${(p * 100).toFixed(2)}%`;
      stepCards.forEach((card, index) => {
        card.classList.toggle(
          "is-active",
          p > (index + 0.55) / stepCards.length
        );
      });
    }

    // Act 3 — Features: the flat master slab tilts into an isometry and
    // the six layers bloom apart; the panel/tick focus follows the active layer.
    if (stagesOn && featStage && featStack) {
      const rect = featStage.getBoundingClientRect();
      const stickyH = featSticky ? featSticky.offsetHeight : vh;
      const total = Math.max(1, featStage.offsetHeight - stickyH);
      const p = clamp01(-rect.top / total);

      const rotT = easeOutCubic(clamp01(p / 0.16));
      const settleT = smoothstep(clamp01((p - 0.88) / 0.12));
      const rx = lerp(8, 56, rotT) - settleT * 15;
      const rz = lerp(-8, -30, rotT) + settleT * 9;
      const explode = smoothstep(clamp01((p - 0.13) / 0.72));

      featStack.style.setProperty("--stack-rx", `${rx.toFixed(3)}deg`);
      featStack.style.setProperty("--stack-rz", `${rz.toFixed(3)}deg`);
      featStack.style.setProperty("--explode", explode.toFixed(4));
      featStack.classList.toggle("has-depth", explode > 0.42);

      const idx = Math.min(5, Math.max(0, Math.floor(((p - 0.14) / 0.74) * 6)));
      if (idx !== featActive) {
        featActive = idx;
        featLayers.forEach((layer, i) =>
          layer.classList.toggle("is-active", i === idx)
        );
        featPanels.forEach((panel, i) =>
          panel.classList.toggle("is-active", i === idx)
        );
        featTicks.forEach((tick, i) =>
          tick.classList.toggle("is-active", i === idx)
        );
      }
    }

    // Act 4 — How it works: layers settle in three waves (clips → story →
    // polish), the block turns to face you, then splits into 16:9 & 9:16.
    if (stagesOn && howStage && howStack && howViewport && howLayers.length === 6) {
      const rect = howStage.getBoundingClientRect();
      const stickyH = howSticky ? howSticky.offsetHeight : vh;
      const total = Math.max(1, howStage.offsetHeight - stickyH);
      const p = clamp01(-rect.top / total);

      for (let i = 0; i < 6; i += 1) {
        const t = easeInOutCubic(
          clamp01((p - HOW_LAYER_START[i]) / (HOW_LAYER_END[i] - HOW_LAYER_START[i]))
        );
        howLayers[i].style.setProperty("--ez", (1 - t).toFixed(4));
      }

      const faceT = easeInOutCubic(clamp01((p - 0.52) / 0.3));
      howStack.style.setProperty("--stack-rx", `${(56 * (1 - faceT)).toFixed(3)}deg`);
      howStack.style.setProperty("--stack-rz", `${(-30 * (1 - faceT)).toFixed(3)}deg`);
      howStack.style.setProperty("--explode", "1");
      howStack.classList.toggle("has-depth", faceT < 0.85);

      const splitT = easeOutCubic(clamp01((p - 0.74) / 0.24));
      howViewport.style.setProperty("--split", splitT.toFixed(4));

      const scanT = clamp01(p / 0.3);
      const scanO = p < 0.3 ? 1 : clamp01(1 - (p - 0.3) / 0.06);
      howViewport.style.setProperty("--scan", scanT.toFixed(4));
      howViewport.style.setProperty("--scan-o", scanO.toFixed(3));

      const idx = p < 0.33 ? 0 : p < 0.66 ? 1 : 2;
      if (idx !== howActive) {
        howActive = idx;
        const lit = HOW_STEP_LAYERS[idx];
        howLayers.forEach((layer, i) =>
          layer.classList.toggle("is-active", lit.includes(i))
        );
        howPanels.forEach((panel, i) =>
          panel.classList.toggle("is-active", i === idx)
        );
        howTicks.forEach((tick, i) =>
          tick.classList.toggle("is-active", i === idx)
        );
      }
    }

    // Act 5 — Theater tilts flat as the finished film arrives.
    if (stagesOn && theaterSection) {
      const rect = theaterSection.getBoundingClientRect();
      const p = clamp01((vh * 0.92 - rect.top) / (vh * 0.7));
      theaterSection.style.setProperty("--theater-p", p.toFixed(4));
    }

    // Act 5 — Use cases drift against the scroll for a gentle parallax.
    if (stagesOn && useCaseCards.length) {
      const mid = vh / 2;
      for (const card of useCaseCards) {
        const rect = card.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const offset = Math.max(-1, Math.min(1, (center - mid) / mid));
        card.style.setProperty("--up", `${(-offset * 16).toFixed(2)}px`);
      }
    }
  };

  if (lenis) {
    const raf = (time) => {
      lenis.raf(time);
      update();
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  } else {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  // Layer/step ticks scroll the pinned stage to that exact beat.
  if (stagesOn) {
    const scrollStageTo = (stageEl, stickyEl, fraction) => {
      const stickyH = stickyEl ? stickyEl.offsetHeight : 0;
      const total = Math.max(1, stageEl.offsetHeight - stickyH);
      const docTop = stageEl.getBoundingClientRect().top + window.scrollY;
      const target = docTop + fraction * total;
      if (lenis) {
        lenis.scrollTo(target, { offset: -12, duration: 1.05 });
      } else {
        window.scrollTo({ top: Math.max(0, target - 12), behavior: "smooth" });
      }
    };

    for (const tick of featTicks) {
      tick.addEventListener("click", () => {
        const i = Number(tick.dataset.stackTick);
        if (!Number.isFinite(i) || !featStage) return;
        scrollStageTo(featStage, featSticky, 0.14 + ((i + 0.5) / 6) * 0.74);
      });
    }

    for (const tick of howTicks) {
      tick.addEventListener("click", () => {
        const i = Number(tick.dataset.howTick);
        if (!Number.isFinite(i) || !howStage) return;
        scrollStageTo(howStage, howSticky, 0.03 + ((i + 0.5) / 3) * 0.94);
      });
    }
  }

  // Reveal cards as they enter the viewport (focus-in, staggered per grid)
  const revealTargets = Array.from(
    document.querySelectorAll(
      ".feature-card, .step-card, .use-case-card, .language-card"
    )
  );

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    for (const el of revealTargets) el.classList.add("is-in");
  } else {
    const groupCount = new Map();
    for (const el of revealTargets) {
      const parent = el.parentElement || root;
      const index = groupCount.get(parent) || 0;
      groupCount.set(parent, index + 1);
      el.style.setProperty("--d", `${Math.min(index, 6) * 80}ms`);
      el.classList.add("reveal");
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );

    for (const el of revealTargets) observer.observe(el);
  }

  // Anchor navigation eased by Lenis (offset clears the sticky header)
  if (lenis) {
    document.addEventListener("click", (event) => {
      const anchor =
        event.target instanceof Element
          ? event.target.closest('a[href^="#"]')
          : null;
      if (!anchor) return;
      const hash = anchor.getAttribute("href");
      if (!hash || hash === "#") return;

      let target = null;
      try {
        target = document.querySelector(hash);
      } catch {
        return;
      }
      if (!(target instanceof HTMLElement)) return;

      event.preventDefault();
      const headerHeight = header ? header.offsetHeight : 0;
      lenis.scrollTo(target, { offset: -(headerHeight + 12), duration: 1.15 });
    });
  }
})();

