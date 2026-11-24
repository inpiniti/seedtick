/* Landing presentation mode — GSAP slide deck on top of the crawlable page.
   The original HTML stays untouched for SEO / no-JS / reduced-motion visitors.
   This layer only turns the wheel/touch/keyboard into one slide per gesture and
   keeps an ambient motion world running behind every slide.
   landing.js remains the rAF authority for the normal page; while the deck is
   active Lenis is stopped and the native page is inert. */
(() => {
  "use strict";

  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const gsap = window.gsap;
  const OPTOUT = "penguincut:deck:optout";

  if (!gsap || !document.body || reduce.matches || window.innerHeight < 480) return;
  try {
    if (sessionStorage.getItem(OPTOUT) === "1") return;
  } catch (_) {}

  const q = (sel, scope = document) => scope.querySelector(sel);
  const qa = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
  const txt = (sel, fallback = "") => (q(sel)?.textContent || "").trim() || fallback;
  const attr = (sel, name) => q(sel)?.getAttribute(name) || "";
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  const idxText = (sel, index = 0, fallback = "") => {
    const node = qa(sel)[index];
    return (node?.textContent || "").trim() || fallback;
  };
  const mediaUrl = (path) =>
    `/media/${path}${window.__PENGUIN_MEDIA_V ? `?v=${window.__PENGUIN_MEDIA_V}` : ""}`;

  const LANG = (q('meta[property="og:locale"]')?.getAttribute("content") || "en_US")
    .split("_")[0];
  const UI = {
    en: {
      slide: "SLIDE", hint: "Scroll or swipe to turn the page", exit: "Regular scroll",
      prev: "Previous slide", next: "Next slide", keys: "↓ / ↑ or scroll",
    },
    ko: {
      slide: "슬라이드", hint: "스크롤하거나 스와이프해서 페이지를 넘겨보세요", exit: "일반 스크롤로 보기",
      prev: "이전 페이지", next: "다음 페이지", keys: "↓ / ↑ 또는 스크롤",
    },
    ja: {
      slide: "スライド", hint: "スクロールまたはスワイプでページをめくります", exit: "通常スクロールに戻る",
      prev: "前のページ", next: "次のページ", keys: "↓ / ↑ またはスクロール",
    },
    zh: {
      slide: "页面", hint: "滚动或滑动即可翻页", exit: "返回普通滚动",
      prev: "上一页", next: "下一页", keys: "↓ / ↑ 或滚动",
    },
    es: {
      slide: "PÁGINA", hint: "Desliza para pasar de página", exit: "Volver al desplazamiento",
      prev: "Página anterior", next: "Página siguiente", keys: "↓ / ↑ o desliza",
    },
    fr: {
      slide: "PAGE", hint: "Faites défiler pour tourner la page", exit: "Retour au défilement",
      prev: "Page précédente", next: "Page suivante", keys: "↓ / ↑ ou défiler",
    },
    de: {
      slide: "SEITE", hint: "Scrollen oder wischen, um die Seite zu drehen", exit: "Normales Scrollen",
      prev: "Vorherige Seite", next: "Nächste Seite", keys: "↓ / ↑ oder scrollen",
    },
  }[LANG] || {
    slide: "SLIDE", hint: "Scroll or swipe to turn the page", exit: "Regular scroll",
    prev: "Previous slide", next: "Next slide", keys: "↓ / ↑ or scroll",
  };

  // Each slide contributes its own corner of the same world: base + glow + key
  // light colours are interpolated by the ambient canvas on every turn.
  const DARK = { base: [5, 8, 15], glow: [24, 39, 64], accent: [240, 180, 41], ink: "#ffffff" };
  const DEEP = { base: [8, 13, 22], glow: [18, 52, 72], accent: [96, 205, 195], ink: "#ffffff" };
  const WARM = { base: [12, 10, 18], glow: [58, 30, 64], accent: [255, 138, 120], ink: "#ffffff" };
  const LIGHT = { base: [248, 249, 250], glow: [220, 232, 246], accent: [15, 23, 42], ink: "#0f172a" };
  const LIGHT_ALT = { base: [244, 247, 250], glow: [224, 236, 232], accent: [15, 23, 42], ink: "#0f172a" };

  const artwork = () =>
    qa(".story-thumb img")
      .map((img) => img.getAttribute("src"))
      .filter(Boolean);
  const uiArtwork = () =>
    Array.from({ length: 6 }, (_, i) =>
      mediaUrl(`ui/ui-${String(i + 1).padStart(2, "0")}.webp`)
    );

  const arrow = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>`;
  const check = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4.2 4.2L19 6.8"/></svg>`;

  const slides = [];

  // 01 — hero: the key light opens onto the film world.
  slides.push({
    id: "hero",
    label: txt(".hero .eyebrow", "PenguinCut"),
    palette: DARK,
    html: () => {
      const h1 = q(".hero h1");
      const lead = h1?.firstChild?.textContent?.trim() || "";
      const accent = txt(".hero h1 .accent");
      const actions = qa(".hero-actions .button")
        .map((a, i) =>
          `<a class="deck-btn ${i === 0 ? "deck-btn--fill" : "deck-btn--ghost"}" href="${esc(a.getAttribute("href"))}" data-k>${esc(a.textContent.trim())}${arrow}</a>`
        )
        .join("");
      const trust = qa(".hero-trust li span")
        .map((li) => `<li data-k>${check}<span>${esc(li.textContent.trim())}</span></li>`)
        .join("");
      const reels = artwork()
        .slice(0, 5)
        .map((src, i) => `<span style="--i:${i}"><img src="${esc(src)}" alt="" loading="lazy"></span>`)
        .join("");
      return `
        <div class="deck-slide-inner deck-hero">
          <div class="deck-hero-copy">
            <p class="deck-eyebrow" data-k><i></i>${esc(txt(".hero .eyebrow"))}</p>
            <h1 class="deck-hero-title" data-k><span>${esc(lead)}</span><em>${esc(accent)}</em></h1>
            <p class="deck-lead" data-k>${esc(txt(".hero-lead"))}</p>
            <div class="deck-actions" data-k>${actions}</div>
            <ul class="deck-trust" data-k>${trust}</ul>
          </div>
          <div class="deck-hero-art" data-k>
            <video class="deck-hero-video" muted loop playsinline autoplay preload="metadata"
              poster="${esc(attr(".hero-bg-video", "poster"))}">
              <source src="${esc(attr(".hero-bg-video source", "src"))}" type="video/mp4">
            </video>
            <span class="deck-vf deck-vf--tl"></span><span class="deck-vf deck-vf--tr"></span>
            <span class="deck-vf deck-vf--bl"></span><span class="deck-vf deck-vf--br"></span>
            <div class="deck-reel-strip">${reels}</div>
            <div class="deck-sweep"></div>
          </div>
        </div>`;
    },
  });

  // 02 — moment capture: a filmstrip sweeping under the scan beam.
  slides.push({
    id: "capture",
    label: idxText(".story-stage-title", 0, txt(".story .eyebrow")),
    palette: DEEP,
    html: () => {
      const reels = artwork()
        .map((src, i) =>
          `<span class="deck-frame" style="--i:${i}"><img src="${esc(src)}" alt="" loading="lazy"><b>${String(i + 1).padStart(2, "0")}</b></span>`
        )
        .join("");
      const chips = qa(".story-chip")
        .map((chip, i) => `<span class="deck-chip" style="--i:${i}"><i>${String(i + 1).padStart(2, "0")}</i>${esc(q("b", chip)?.textContent.trim() || "")}</span>`)
        .join("");
      return `
        <div class="deck-slide-inner deck-capture">
          <div class="deck-copy-block">
            <p class="deck-eyebrow" data-k><i></i>${esc(idxText(".story-act--capture .story-eyebrow"))}</p>
            <h2 class="deck-title" data-k>${esc(idxText(".story-stage-title", 0))}</h2>
            <p class="deck-lead" data-k>${esc(idxText(".story-act--capture .story-lead"))}</p>
            <div class="deck-chips" data-k>${chips}</div>
            <p class="deck-lock" data-k><span></span>${esc(txt("[data-story-lock]"))}</p>
          </div>
          <div class="deck-film-wrap" data-k>
            <div class="deck-film">${reels}<i class="deck-film-scan"></i></div>
            <div class="deck-film-meta"><span>SCANNING</span><b>01 / 06</b></div>
          </div>
        </div>`;
    },
  });

  // 03 — the studio: stills cross-fade while the feature list lights up.
  slides.push({
    id: "studio",
    label: idxText(".story-stage-title", 1, txt("#features-title")),
    palette: DARK,
    html: () => {
      const images = uiArtwork()
        .map((src, i) => `<img src="${esc(src)}" alt="" class="${i === 0 ? "is-front" : ""}" data-deck-ui="${i}" loading="lazy">`)
        .join("");
      const rows = qa(".story-ui-row")
        .map((row, i) => {
          const title = q("b", row)?.textContent.trim() || "";
          const desc = qa("#features .feature-card p")[i]?.textContent.trim() || "";
          return `<li class="deck-feature-row" style="--i:${i}" data-k><b>${String(i + 1).padStart(2, "0")}</b><span><strong>${esc(title)}</strong><small>${esc(desc)}</small></span></li>`;
        })
        .join("");
      return `
        <div class="deck-slide-inner deck-studio">
          <div class="deck-ui-window" data-k>
            <div class="deck-ui-bar"><i></i><i></i><i></i><span>PenguinCut Studio</span></div>
            <div class="deck-ui-screen">${images}<i class="deck-ui-glint"></i></div>
          </div>
          <div class="deck-copy-block">
            <p class="deck-eyebrow" data-k><i></i>${esc(idxText(".story-act--ui .story-eyebrow"))}</p>
            <h2 class="deck-title" data-k>${esc(idxText(".story-stage-title", 1))}</h2>
            <ol class="deck-feature-list">${rows}</ol>
          </div>
        </div>`;
    },
    onEnter: (slide) => {
      const images = qa("[data-deck-ui]", slide);
      let n = 0;
      const id = window.setInterval(() => {
        if (document.hidden) return;
        n = (n + 1) % images.length;
        images.forEach((img, i) => img.classList.toggle("is-front", i === n));
      }, 2100);
      return () => window.clearInterval(id);
    },
  });

  // 04 — the workflow: raw clips collapse into one 00:36 timeline.
  slides.push({
    id: "workflow",
    label: idxText(".story-stage-title", 2, txt("#how-title")),
    palette: WARM,
    html: () => {
      const peaks = qa("[data-peak]")
        .map((_, i) => `<i class="deck-peak" style="--i:${i}"></i>`)
        .join("");
      const steps = qa(".story-step-row")
        .map((row, i) => {
          const title = q("b", row)?.textContent.trim() || "";
          const desc = q("p", row)?.textContent.trim() || "";
          return `<li class="deck-step" style="--i:${i}" data-k><b>${String(i + 1).padStart(2, "0")}</b><span><strong>${esc(title)}</strong><small>${esc(desc)}</small></span></li>`;
        })
        .join("");
      const clips = qa(".story-clip")
        .map((clip, i) => {
          const label = q("b", clip)?.textContent.trim() || "";
          const len = q("small", clip)?.textContent.trim() || "";
          return `<span class="deck-clip" style="--i:${i}"><b>${esc(label)}</b><small>${esc(len)}</small></span>`;
        })
        .join("");
      return `
        <div class="deck-slide-inner deck-workflow">
          <div class="deck-timeline" data-k>
            <div class="deck-timeline-head"><span>RAW FOOTAGE</span><b data-deck-timeline-label>${esc(txt("[data-timeline-label]"))}</b></div>
            <div class="deck-clips">${clips}<div class="deck-peaks">${peaks}</div><i class="deck-scanline"></i></div>
            <div class="deck-timeline-foot"><i class="deck-playhead"></i><span>00:36 · 16:9 &amp; 9:16</span></div>
          </div>
          <div class="deck-copy-block">
            <p class="deck-eyebrow" data-k><i></i>${esc(idxText(".story-act--steps .story-eyebrow"))}</p>
            <h2 class="deck-title" data-k>${esc(idxText(".story-stage-title", 2))}</h2>
            <ol class="deck-steps">${steps}</ol>
          </div>
        </div>`;
    },
  });

  // 05 — dual format: two finished frames arrive from different depths.
  slides.push({
    id: "format",
    label: idxText(".story-stage-title", 3, txt(".story-format-button")),
    palette: DEEP,
    html: () => {
      const figures = qa(".story-format")
        .map((fig, i) => {
          const img = q("img", fig);
          const cap = q("figcaption", fig);
          return `<figure class="deck-format deck-format--${i === 0 ? "wide" : "tall"}" style="--i:${i}" data-k>
            <img src="${esc(img?.getAttribute("src") || "")}" alt="" loading="lazy">
            <figcaption><b>${esc(q("b", cap)?.textContent.trim() || "")}</b><span>${esc(q("span", cap)?.textContent.trim() || "")}</span></figcaption>
          </figure>`;
        })
        .join("");
      const button = q(".story-format-button");
      return `
        <div class="deck-slide-inner deck-format">
          <div class="deck-copy-block">
            <p class="deck-eyebrow" data-k><i></i>FINAL FORMAT</p>
            <h2 class="deck-title" data-k>${esc(idxText(".story-stage-title", 3))}</h2>
            <p class="deck-lead" data-k>${esc(txt(".theater .section-lead"))}</p>
            <button class="deck-btn deck-btn--fill" type="button" data-deck-film data-k>${esc(button?.textContent.trim() || txt(".video-play"))}${arrow}</button>
          </div>
          <div class="deck-formats">${figures}<i class="deck-format-orbit"></i></div>
        </div>`;
    },
  });

  // 06 — the film: an ambient loop that keeps moving after the page turn.
  slides.push({
    id: "film",
    label: txt("#theater-title"),
    palette: DARK,
    html: () => {
      const source = attr("[data-theater-video] source", "src");
      const chapters = qa(".theater-chapter")
        .map((chapter, i) => {
          const label = q(".theater-chapter-label", chapter)?.textContent.trim() || "";
          return `<button class="deck-chapter ${i === 0 ? "is-active" : ""}" type="button" data-deck-chapter="${i}" style="--i:${i}" data-k><i>${String(i + 1).padStart(2, "0")}</i><span>${esc(label)}</span></button>`;
        })
        .join("");
      return `
        <div class="deck-slide-inner deck-film">
          <div class="deck-film-stage" data-k>
            <video class="deck-film-video" muted loop playsinline preload="metadata"
              poster="${esc(attr("[data-theater-video]", "poster"))}">
              <source src="${esc(source)}" type="video/mp4">
            </video>
            <button class="deck-film-play" type="button" data-deck-open-film aria-label="${esc(txt(".theater .section-lead").slice(0, 60))}">${`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.5 5.8c0-.9 1-1.4 1.7-.9l8.4 6.2c.6.4.6 1.4 0 1.8l-8.4 6.2c-.7.5-1.7 0-1.7-.9V5.8Z"/></svg>`}</button>
            <div class="deck-film-bar"><i data-deck-film-progress></i></div>
          </div>
          <div class="deck-copy-block">
            <p class="deck-eyebrow" data-k><i></i>${esc(txt(".theater .eyebrow"))}</p>
            <h2 class="deck-title" data-k>${esc(txt("#theater-title"))}</h2>
            <div class="deck-chapters" data-k>${chapters}</div>
          </div>
        </div>`;
    },
    onEnter: (slide) => {
      const video = q(".deck-film-video", slide);
      if (video) video.play().catch(() => {});
      const bar = q("[data-deck-film-progress]", slide);
      const chapters = qa("[data-deck-chapter]", slide);
      const step = () => {
        if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
        if (bar) bar.style.width = `${(video.currentTime / video.duration) * 100}%`;
        const marks = [0, 4.8, 20.6];
        let active = 0;
        marks.forEach((time, i) => {
          if (video.currentTime + 0.25 >= time) active = i;
        });
        chapters.forEach((c, i) => c.classList.toggle("is-active", i === active));
      };
      const id = window.setInterval(step, 120);
      return () => {
        window.clearInterval(id);
        if (video) video.pause();
      };
    },
  });

  // 07 — features: cards hold the stage but never stop breathing.
  slides.push({
    id: "features",
    label: txt("#features-title"),
    palette: LIGHT,
    html: () => {
      const cards = qa(".feature-card")
        .map((card, i) => {
          const icon = q(".feature-icon svg", card)?.outerHTML || "";
          return `<article class="deck-card" style="--i:${i}" data-k>
            <div class="deck-card-icon">${icon}</div>
            <h3>${esc(q("h3", card)?.textContent.trim() || "")}</h3>
            <p>${esc(q("p", card)?.textContent.trim() || "")}</p>
          </article>`;
        })
        .join("");
      return `
        <div class="deck-slide-inner deck-grid-slide" data-deck-scroll>
          <div class="deck-copy-block deck-copy-block--light">
            <p class="deck-eyebrow" data-k><i></i>${esc(txt("#features .eyebrow"))}</p>
            <h2 class="deck-title" data-k>${esc(txt("#features-title"))}</h2>
            <p class="deck-lead" data-k>${esc(txt("#features .section-lead"))}</p>
          </div>
          <div class="deck-card-grid">${cards}</div>
        </div>`;
    },
  });

  // 08 — use cases: a slow conveyor of the places this belongs.
  slides.push({
    id: "use-cases",
    label: txt("#use-cases-title"),
    palette: LIGHT_ALT,
    html: () => {
      const cards = qa(".use-case-card")
        .map((card, i) => {
          const title = q("h3", card)?.textContent.trim() || "";
          const desc = q("p", card)?.textContent.trim() || "";
          return `<article class="deck-usecase" style="--i:${i}" data-k><b>${String(i + 1).padStart(2, "0")}</b><h3>${esc(title)}</h3><p>${esc(desc)}</p></article>`;
        })
        .join("");
      return `
        <div class="deck-slide-inner deck-grid-slide" data-deck-scroll>
          <div class="deck-copy-block deck-copy-block--light">
            <p class="deck-eyebrow" data-k><i></i>${esc(txt("#use-cases .eyebrow"))}</p>
            <h2 class="deck-title" data-k>${esc(txt("#use-cases-title"))}</h2>
            <p class="deck-lead" data-k>${esc(txt("#use-cases .section-lead"))}</p>
          </div>
          <div class="deck-usecase-grid">${cards}</div>
        </div>`;
    },
  });

  // 09 — languages: the same film, seven native titles.
  slides.push({
    id: "languages",
    label: txt("#languages-title"),
    palette: LIGHT,
    html: () => {
      const cards = qa(".language-card")
        .map((card, i) => {
          const native = q(".language-native", card)?.textContent.trim() || "";
          const label = q(".language-label", card)?.textContent.trim() || "";
          return `<a class="deck-language" style="--i:${i}" data-k href="${esc(card.getAttribute("href"))}"><b>${esc(native)}</b><span>${esc(label)}</span>${arrow}</a>`;
        })
        .join("");
      return `
        <div class="deck-slide-inner deck-grid-slide" data-deck-scroll>
          <div class="deck-copy-block deck-copy-block--light">
            <p class="deck-eyebrow" data-k><i></i>${esc(txt("#languages .eyebrow"))}</p>
            <h2 class="deck-title" data-k>${esc(txt("#languages-title"))}</h2>
            <p class="deck-lead" data-k>${esc(txt("#languages .section-lead"))}</p>
          </div>
          <div class="deck-language-grid">${cards}</div>
        </div>`;
    },
  });

  // 10 — FAQ: the answers arrive one after another.
  slides.push({
    id: "faq",
    label: txt("#faq-title"),
    palette: LIGHT_ALT,
    html: () => {
      const items = qa(".faq-item")
        .slice(0, 4)
        .map((item, i) => {
          const question = q("summary span", item)?.textContent.trim() || "";
          const answer = q("p", item)?.textContent.trim() || "";
          return `<details class="deck-faq" style="--i:${i}" data-k ${i === 0 ? "open" : ""}>
            <summary>${esc(question)}<i></i></summary><p>${esc(answer)}</p>
          </details>`;
        })
        .join("");
      return `
        <div class="deck-slide-inner deck-faq-slide" data-deck-scroll>
          <div class="deck-copy-block deck-copy-block--light">
            <p class="deck-eyebrow" data-k><i></i>${esc(txt("#faq .eyebrow"))}</p>
            <h2 class="deck-title" data-k>${esc(txt("#faq-title"))}</h2>
          </div>
          <div class="deck-faq-list">${items}</div>
        </div>`;
    },
  });

  // 11 — close on the same world we opened on, with the CTA film alive.
  slides.push({
    id: "cta",
    label: txt("#cta-title"),
    palette: WARM,
    html: () => {
      const button = q(".cta-section .button-large");
      const source = attr(".cta-video source", "src");
      return `
        <div class="deck-slide-inner deck-cta">
          <video class="deck-cta-video" muted loop playsinline preload="metadata"
            poster="${esc(attr(".cta-video", "poster"))}">
            <source src="${esc(source)}" type="video/mp4">
          </video>
          <div class="deck-cta-scrim"></div>
          <div class="deck-copy-block deck-copy-block--center">
            <p class="deck-eyebrow" data-k><i></i>${esc(txt(".hero .eyebrow"))}</p>
            <h2 class="deck-cta-title" data-k>${esc(txt("#cta-title"))}</h2>
            <p class="deck-lead" data-k>${esc(txt(".cta-lead"))}</p>
            <a class="deck-btn deck-btn--fill" href="${esc(button?.getAttribute("href") || "/studio")}" data-k>${esc(button?.textContent.trim() || "")}${arrow}</a>
            <p class="deck-cta-note" data-k>${esc(txt(".cta-note"))}</p>
          </div>
          <div class="deck-cta-ring" aria-hidden="true"></div>
        </div>`;
    },
    onEnter: (slide) => {
      const video = q(".deck-cta-video", slide);
      if (video) video.play().catch(() => {});
      return () => video && video.pause();
    },
  });

  // ---------------------------------------------------------------------------
  // Deck shell
  // ---------------------------------------------------------------------------

  const deck = document.createElement("div");
  deck.className = "deck";
  deck.setAttribute("role", "region");
  deck.setAttribute("aria-roledescription", "carousel");
  deck.setAttribute("aria-label", "PenguinCut");
  deck.innerHTML = `
    <canvas class="deck-fx" aria-hidden="true"></canvas>
    <div class="deck-grid-lines" aria-hidden="true"></div>
    <div class="deck-vignette" aria-hidden="true"></div>
    <div class="deck-track" data-deck-track></div>
    <div class="deck-flash" aria-hidden="true"></div>
    <div class="deck-hud">
      <span class="deck-count">${UI.slide} <b data-deck-current>01</b> / <span data-deck-total>${String(slides.length).padStart(2, "0")}</span></span>
      <span class="deck-hud-label" data-deck-label></span>
      <div class="deck-ticks" data-deck-ticks></div>
      <button class="deck-arrow" type="button" data-deck-prev aria-label="${esc(UI.prev)}">↑</button>
      <button class="deck-arrow" type="button" data-deck-next aria-label="${esc(UI.next)}">↓</button>
      <button class="deck-exit" type="button" data-deck-exit>${esc(UI.exit)}</button>
    </div>
    <div class="deck-hint"><i></i>${esc(UI.hint)}<span>${esc(UI.keys)}</span></div>
    <div class="deck-progress"><i data-deck-bar></i></div>`;
  document.body.appendChild(deck);

  const track = q("[data-deck-track]", deck);
  const canvas = q(".deck-fx", deck);
  const ctx = canvas.getContext("2d");
  const currentLabel = q("[data-deck-current]", deck);
  const labelNode = q("[data-deck-label]", deck);
  const bar = q("[data-deck-bar]", deck);
  const ticksHost = q("[data-deck-ticks]", deck);
  const flash = q(".deck-flash", deck);

  slides.forEach((slide, i) => {
    const section = document.createElement("section");
    section.className = `deck-slide deck-slide--${slide.id}`;
    section.setAttribute("aria-roledescription", "slide");
    section.setAttribute("aria-label", `${i + 1} / ${slides.length} — ${slide.label}`);
    section.dataset.index = String(i);
    section.innerHTML = slide.html();
    track.appendChild(section);
    slide.node = section;
    const tick = document.createElement("i");
    tick.dataset.tick = String(i);
    ticksHost.appendChild(tick);
  });

  const nodes = slides.map((s) => s.node);
  const ticks = qa("[data-tick]", deck);
  const sourceNodes = [q(".site-header"), q("#main"), q(".site-footer"), q("[data-video-modal]")].filter(Boolean);
  let index = 0;
  let animating = false;
  let teardownLoop = null;
  let raf = 0;
  let flashPower = 0;

  // --- the ambient world: one rAF, colours lerp toward the current slide ---
  const palette = {
    base: [...DARK.base], glow: [...DARK.glow], accent: [...DARK.accent],
  };
  let target = DARK;
  let cw = 0;
  let ch = 0;
  const motes = Array.from({ length: 68 }, (_, i) => ({
    x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8,
    vx: (Math.random() - 0.5) * 0.00006, vy: -0.00003 - Math.random() * 0.00009,
    phase: i * 0.7,
  }));

  const sizeCanvas = () => {
    if (!ctx) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    cw = window.innerWidth;
    ch = window.innerHeight;
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  sizeCanvas();

  const mix = (from, to, amount) => from.map((v, i) => v + (to[i] - v) * amount);
  const rgb = (v, alpha = 1) => `rgba(${v.map((n) => Math.round(n)).join(",")},${alpha})`;

  const paint = (time) => {
    if (!ctx || document.hidden) return;
    palette.base = mix(palette.base, target.base, 0.055);
    palette.glow = mix(palette.glow, target.glow, 0.055);
    palette.accent = mix(palette.accent, target.accent, 0.055);
    flashPower *= 0.94;

    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = rgb(palette.base);
    ctx.fillRect(0, 0, cw, ch);

    const key = ctx.createRadialGradient(cw * 0.72, ch * 0.08, 0, cw * 0.72, ch * 0.08, Math.max(cw, ch) * 0.95);
    key.addColorStop(0, rgb(palette.glow, 0.95));
    key.addColorStop(0.55, rgb(palette.glow, 0.24));
    key.addColorStop(1, rgb(palette.glow, 0));
    ctx.fillStyle = key;
    ctx.fillRect(0, 0, cw, ch);

    const fill = ctx.createRadialGradient(cw * 0.12, ch * 0.94, 0, cw * 0.12, ch * 0.94, Math.max(cw, ch) * 0.7);
    fill.addColorStop(0, rgb(palette.accent, 0.14));
    fill.addColorStop(1, rgb(palette.accent, 0));
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, cw, ch);

    // Slow light motes keep the frame alive even after the transition ends.
    for (const mote of motes) {
      mote.x += mote.vx * 16;
      mote.y += mote.vy * 16;
      if (mote.y < -0.02) { mote.y = 1.02; mote.x = Math.random(); }
      if (mote.x < -0.02) mote.x = 1.02;
      if (mote.x > 1.02) mote.x = -0.02;
      const pulse = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(time * 0.0016 + mote.phase));
      ctx.beginPath();
      ctx.arc(mote.x * cw, mote.y * ch, mote.r, 0, Math.PI * 2);
      ctx.fillStyle = rgb(palette.accent, 0.12 + pulse * 0.34);
      ctx.fill();
    }

    if (flashPower > 0.01) {
      const band = ctx.createLinearGradient(cw * (0.4 + flashPower), 0, cw * (0.7 + flashPower), ch);
      band.addColorStop(0, rgb(palette.accent, 0));
      band.addColorStop(0.5, rgb(palette.accent, 0.1 * flashPower));
      band.addColorStop(1, rgb(palette.accent, 0));
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, cw, ch);
    }
  };

  const loop = (time) => {
    paint(time);
    raf = requestAnimationFrame(loop);
  };

  // --- slide transitions: a different move for every single page turn ---
  const transitions = [
    (tl, out, incoming, dir) => { // 01 → 02: iris opening
      tl.fromTo(incoming, { clipPath: "circle(0% at 50% 55%)", scale: 1.12 },
        { clipPath: "circle(150% at 50% 55%)", scale: 1, duration: 0.95, ease: "power3.inOut" }, 0);
      tl.to(out, { scale: 0.92, opacity: 0, duration: 0.6, ease: "power2.in" }, 0);
    },
    (tl, out, incoming, dir) => { // 02 → 03: lateral conveyor
      tl.fromTo(incoming, { xPercent: 105 * dir, skewX: -7 * dir, opacity: 0.5 },
        { xPercent: 0, skewX: 0, opacity: 1, duration: 0.85, ease: "power4.out" }, 0);
      tl.to(out, { xPercent: -55 * dir, opacity: 0, duration: 0.7, ease: "power3.in" }, 0);
    },
    (tl, out, incoming, dir) => { // 03 → 04: vertical push
      tl.fromTo(incoming, { yPercent: 100 * dir, rotateX: -12 * dir },
        { yPercent: 0, rotateX: 0, duration: 0.9, ease: "power3.out" }, 0);
      tl.to(out, { yPercent: -70 * dir, opacity: 0.2, duration: 0.7, ease: "power2.in" }, 0);
    },
    (tl, out, incoming, dir) => { // 04 → 05: zoom bloom
      tl.fromTo(incoming, { scale: 0.68, opacity: 0, filter: "blur(14px)" },
        { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.95, ease: "power3.out" }, 0);
      tl.to(out, { scale: 1.5, opacity: 0, filter: "blur(10px)", duration: 0.7, ease: "power2.in" }, 0);
    },
    (tl, out, incoming, dir) => { // 05 → 06: curtain split
      tl.fromTo(incoming, { clipPath: "inset(0 50% 0 50%)", scale: 1.06 },
        { clipPath: "inset(0 0% 0 0%)", scale: 1, duration: 0.9, ease: "power4.inOut" }, 0);
      tl.to(out, { opacity: 0, y: -30 * dir, duration: 0.5, ease: "power2.in" }, 0.15);
    },
    (tl, out, incoming, dir) => { // 06 → 07: dissolve through light
      tl.fromTo(incoming, { opacity: 0, scale: 1.08, filter: "blur(18px)" },
        { opacity: 1, scale: 1, filter: "blur(0px)", duration: 1, ease: "power2.out" }, 0);
      tl.to(out, { opacity: 0, filter: "blur(12px)", duration: 0.6 }, 0);
    },
    (tl, out, incoming, dir) => { // 07 → 08: cube turn
      tl.fromTo(incoming, { rotationY: 85 * dir, transformOrigin: "right center", opacity: 0.4 },
        { rotationY: 0, opacity: 1, duration: 0.95, ease: "power3.out" }, 0);
      tl.to(out, { rotationY: -85 * dir, transformOrigin: "left center", opacity: 0, duration: 0.8, ease: "power3.in" }, 0);
    },
    (tl, out, incoming, dir) => { // 08 → 09: ripple from a corner
      tl.fromTo(incoming, { clipPath: "circle(0% at 12% 88%)", scale: 1.05 },
        { clipPath: "circle(150% at 12% 88%)", scale: 1, duration: 1, ease: "power3.inOut" }, 0);
      tl.to(out, { opacity: 0, scale: 0.94, duration: 0.55 }, 0);
    },
    (tl, out, incoming, dir) => { // 09 → 10: soft lift
      tl.fromTo(incoming, { y: 90 * dir, opacity: 0, scale: 0.96 },
        { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: "power3.out" }, 0);
      tl.to(out, { y: -60 * dir, opacity: 0, duration: 0.6, ease: "power2.in" }, 0);
    },
    (tl, out, incoming, dir) => { // 10 → 11: spiral in
      tl.fromTo(incoming, { scale: 1.35, rotate: 9 * dir, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1, duration: 1.05, ease: "power3.out" }, 0);
      tl.to(out, { scale: 0.65, rotate: -11 * dir, opacity: 0, duration: 0.75, ease: "power2.in" }, 0);
    },
    (tl, out, incoming, dir) => { // 11 → 01: full-circle rewind
      tl.fromTo(incoming, { xPercent: -60 * dir, opacity: 0, filter: "blur(10px)" },
        { xPercent: 0, opacity: 1, filter: "blur(0px)", duration: 1, ease: "power3.out" }, 0);
      tl.to(out, { xPercent: 60 * dir, opacity: 0, duration: 0.75, ease: "power2.in" }, 0);
    },
  ];

  const enter = (slide) => {
    const parts = qa("[data-k]", slide.node);
    if (parts.length) {
      gsap.fromTo(parts,
        { y: 26, opacity: 0, filter: "blur(7px)" },
        { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.72, stagger: 0.055, ease: "power3.out", delay: 0.1, overwrite: true }
      );
    }
    if (slide.onEnter) teardownLoop = slide.onEnter(slide.node) || null;
  };

  const syncHud = () => {
    currentLabel.textContent = String(index + 1).padStart(2, "0");
    labelNode.textContent = slides[index].label;
    bar.style.width = `${((index + 1) / slides.length) * 100}%`;
    ticks.forEach((tick, i) => {
      tick.classList.toggle("is-done", i < index);
      tick.classList.toggle("is-active", i === index);
    });
  };

  const goTo = (next, dirHint) => {
    if (animating || next === index || next < 0 || next >= slides.length) return;
    const dir = dirHint || (next > index ? 1 : -1);
    const out = slides[index];
    const incoming = slides[next];
    animating = true;

    if (typeof teardownLoop === "function") teardownLoop();
    teardownLoop = null;
    out.node.classList.remove("is-active");
    out.node.setAttribute("aria-hidden", "true");

    gsap.killTweensOf(out.node);
    gsap.killTweensOf(incoming.node);
    gsap.set(incoming.node, { visibility: "visible", opacity: 1, clearProps: "transform,clipPath,filter,x,y,xPercent,yPercent,rotate,rotationY,skewX,scale" });

    target = incoming.palette;
    flashPower = 1;
    gsap.fromTo(flash, { opacity: 0.5 }, { opacity: 0, duration: 0.75, ease: "power2.out" });

    const tl = gsap.timeline({
      defaults: { ease: "power3.inOut" },
      onComplete: () => {
        gsap.set(out.node, { visibility: "hidden", clearProps: "transform,clipPath,filter,x,y,xPercent,yPercent,rotate,rotationY,skewX,scale,opacity" });
        gsap.set(incoming.node, { clearProps: "transform,clipPath,filter,x,y,xPercent,yPercent,rotate,rotationY,skewX,scale,opacity" });
        index = next;
        incoming.node.classList.add("is-active");
        incoming.node.removeAttribute("aria-hidden");
        enter(incoming);
        syncHud();
        animating = false;
      },
    });
    transitions[next % transitions.length](tl, out.node, incoming.node, dir);
  };

  const step = (dir) => goTo((index + dir + slides.length) % slides.length, dir);

  // --- lifecycle ---
  const activate = () => {
    root.classList.add("deck-active");
    sourceNodes.forEach((node) => {
      node.setAttribute("aria-hidden", "true");
      if ("inert" in node) node.inert = true;
    });
    globalThis.__penguinLenis?.stop?.();
    slides[0].node.classList.add("is-active");
    slides.slice(1).forEach((s) => s.node.setAttribute("aria-hidden", "true"));
    syncHud();
    enter(slides[0]);
    raf = requestAnimationFrame(loop);
    window.addEventListener("resize", sizeCanvas);
  };

  const deactivate = () => {
    if (typeof teardownLoop === "function") teardownLoop();
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", sizeCanvas);
    slides.forEach((slide) => {
      gsap.killTweensOf(slide.node);
      gsap.set(slide.node, { clearProps: "all" });
    });
    sourceNodes.forEach((node) => {
      node.removeAttribute("aria-hidden");
      if ("inert" in node) node.inert = false;
    });
    root.classList.remove("deck-active");
    deck.remove();
    globalThis.__penguinLenis?.start?.();
    try { sessionStorage.setItem(OPTOUT, "1"); } catch (_) {}
  };

  // --- input: exactly one page per wheel gesture / swipe / key press ---
  let wheelAccum = 0;
  let wheelLock = 0;
  const onWheel = (event) => {
    if (event.ctrlKey || event.metaKey) return;
    const scrollable = event.target instanceof Element ? event.target.closest("[data-deck-scroll]") : null;
    if (scrollable && scrollable.scrollHeight > scrollable.clientHeight + 4) {
      const atTop = scrollable.scrollTop <= 0;
      const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;
      if (!((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom))) return;
    }
    event.preventDefault();
    const now = Date.now();
    if (now < wheelLock) return;
    wheelAccum += event.deltaY;
    if (Math.abs(wheelAccum) < 38) return;
    const dir = wheelAccum > 0 ? 1 : -1;
    wheelAccum = 0;
    wheelLock = now + 720;
    step(dir);
  };

  let touchStart = null;
  const onTouchStart = (event) => {
    if (event.touches.length !== 1) return;
    touchStart = { y: event.touches[0].clientY, x: event.touches[0].clientX, t: Date.now() };
  };
  const onTouchEnd = (event) => {
    if (!touchStart || !event.changedTouches.length) return;
    const dy = touchStart.y - event.changedTouches[0].clientY;
    const dx = touchStart.x - event.changedTouches[0].clientX;
    touchStart = null;
    if (Math.abs(dy) < 46 || Math.abs(dy) < Math.abs(dx) * 1.2) return;
    step(dy > 0 ? 1 : -1);
  };

  const onKey = (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const openDialog = q("dialog[open]");
    if (openDialog) return;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused.closest("details, .deck-faq")) return;
    switch (event.key) {
      case "ArrowDown": case "PageDown": case " ": event.preventDefault(); step(1); break;
      case "ArrowUp": case "PageUp": event.preventDefault(); step(-1); break;
      case "Home": event.preventDefault(); goTo(0, -1); break;
      case "End": event.preventDefault(); goTo(slides.length - 1, 1); break;
      case "Escape": event.preventDefault(); deactivate(); break;
      default: break;
    }
  };

  const HASH_SLIDE = {
    "#story": 1, "#how-it-works": 3, "#film": 5, "#features": 6,
    "#use-cases": 7, "#languages": 8, "#faq": 9,
  };
  const onClick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("[data-deck-exit]")) { deactivate(); return; }
    if (target.closest("[data-deck-prev]")) { step(-1); return; }
    if (target.closest("[data-deck-next]")) { step(1); return; }
    if (target.closest("[data-deck-film]")) { goTo(5, 1); return; }
    if (target.closest("[data-deck-open-film]")) {
      q("[data-video-open]")?.click();
      return;
    }
    const chapter = target.closest("[data-deck-chapter]");
    if (chapter) {
      const marks = [0, 4.8, 20.6];
      const video = q(".deck-film-video", slides[5].node);
      if (video && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(marks[Number(chapter.dataset.deckChapter) || 0], video.duration - 0.1);
        video.play().catch(() => {});
      }
      qa("[data-deck-chapter]", slides[5].node).forEach((c) =>
        c.classList.toggle("is-active", c === chapter)
      );
      return;
    }
    const anchor = target.closest("a[href]");
    if (anchor) {
      const hash = anchor.getAttribute("href") || "";
      if (Object.prototype.hasOwnProperty.call(HASH_SLIDE, hash)) {
        event.preventDefault();
        goTo(HASH_SLIDE[hash], HASH_SLIDE[hash] > index ? 1 : -1);
      } else if (hash.startsWith("#")) {
        event.preventDefault();
        deactivate();
        const destination = q(hash);
        destination?.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  document.addEventListener("wheel", onWheel, { passive: false });
  document.addEventListener("touchstart", onTouchStart, { passive: true });
  document.addEventListener("touchend", onTouchEnd, { passive: true });
  document.addEventListener("keydown", onKey);
  document.addEventListener("click", onClick);
  reduce.addEventListener?.("change", () => {
    if (reduce.matches && root.classList.contains("deck-active")) deactivate();
  });

  activate();
})();
