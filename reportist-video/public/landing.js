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

/* ---------- Promo film: ambient loops + modal player ---------- */

(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const modal = document.querySelector("[data-video-modal]");
  const player = modal?.querySelector("[data-video-player]");
  const openers = Array.from(document.querySelectorAll("[data-video-open]"));
  const closeButton = modal?.querySelector("[data-video-close]");
  const ambients = Array.from(
    document.querySelectorAll("[data-hero-loop], [data-cta-loop]")
  ).filter((node) => node instanceof HTMLVideoElement);
  const active = new WeakSet();
  let lastFocus = null;

  const isFilmOpen = () =>
    Boolean(modal && (modal.open || modal.hasAttribute("open")));

  const canPlayAmbient = () =>
    !reduceMotion.matches && !document.hidden && !isFilmOpen();

  const play = (video) => {
    const attempt = video.play();
    if (attempt && typeof attempt.catch === "function") attempt.catch(() => {});
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
