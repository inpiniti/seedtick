(() => {
  const nav = document.querySelector("[data-nav]");
  const toggle = document.querySelector("[data-nav-toggle]");
  const langSwitcher = document.querySelector(".lang-switcher");

  if (nav && toggle) {
    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
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
