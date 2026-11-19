// Renders the static, crawlable landing pages and the XML sitemap.
// All visible copy comes from seo/content.mjs.

import { createHash } from "node:crypto";
import { readFileSync, statSync, readdirSync } from "node:fs";

import {
  HREFLANG_ALIASES,
  LOCALES,
  SITE,
} from "./content.mjs";
import {
  CONTENT_LOCALES,
  CONTENT_PAGES,
  contentLabel,
  contentPath,
  findContentPage,
} from "./pages.mjs";

// Static assets are served with a 1-hour cache by the CDN. Fingerprint their
// contents into the URL so a deploy always invalidates the browser cache —
// otherwise a fresh HTML page can pick up a stale landing.css and render
// unstyled (as happened on mobile after the 3D universe shipped).
function assetVersion(file) {
  try {
    return createHash("sha256")
      .update(readFileSync(new URL(`../public/${file}`, import.meta.url)))
      .digest("hex")
      .slice(0, 10);
  } catch {
    return "1";
  }
}

// The generated media (frames, reel, result loops, promos, posters) is
// overwritten in place by build scripts but served with a 1-hour CDN cache.
// Fingerprint the whole media tree (names + sizes + mtimes) so any regenerated
// asset changes the URL and browsers can never show stale footage.
function mediaVersion() {
  try {
    const root = new URL("../public/media/", import.meta.url);
    const hash = createHash("sha256");
    const walk = (dir) => {
      const entries = readdirSync(dir, { withFileTypes: true })
        .filter((e) => !e.name.startsWith("."))
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const e of entries) {
        const url = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
        if (e.isDirectory()) walk(url);
        else hash.update(`${e.name}:${statSync(url).size}:${Math.round(statSync(url).mtimeMs)};`);
      }
    };
    walk(root);
    return hash.digest("hex").slice(0, 10);
  } catch {
    return "1";
  }
}

const ASSET_VERSIONS = {
  css: assetVersion("landing.css"),
  js: assetVersion("landing.js"),
  story: assetVersion("landing-story.js"),
  media: mediaVersion(),
};

// Cache-bust a generated media URL.
const media = (url) => `/media/${url}?v=${ASSET_VERSIONS.media}`;

// Korean users spell the brand both ways; listing the aliases in schema.org
// tells search engines that 펭귄컷/팽귄컷 and PenguinCut are the same entity.
const BRAND_ALIASES = ["펭귄컷", "팽귄컷", "Penguin Cut"];

// Inline the penguin mark so the header can cross-fade its `color` between
// light and dark tones. As an <img> the SVG can't inherit the parent color and
// the old `filter: invert()` trick snapped through grey mid-transition.
const BRAND_MARK = readFileSync(
  new URL("../public/penguin-logo.svg", import.meta.url),
  "utf8"
)
  .trim()
  .replace(
    "<svg ",
    '<svg class="brand-mark" aria-hidden="true" focusable="false" '
  );

const ICONS = {
  sparkles: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 3.5l1.6 4.6 4.6 1.6-4.6 1.6L12 16l-1.6-4.7L5.8 9.7l4.6-1.6L12 3.5Z"/>
      <path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"/>
      <path d="M5 15l.5 1.4L7 17l-1.5.5L5 19l-.5-1.5L3 17l1.5-.6L5 15Z"/>
    </svg>`,
  captions: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="5" width="18" height="14" rx="3"/>
      <path d="M7 10h4M7 14h7M15 10h2"/>
    </svg>`,
  layers: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 3 3.5 7.5 12 12l8.5-4.5L12 3Z"/>
      <path d="m3.5 12 8.5 4.5 8.5-4.5"/>
      <path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>
    </svg>`,
  film: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="4" width="18" height="16" rx="2.5"/>
      <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>
    </svg>`,
  music: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M9 18V6l10-2v12"/>
      <circle cx="6.5" cy="18" r="2.5"/>
      <circle cx="16.5" cy="16" r="2.5"/>
    </svg>`,
  shield: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 3 5 6v5.5c0 4.4 2.9 7.7 7 9.5 4.1-1.8 7-5.1 7-9.5V6l-7-3Z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>`,
  globe: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9"/>
      <path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z"/>
    </svg>`,
  check: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="m5 12 4.2 4.2L19 6.8"/>
    </svg>`,
  arrow: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h13M13 6l6 6-6 6"/>
    </svg>`,
  play: `
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8.5 5.8c0-.9 1-1.4 1.7-.9l8.4 6.2c.6.4.6 1.4 0 1.8l-8.4 6.2c-.7.5-1.7 0-1.7-.9V5.8Z"/>
    </svg>`,
  sound: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/>
      <path d="M15 9.4a4 4 0 0 1 0 5.2"/>
      <path d="M17.8 6.8a8 8 0 0 1 0 10.4"/>
    </svg>`,
  muted: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/>
      <path d="m16 9.5 4 5M20 9.5l-4 5"/>
    </svg>`,
  chevron: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="m6 9 6 6 6-6"/>
    </svg>`,
  close: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6 6 18"/>
    </svg>`,
};

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function abs(path) {
  return new URL(path, SITE.origin).href;
}

// Land on the studio in the same language as the landing page the user was
// reading. The studio's `?lang=` param outranks localStorage/browser locale,
// so even English must be passed explicitly — otherwise a Korean browser
// arriving from the English landing page gets a Korean studio (and vice versa).
function appHref(locale) {
  return `${SITE.appPath}?lang=${locale.code}`;
}

// Content pages exist in English and Korean. Other locales link to the English
// canonical instead of shipping a machine-translated legal document.
function contentHref(locale, slug) {
  return locale.code === "ko" ? `/ko/${slug}/` : `/${slug}/`;
}

// Prefix in-page anchors with the landing path so the same header/footer work
// on content pages, where "#features" alone would point at the current page.
function hashHref(basePath, hash) {
  return `${basePath}${hash}`;
}

function renderAlternates() {
  const tags = [];

  for (const locale of LOCALES) {
    for (const hreflang of HREFLANG_ALIASES[locale.code] || [locale.hreflang]) {
      tags.push(
        `<link rel="alternate" hreflang="${esc(hreflang)}" href="${esc(abs(locale.path))}">`
      );
    }
  }

  tags.push(
    `<link rel="alternate" hreflang="x-default" href="${esc(abs("/"))}">`
  );

  return tags.join("\n    ");
}

function renderOgAlternates(currentLocale) {
  return LOCALES.filter((locale) => locale.code !== currentLocale.code)
    .map(
      (locale) =>
        `<meta property="og:locale:alternate" content="${esc(locale.ogLocale)}">`
    )
    .join("\n    ");
}

function renderLanguageLinks(currentLocale, className = "", withHreflang = true) {
  return LOCALES.map((locale) => {
    const current = locale.code === currentLocale.code;
    return `<a class="${className}" href="${esc(locale.path)}"${
      withHreflang ? ` hreflang="${esc(locale.hreflang)}"` : ""
    } lang="${esc(locale.htmlLang)}"${current ? ' aria-current="page"' : ""}>${esc(
      locale.nativeLabel
    )}</a>`;
  }).join("\n            ");
}

function renderHeader(locale, basePath = "", withHreflangOnSwitcher = true) {
  return `
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="${esc(locale.path)}" aria-label="PenguinCut">
        ${BRAND_MARK}
        <span>PenguinCut</span>
      </a>

      <button class="nav-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>
        <span></span><span></span><span></span>
      </button>

      <nav class="site-nav" id="site-nav" aria-label="Main navigation" data-nav>
        <a href="${esc(hashHref(basePath, "#features"))}">${esc(
    locale.nav.features
  )}</a>
        <a href="${esc(hashHref(basePath, "#how-it-works"))}">${esc(
    locale.nav.how
  )}</a>
        <a href="${esc(hashHref(basePath, "#use-cases"))}">${esc(
    locale.nav.useCases
  )}</a>
        <a href="${esc(hashHref(basePath, "#languages"))}">${esc(
    locale.nav.languages
  )}</a>
        <a href="${esc(hashHref(basePath, "#faq"))}">${esc(
    locale.nav.faq
  )}</a>

        <details class="lang-switcher">
          <summary>
            ${ICONS.globe}
            <span>${esc(locale.nativeLabel)}</span>
            ${ICONS.chevron}
          </summary>
          <div class="lang-panel">
            ${renderLanguageLinks(locale, "", withHreflangOnSwitcher)}
          </div>
        </details>

        <a class="button button-small" href="${esc(appHref(locale))}">${esc(
    locale.nav.open
  )}</a>
      </nav>
    </div>
  </header>`;
}

function renderHero(locale) {
  const { hero } = locale;
  return `
    <section class="hero" data-header-tone="dark" aria-labelledby="hero-title">
      <div class="hero-bg" aria-hidden="true">
        <video class="hero-bg-video" data-hero-bg muted loop playsinline autoplay preload="metadata" poster="${media("hero-poster.webp")}" width="1280" height="532" tabindex="-1">
          <source src="${media("hero-nature.mp4")}" type="video/mp4">
        </video>
        <div class="hero-bg-scrim"></div>
      </div>

      <div class="hero-viewfinder" aria-hidden="true">
        <span class="vf vf-tl"></span>
        <span class="vf vf-tr"></span>
        <span class="vf vf-bl"></span>
        <span class="vf vf-br"></span>
      </div>

      <div class="container hero-inner">
        <p class="eyebrow hero-eyebrow"><span class="eyebrow-dot"></span>${esc(
          hero.badge
        )}</p>
        <h1 id="hero-title">${hero.title}<span class="accent">${hero.accent}</span></h1>
        <p class="hero-lead">${esc(hero.lead)}</p>

        <div class="hero-actions">
          <a class="button button-hero-primary" href="${esc(appHref(locale))}">
            ${esc(hero.primary)}
            ${ICONS.arrow}
          </a>
          <a class="button button-hero-ghost" href="#how-it-works">${esc(
            hero.secondary
          )}</a>
        </div>

        <ul class="trust-list hero-trust">
          ${hero.trust
            .map(
              (item) =>
                `<li>${ICONS.check}<span>${esc(item)}</span></li>`
            )
            .join("\n            ")}
        </ul>
      </div>

      <div class="hero-foot">
        <button class="hero-sound" type="button" data-video-open aria-label="${esc(
          locale.video.label
        )}">
          <span class="hero-sound-icon" aria-hidden="true">${ICONS.sound}</span>
          <span class="hero-sound-label">${esc(locale.video.soundCue)}</span>
        </button>
        <a class="hero-scroll" href="#how-it-works" aria-label="${esc(
          hero.secondary
        )}">${ICONS.chevron}</a>
        <span class="hero-foot-note">00:36 · 16:9 &amp; 9:16</span>
      </div>
    </section>`;
}

function renderFilmModal(locale) {
  return `
  <dialog class="film-modal" data-video-modal aria-labelledby="film-title">
    <div class="film-card">
      <div class="film-head">
        <p class="film-eyebrow">PenguinCut · 00:36</p>
        <h2 id="film-title">${esc(locale.video.title)}</h2>
        <button class="film-close" type="button" data-video-close aria-label="${esc(
          locale.video.close
        )}">
          ${ICONS.close}
        </button>
      </div>
      <video class="film-video" data-video-player data-video-src="${media(`promo-${esc(
        locale.code
      )}.mp4`)}" controls playsinline preload="none" poster="${media("hero-poster.webp")}" width="1280" height="720"></video>
    </div>
  </dialog>`;
}

function renderStrip(locale) {
  return `
    <section class="trust-strip" data-header-tone="dark" aria-label="${esc(locale.hero.badge)}">
      <div class="container trust-strip-inner">
        ${locale.strip
          .map((item) => `<span>${esc(item)}</span>`)
          .join("\n        ")}
      </div>
    </section>`;
}

function renderTheater(locale) {
  const { theater } = locale;
  const chapterTimes = [0, 4.8, 20.6];

  return `
    <section class="theater" id="film" data-header-tone="dark" aria-labelledby="theater-title">
      <div class="container">
        <div class="theater-head">
          <p class="eyebrow"><span class="eyebrow-dot"></span>${esc(
            theater.eyebrow
          )}</p>
          <h2 id="theater-title">${esc(theater.title)}</h2>
          <p class="section-lead">${esc(theater.lead)}</p>
        </div>

        <div class="theater-frame" data-theater>
          <div class="theater-stage">
            <video class="theater-video" data-theater-video data-ambient muted loop playsinline preload="none" poster="${media(`result-${esc(
              locale.code
            )}.webp`)}" aria-label="${esc(
    locale.video.label
  )}" width="1280" height="720">
              <source src="${media(`promo-${esc(
                locale.code
              )}.mp4`)}" type="video/mp4">
            </video>

            <button class="theater-play" type="button" data-theater-play aria-label="${esc(
              locale.video.play
            )}" hidden>
              ${ICONS.play}
            </button>
          </div>

          <div class="theater-bar">
            <div class="theater-chapters" role="group" aria-label="${esc(
              locale.video.title
            )}">
              ${theater.chapters
                .map(
                  (label, index) => `
              <button class="theater-chapter" type="button" data-theater-chapter data-time="${chapterTimes[index]}">
                <span class="theater-chapter-index">0${index + 1}</span>
                <span class="theater-chapter-label">${esc(label)}</span>
              </button>`
                )
                .join("")}
            </div>

            <div class="theater-meta">
              <span class="theater-runtime" aria-hidden="true">00:36 · 16:9 &amp; 9:16</span>
              <button class="theater-sound" type="button" data-theater-sound aria-pressed="false">
                <span class="sound-icon" aria-hidden="true">
                  <span class="icon-muted">${ICONS.muted}</span>
                  <span class="icon-sound">${ICONS.sound}</span>
                </span>
                <span data-theater-sound-label>${esc(
                  locale.video.soundOn
                )}</span>
                <span class="theater-sound-label-on">${esc(
                  locale.video.soundOff
                )}</span>
              </button>
            </div>

            <div class="theater-progress" aria-hidden="true"><i data-theater-progress></i></div>
          </div>
        </div>
      </div>
    </section>`;
}

// The scroll story is decorative. It owns no document headings, every image
// carries a localized alt, and all crawlable feature/how copy lives in the
// visible light sections below the theater. `data-story` sits on the stage so
// scroll progress maps to the 440svh scroll distance, not the whole page.
function renderStory(locale) {
  const { reel, features, how, theater, video, stack, alts } = locale;
  const two = (n) => String(n).padStart(2, "0");

  const captureChips = stack.layers
    .map(
      (label, i) =>
        `<span class="story-chip" data-chip="${i}"><i>${two(i + 1)}</i><b>${esc(
          label
        )}</b></span>`
    )
    .join("");

  const thumbnails = stack.layers
    .map(
      (label, i) =>
        `<span class="story-thumb" data-thumb="${i}"><img src="${media(
          `reel/reel-0${i + 1}.webp`
        )}" alt="${esc(alts.reel)} ${two(i + 1)}" loading="lazy" width="160" height="90"><i>${two(
          i + 1
        )}</i></span>`
    )
    .join("");

  const featureRows = features.items
    .map(
      (item, index) => `
        <li><button class="story-ui-row" type="button" tabindex="-1" data-ui-jump="${index}" data-ui-row="${index}">
          <span class="br-num">0${index + 1}</span>
          <b>${esc(item.title)}</b>
          <small>${esc(stack.layers[index] || "")}</small>
        </button></li>`
    )
    .join("");

  // Mobile Act 2: compact "current feature" copy + six tappable dot tabs.
  const uiDots = features.items
    .map(
      (item, index) =>
        `<button class="story-ui-dot" type="button" tabindex="-1" data-ui-jump="${index}" data-ui-dot="${index}" data-title="${esc(item.title)}" data-desc="${esc(item.desc)}" aria-label="${esc(item.title)}">${two(index + 1)}</button>`
    )
    .join("");

  // Act 3 visual: raw clips → AI scan → one condensed 00:36 timeline.
  const timelineClips = [
    ["CLIP 01", "42m"],
    ["CLIP 02", "58m"],
    ["CLIP 03", "38m"],
  ]
    .map(
      ([label, length], index) =>
        `<div class="story-clip story-clip--${index + 1}"><b>${label}</b><small>${length}</small></div>`
    )
    .join("");

  const timelinePeaks = stack.layers
    .map((_, index) => `<i class="story-peak" data-peak="${index}"></i>`)
    .join("");

  const finalStrips = stack.layers
    .map(
      (_, index) =>
        `<span class="story-final-strip"><img src="${media(
          `reel/reel-0${index + 1}.webp`
        )}" alt="${esc(alts.reel)} ${two(index + 1)}" loading="lazy" width="80" height="45"></span>`
    )
    .join("");

  const stepRows = how.steps
    .map(
      (step, index) => `
        <li class="story-step-row" data-story-step="${index}">
          <span class="br-num">0${index + 1}</span>
          <b>${esc(step.title)}</b>
          <p>${esc(step.desc)}</p>
        </li>`
    )
    .join("");

  return `
  <section class="story" id="story" data-header-tone="dark" aria-label="${esc(
    reel.title
  )}">
    <!-- Presentational stage: canvas frame scrubbing + real product UI -->
    <div class="story-stage" data-story aria-hidden="true">
      <div class="story-sticky">
        <canvas class="story-canvas" data-story-canvas></canvas>
        <div class="story-stage-scrim"></div>

        <div class="story-thumbs">${thumbnails}</div>

        <div class="story-act story-act--capture is-active" data-story-act="0">
          <div class="story-copy">
            <p class="story-eyebrow">${esc(reel.eyebrow)}</p>
            <p class="story-stage-title">${esc(reel.title)}</p>
            <p class="story-lead">${esc(reel.lead)}</p>
            <div class="story-captures">${captureChips}</div>
            <p class="story-lock" data-story-lock>${esc(reel.captured)}</p>
          </div>
          <p class="story-counter"><span data-story-counter>01</span> / 06</p>
        </div>

        <div class="story-act story-act--ui" data-story-act="1">
          <div class="story-ui-frame">
            <div class="story-ui-bar"><i></i><i></i><i></i><span> PenguinCut Studio</span></div>
            <div class="story-ui-screen">
              <img class="story-ui-img is-front" data-ui-front src="${media(
                "ui/ui-01.webp"
              )}" alt="${esc(alts.ui)}" width="960" height="574">
              <img class="story-ui-img" data-ui-back alt="${esc(
                alts.ui
              )}" width="960" height="574">
            </div>
          </div>
          <div class="story-ui-copy">
            <p class="story-eyebrow">${esc(features.eyebrow)}</p>
            <p class="story-stage-title">${esc(features.title)}</p>
            <ol class="story-ui-list">${featureRows}</ol>
          </div>
          <div class="story-ui-mobile-copy">
            <p class="story-eyebrow">${esc(features.eyebrow)}</p>
            <p class="story-ui-title" data-ui-title>${esc(
              features.items[0].title
            )}</p>
            <p data-ui-desc>${esc(features.items[0].desc)}</p>
            <div class="story-ui-dots">${uiDots}</div>
          </div>
        </div>

        <div class="story-act story-act--steps" data-story-act="2">
          <div class="story-timeline" data-timeline data-state="raw">
            <div class="story-timeline-head">
              <span>RAW FOOTAGE</span>
              <b data-timeline-label>3 CLIPS · 02:18:40</b>
            </div>
            <div class="story-clips">
              ${timelineClips}
              <i class="story-scanline"></i>
              ${timelinePeaks}
            </div>
            <div class="story-timeline-final">
              <div class="story-final-strips">${finalStrips}</div>
              <span>00:36 · 16:9 &amp; 9:16</span>
            </div>
          </div>
          <div class="story-steps-copy">
            <p class="story-eyebrow">${esc(how.eyebrow)}</p>
            <p class="story-stage-title">${esc(how.title)}</p>
            <p class="story-lead">${esc(how.lead)}</p>
            <div class="story-playhead"><i data-story-playhead></i></div>
          </div>
          <ol class="story-steps">${stepRows}</ol>
        </div>

        <div class="story-act story-act--format" data-story-act="3">
          <div class="story-format-copy">
            <p class="story-eyebrow">FINAL FORMAT</p>
            <p class="story-stage-title">${esc(theater.title)}</p>
            <a class="button story-format-button" href="#film" tabindex="-1">${esc(
              video.play
            )} ${ICONS.arrow}</a>
          </div>
          <div class="story-formats">
            <figure class="story-format story-format--wide">
              <img src="${media(
                `result-${esc(locale.code)}.webp`
              )}" alt="${esc(alts.result)}" width="960" height="540">
              <figcaption><b>16:9</b><span>YOUTUBE</span></figcaption>
            </figure>
            <figure class="story-format story-format--tall">
              <img src="${media(
                `result-v-${esc(locale.code)}.webp`
              )}" alt="${esc(alts.resultVertical)}" width="720" height="1280">
              <figcaption><b>9:16</b><span>SHORTS</span></figcaption>
            </figure>
          </div>
        </div>

        <div class="story-hud">
          <span data-story-act-label>01 / 04</span>
          <span class="story-hud-bar"><i data-story-bar></i></span>
          <span data-story-tc>00:00:00</span>
        </div>
        <span class="story-cue" data-story-cue>SCROLL</span>
        <span class="story-corner story-corner--tl"></span>
        <span class="story-corner story-corner--tr"></span>
        <span class="story-corner story-corner--bl"></span>
        <span class="story-corner story-corner--br"></span>
      </div>
    </div>
  </section>`;
}

// Crawlable feature copy: normal light section, always visible, no scroll
// dependency and no clipped wrapper.
function renderFeatures(locale) {
  const { features } = locale;
  return `
    <section class="section" id="features" aria-labelledby="features-title">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow"><span class="eyebrow-dot"></span>${esc(
            features.eyebrow
          )}</p>
          <h2 id="features-title">${esc(features.title)}</h2>
          <p class="section-lead">${esc(features.lead)}</p>
        </div>
        <div class="feature-grid">
          ${features.items
            .map(
              (item) => `
          <article class="feature-card">
            <div class="feature-icon">${ICONS[item.icon] || ICONS.sparkles}</div>
            <h3>${esc(item.title)}</h3>
            <p>${esc(item.desc)}</p>
          </article>`
            )
            .join("")}
        </div>
      </div>
    </section>`;
}

function renderHowItWorks(locale) {
  const { how } = locale;
  return `
    <section class="section section-alt" id="how-it-works" aria-labelledby="how-title">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow"><span class="eyebrow-dot"></span>${esc(
            how.eyebrow
          )}</p>
          <h2 id="how-title">${esc(how.title)}</h2>
          <p class="section-lead">${esc(how.lead)}</p>
        </div>
        <div class="step-grid">
          ${how.steps
            .map(
              (step, index) => `
          <article class="step-card">
            <span class="step-number">0${index + 1}</span>
            <h3>${esc(step.title)}</h3>
            <p>${esc(step.desc)}</p>
          </article>`
            )
            .join("")}
        </div>
        <p class="section-note">${esc(how.note)}</p>
      </div>
    </section>`;
}
function renderUseCases(locale) {
  const { useCases } = locale;
  return `
    <section class="section" id="use-cases" aria-labelledby="use-cases-title">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow">${esc(useCases.eyebrow)}</p>
          <h2 id="use-cases-title">${esc(useCases.title)}</h2>
          <p class="section-lead">${esc(useCases.lead)}</p>
        </div>

        <div class="use-case-grid">
          ${useCases.items
            .map(
              (item, index) => `
          <article class="use-case-card">
            <span class="use-case-index">0${index + 1}</span>
            <h3>${esc(item.title)}</h3>
            <p>${esc(item.desc)}</p>
          </article>`
            )
            .join("")}
        </div>
      </div>
    </section>`;
}

function renderLanguages(locale) {
  const { languages } = locale;
  return `
    <section class="section section-alt" id="languages" aria-labelledby="languages-title">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow">${esc(languages.eyebrow)}</p>
          <h2 id="languages-title">${esc(languages.title)}</h2>
          <p class="section-lead">${esc(languages.lead)}</p>
        </div>

        <div class="language-grid">
          ${LOCALES.map((item) => {
            const current = item.code === locale.code;
            return `
          <a class="language-card" href="${esc(item.path)}" hreflang="${esc(
              item.hreflang
            )}" lang="${esc(item.htmlLang)}"${current ? ' aria-current="page"' : ""}>
            <span class="language-native">${esc(item.nativeLabel)}</span>
            <span class="language-label">${esc(item.label)}</span>
            <span class="language-arrow">${ICONS.arrow}</span>
          </a>`;
          }).join("")}
        </div>
      </div>
    </section>`;
}

function renderFaq(locale) {
  const { faq } = locale;
  return `
    <section class="section" id="faq" aria-labelledby="faq-title">
      <div class="container faq-layout">
        <div class="section-head faq-head">
          <p class="eyebrow">${esc(faq.eyebrow)}</p>
          <h2 id="faq-title">${esc(faq.title)}</h2>
          <p class="section-lead">${esc(faq.lead)}</p>
        </div>

        <div class="faq-list">
          ${faq.items
            .map(
              (item, index) => `
          <details class="faq-item"${index === 0 ? " open" : ""}>
            <summary>
              <span>${esc(item.q)}</span>
              <span class="faq-icon" aria-hidden="true"></span>
            </summary>
            <p>${esc(item.a)}</p>
          </details>`
            )
            .join("")}
        </div>
      </div>
    </section>`;
}

function renderCta(locale) {
  const { cta } = locale;
  return `
    <section class="cta-section" aria-labelledby="cta-title">
      <div class="container">
        <div class="cta-panel">
          <video class="cta-video" muted loop playsinline preload="none" poster="${media("cta-poster.webp")}" data-cta-loop aria-hidden="true" tabindex="-1">
            <source src="${media("cta-reel.mp4")}" type="video/mp4">
          </video>
          <div class="cta-scrim" aria-hidden="true"></div>
          <div class="cta-glow"></div>
          <p class="eyebrow">${esc(locale.hero.badge)}</p>
          <h2 id="cta-title">${esc(cta.title)}</h2>
          <p class="cta-lead">${esc(cta.lead)}</p>
          <a class="button button-large" href="${esc(appHref(locale))}">
            ${esc(cta.button)}
            ${ICONS.arrow}
          </a>
          <p class="cta-note">${esc(cta.note)}</p>
        </div>
      </div>
    </section>`;
}

function renderFooter(
  locale,
  basePath = "",
  withHreflangOnSwitcher = true
) {
  const year = new Date().getFullYear();
  const social = (SITE.social || [])
    .map(
      (item) =>
        `<a href="${esc(item.href)}" rel="me noopener" target="_blank">${esc(
          item.label
        )}</a>`
    )
    .join("\n          ");
  const guides = [
    ["use-cases/youtube-highlights", locale.footer.guideYoutube],
    ["use-cases/travel-vlog-highlights", locale.footer.guideTravel],
    ["use-cases/sports-highlights", locale.footer.guideSports],
  ]
    .map(
      ([slug, label]) =>
        `<a href="${esc(contentHref(locale, slug))}">${esc(label)}</a>`
    )
    .join("\n        ");

  return `
  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a class="brand" href="${esc(locale.path)}" aria-label="PenguinCut">
          ${BRAND_MARK}
          <span>PenguinCut</span>
        </a>
        <p>${esc(locale.footer.tagline)}</p>
        <div class="footer-social" aria-label="PenguinCut on social platforms">
          ${social}
        </div>
      </div>

      <nav class="footer-col" aria-labelledby="footer-product">
        <h2 id="footer-product">${esc(locale.footer.product)}</h2>
        <a href="${esc(appHref(locale))}">${esc(locale.nav.open)}</a>
        <a href="${esc(hashHref(basePath, "#features"))}">${esc(
    locale.nav.features
  )}</a>
        <a href="${esc(hashHref(basePath, "#how-it-works"))}">${esc(
    locale.nav.how
  )}</a>
        <a href="${esc(hashHref(basePath, "#faq"))}">${esc(
    locale.nav.faq
  )}</a>
      </nav>

      <nav class="footer-col" aria-labelledby="footer-resources">
        <h2 id="footer-resources">${esc(locale.footer.resources)}</h2>
        <a href="${esc(contentHref(locale, "about"))}">${esc(
    locale.footer.about
  )}</a>
        <a href="${esc(contentHref(locale, "blog/introducing-penguincut"))}">${esc(
    locale.footer.blog
  )}</a>
        ${guides}
      </nav>

      <nav class="footer-col" aria-labelledby="footer-languages">
        <h2 id="footer-languages">${esc(locale.footer.language)}</h2>
        ${renderLanguageLinks(locale, "", withHreflangOnSwitcher)}
      </nav>
    </div>

    <div class="container footer-bottom">
      <span>${esc(locale.footer.legal.replace("{year}", String(year)))}</span>
      <span class="footer-legal-links">
        <a href="${esc(contentHref(locale, "privacy"))}">${esc(
    locale.footer.privacy
  )}</a>
        <a href="${esc(contentHref(locale, "terms"))}">${esc(
    locale.footer.terms
  )}</a>
        <a href="/sitemap.xml">Sitemap</a>
      </span>
    </div>
  </footer>`;
}

function buildSchema(locale) {
  const canonical = abs(locale.path);
  const allLanguages = LOCALES.map((item) => item.hreflang);
  const organizationId = `${SITE.origin}/#organization`;
  const websiteId = `${SITE.origin}/#website`;
  const appId = `${SITE.origin}/#app`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: SITE.brand,
        alternateName: BRAND_ALIASES,
        url: `${SITE.origin}/`,
        logo: {
          "@type": "ImageObject",
          url: abs("/icon-512x512.png"),
          width: 512,
          height: 512,
        },
        description: locale.description,
        ...(SITE.sameAs?.length ? { sameAs: SITE.sameAs } : {}),
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: `${SITE.origin}/`,
        name: SITE.brand,
        alternateName: BRAND_ALIASES,
        inLanguage: allLanguages,
        publisher: { "@id": organizationId },
      },
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: locale.title,
        description: locale.description,
        inLanguage: locale.hreflang,
        isPartOf: { "@id": websiteId },
        about: { "@id": appId },
        dateModified: SITE.contentUpdated,
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: abs(SITE.ogImage),
          width: 1200,
          height: 630,
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": appId,
        name: SITE.brand,
        alternateName: BRAND_ALIASES,
        url: abs(SITE.appPath),
        applicationCategory: "MultimediaApplication",
        applicationSubCategory: "Video Editor",
        operatingSystem: "Web",
        browserRequirements: "Requires JavaScript. Requires HTML5.",
        description: locale.description,
        inLanguage: allLanguages,
        featureList: locale.features.items.map((item) => item.title),
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        publisher: { "@id": organizationId },
        image: abs(SITE.ogImage),
      },
      {
        "@type": "VideoObject",
        "@id": `${canonical}#video`,
        name: locale.video.title,
        description: locale.theater.lead,
        thumbnailUrl: [abs("/media/hero-poster.webp")],
        uploadDate: "2026-11-16",
        duration: "PT36S",
        contentUrl: abs(`/media/promo-${locale.code}.mp4`),
        inLanguage: locale.hreflang,
        isPartOf: { "@id": `${canonical}#webpage` },
        publisher: { "@id": organizationId },
      },
      {
        "@type": "FAQPage",
        "@id": `${canonical}#faq`,
        mainEntity: locale.faq.items.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  };
}

function renderHead(locale) {
  const canonical = abs(locale.path);
  const schema = JSON.stringify(buildSchema(locale)).replaceAll(
    "<",
    "\\u003c"
  );
  // Keep the same landing→studio language handoff on legacy hash redirects
  // (e.g. /#projects) as on the CTA buttons above.
  const redirectHash = `?lang=${locale.code}`;

  // Only the tokens that are filled in get rendered, so the generated pages
  // never ship empty verification tags or leftover blank lines.
  const verification = [
    SITE.verification?.google &&
      `<meta name="google-site-verification" content="${esc(SITE.verification.google)}">`,
    SITE.verification?.naver &&
      `<meta name="naver-site-verification" content="${esc(SITE.verification.naver)}">`,
    SITE.verification?.bing &&
      `<meta name="msvalidate.01" content="${esc(SITE.verification.bing)}">`,
  ].filter(Boolean);

  return `
  <title>${esc(locale.title)}</title>
  <meta name="description" content="${esc(locale.description)}">
  <meta name="keywords" content="${esc(locale.keywords)}">
  <meta name="author" content="PenguinCut">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <link rel="canonical" href="${esc(canonical)}">

  ${renderAlternates()}

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="PenguinCut">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:title" content="${esc(locale.title)}">
  <meta property="og:description" content="${esc(locale.description)}">
  <meta property="og:image" content="${esc(abs(SITE.ogImage))}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(
    locale.ogImageAlt || SITE.ogImageAlt
  )}">
  <meta property="og:locale" content="${esc(locale.ogLocale)}">
  ${renderOgAlternates(locale)}

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(locale.title)}">
  <meta name="twitter:description" content="${esc(locale.description)}">
  <meta name="twitter:image" content="${esc(abs(SITE.ogImage))}">
  <meta name="twitter:image:alt" content="${esc(
    locale.ogImageAlt || SITE.ogImageAlt
  )}">

  <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=4">
  <link rel="icon" type="image/x-icon" href="/favicon.ico?v=4">
  <link rel="icon" type="image/png" sizes="48x48" href="/icon-48x48.png?v=4">
  <link rel="icon" type="image/png" sizes="96x96" href="/icon-96x96.png?v=4">
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png?v=4">
  <link rel="apple-touch-icon" href="/icon-192x192.png?v=4">
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="theme-color" content="#f8f9fa">
  <meta name="application-name" content="PenguinCut">
  <meta name="apple-mobile-web-app-title" content="PenguinCut">
  <meta name="format-detection" content="telephone=no">
${verification.length ? `${verification.map((tag) => `  ${tag}\n`).join("")}\n` : ""}
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="preload" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"></noscript>
  <link rel="stylesheet" href="/landing.css?v=${ASSET_VERSIONS.css}">

  <script>
    // Expose the generated-media fingerprint so JS-built media URLs
    // (scrub frames, studio stills, orientation-swapped posters) can carry
    // the same cache-buster as the static markup.
    window.__PENGUIN_MEDIA_V = "${ASSET_VERSIONS.media}";
    // Opt into the scroll story before first paint so the semantic fallback
    // and the sticky stage never swap after layout (zero layout shift).
    try {
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches && innerHeight > 540) {
        document.documentElement.classList.add("has-motion-stage");
      }
    } catch (_) {}
    // Paint the dark hero bar before first paint so a reload at the top never
    // flashes a white strip over the video. landing.js takes over on load,
    // including tone detection for reloads further down the page.
    try {
      if (scrollY < 24) {
        document.documentElement.classList.add("is-hero-top");
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#05080f");
      }
    } catch (_) {}
    // Preserve old app links such as /#projects when the marketing page takes over /.
    (function () {
      var hash = location.hash.toLowerCase();
      if (hash === "#projects" || hash === "#studio" || hash === "#community") {
        location.replace("${SITE.appPath}${redirectHash}" + hash);
      }
    })();
  </script>

  <script type="application/ld+json">${schema}</script>`;
}

export function renderPage(locale) {
  return `<!doctype html>
<html lang="${esc(locale.htmlLang)}" dir="ltr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${renderHead(locale)}
  </head>
  <body>
    ${renderHeader(locale)}
    <main id="main">
      ${renderHero(locale)}
      ${renderStrip(locale)}
      ${renderStory(locale)}
      ${renderTheater(locale)}
      ${renderFeatures(locale)}
      ${renderHowItWorks(locale)}
      ${renderUseCases(locale)}
      ${renderLanguages(locale)}
      ${renderFaq(locale)}
      ${renderCta(locale)}
    </main>
    ${renderFooter(locale)}
    ${renderFilmModal(locale)}
    <script src="/vendor/lenis.min.js" defer></script>
    <script src="/landing-story.js?v=${ASSET_VERSIONS.story}" defer></script>
    <script src="/landing.js?v=${ASSET_VERSIONS.js}" defer></script>
  </body>
</html>
`;
}

export function renderContentPage(locale, page, doc) {
  const canonical = abs(contentPath(page, locale.code));
  const schema = JSON.stringify(buildContentSchema(locale, page, doc, canonical)).replaceAll(
    "<",
    "\\u003c"
  );
  const isArticle = page.kind === "article";
  const ogType = isArticle ? "article" : "website";
  const alternates = CONTENT_LOCALES.map(
    (code) =>
      `<link rel="alternate" hreflang="${esc(
        code === "ko" ? "ko" : "en"
      )}" href="${esc(abs(contentPath(page, code)))}">`
  )
    .concat(
      `<link rel="alternate" hreflang="x-default" href="${esc(
        abs(contentPath(page, "en"))
      )}">`
    )
    .join("\n    ");
  const updatedLabel = locale.code === "ko" ? "최종 업데이트" : "Last updated";

  const sections = doc.sections
    .map(
      (section) => `
        <section class="content-section">
          <h2>${esc(section.heading)}</h2>
          ${(section.paragraphs || [])
            .map((paragraph) => `<p>${esc(paragraph)}</p>`)
            .join("\n          ")}
          ${
            section.bullets?.length
              ? `<ul>
            ${section.bullets
              .map((bullet) => `<li>${esc(bullet)}</li>`)
              .join("\n            ")}
          </ul>`
              : ""
          }
          ${
            section.note
              ? `<p class="content-note">${esc(section.note)}</p>`
              : ""
          }
        </section>`
    )
    .join("");

  const related = (page.en.related || [])
    .map((slug) => {
      const target = findContentPage(slug);
      if (!target) return "";
      return `<a href="${esc(contentHref(locale, target.slug))}">${esc(
        contentLabel(target, locale.code)
      )}</a>`;
    })
    .filter(Boolean)
    .join("\n          ");

  return `<!doctype html>
<html lang="${esc(locale.htmlLang)}" dir="ltr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(doc.title)}</title>
    <meta name="description" content="${esc(doc.description)}">
    <meta name="author" content="PenguinCut">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
    <link rel="canonical" href="${esc(canonical)}">

    ${alternates}

    <meta property="og:type" content="${ogType}">
    <meta property="og:site_name" content="PenguinCut">
    <meta property="og:url" content="${esc(canonical)}">
    <meta property="og:title" content="${esc(doc.title)}">
    <meta property="og:description" content="${esc(doc.description)}">
    <meta property="og:image" content="${esc(abs(SITE.ogImage))}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${esc(
      locale.ogImageAlt || SITE.ogImageAlt
    )}">
    <meta property="og:locale" content="${esc(locale.ogLocale)}">
    ${CONTENT_LOCALES.filter((code) => code !== locale.code)
      .map(
        (code) =>
          `<meta property="og:locale:alternate" content="${
            code === "ko" ? "ko_KR" : "en_US"
          }">`
      )
      .join("\n    ")}
    ${articleMeta(locale, isArticle, doc)}

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(doc.title)}">
    <meta name="twitter:description" content="${esc(doc.description)}">
    <meta name="twitter:image" content="${esc(abs(SITE.ogImage))}">
    <meta name="twitter:image:alt" content="${esc(
      locale.ogImageAlt || SITE.ogImageAlt
    )}">

    <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=4">
    <link rel="icon" type="image/x-icon" href="/favicon.ico?v=4">
    <link rel="apple-touch-icon" href="/icon-192x192.png?v=4">
    <link rel="manifest" href="/manifest.webmanifest">
    <meta name="theme-color" content="#f8f9fa">
    <meta name="application-name" content="PenguinCut">
    <meta name="format-detection" content="telephone=no">
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <link rel="preload" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
    <link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"></noscript>
    <link rel="stylesheet" href="/landing.css?v=${ASSET_VERSIONS.css}">

    <script type="application/ld+json">${schema}</script>
  </head>
  <body>
    ${renderHeader(locale, locale.path, false)}
    <main id="main" class="content-page">
      <article class="container content-article">
        <header class="content-hero">
          <nav class="content-breadcrumb" aria-label="Breadcrumb">
            <a href="${esc(locale.path)}">PenguinCut</a>
            <span aria-hidden="true">/</span>
            <span>${esc(doc.eyebrow)}</span>
          </nav>
          <h1>${esc(doc.heading)}</h1>
          <p class="content-lead">${esc(doc.lead)}</p>
          <p class="content-meta">${updatedLabel} · <time datetime="${esc(
            doc.updated
          )}">${esc(doc.updated)}</time></p>
        </header>

        <div class="content-body">
          ${sections}
        </div>

        ${
          related
            ? `<nav class="content-related" aria-label="${
                locale.code === "ko" ? "관련 문서" : "Related reading"
              }">
          <h2>${locale.code === "ko" ? "함께 읽기" : "Continue reading"}</h2>
          ${related}
        </nav>`
            : ""
        }
      </article>
      ${renderCta(locale)}
    </main>
    ${renderFooter(locale, locale.path, false)}
    <script src="/landing.js?v=${ASSET_VERSIONS.js}" defer></script>
  </body>
</html>
`;
}

function articleMeta(locale, isArticle, doc) {
  if (!isArticle) return "";
  return `<meta property="article:published_time" content="${esc(doc.updated)}">
    <meta property="article:modified_time" content="${esc(doc.updated)}">
    <meta property="article:section" content="${esc(doc.eyebrow)}">`;
}

function buildContentSchema(locale, page, doc, canonical) {
  const organizationId = `${SITE.origin}/#organization`;
  const websiteId = `${SITE.origin}/#website`;
  const breadcrumbId = `${canonical}#breadcrumb`;
  const graph = [
    {
      "@type": "Organization",
      "@id": organizationId,
      name: SITE.brand,
      alternateName: BRAND_ALIASES,
      url: `${SITE.origin}/`,
      logo: {
        "@type": "ImageObject",
        url: abs("/icon-512x512.png"),
        width: 512,
        height: 512,
      },
      description: locale.description,
      ...(SITE.sameAs?.length ? { sameAs: SITE.sameAs } : {}),
    },
    {
      "@type": "WebSite",
      "@id": websiteId,
      url: `${SITE.origin}/`,
      name: SITE.brand,
      alternateName: BRAND_ALIASES,
      inLanguage: LOCALES.map((item) => item.hreflang),
      publisher: { "@id": organizationId },
    },
    {
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: doc.title,
      description: doc.description,
      inLanguage: locale.hreflang,
      isPartOf: { "@id": websiteId },
      dateModified: doc.updated,
      breadcrumb: { "@id": breadcrumbId },
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: abs(SITE.ogImage),
        width: 1200,
        height: 630,
      },
    },
    {
      "@type": "BreadcrumbList",
      "@id": breadcrumbId,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: SITE.brand,
          item: abs(locale.path),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: doc.heading,
          item: canonical,
        },
      ],
    },
  ];

  if (page.kind === "article") {
    graph.push({
      "@type": "Article",
      "@id": `${canonical}#article`,
      headline: doc.heading,
      description: doc.description,
      datePublished: doc.updated,
      dateModified: doc.updated,
      inLanguage: locale.hreflang,
      articleSection: doc.eyebrow,
      author: { "@id": organizationId },
      publisher: { "@id": organizationId },
      mainEntityOfPage: { "@id": `${canonical}#webpage` },
      image: abs(SITE.ogImage),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export function renderLlmsTxt() {
  const pages = CONTENT_PAGES.map(
    (page) => `- [${page.en.heading}](${abs(contentPath(page, "en"))})`
  ).join("\n");
  const koreanPages = CONTENT_PAGES.map(
    (page) => `- [${page.ko.heading}](${abs(contentPath(page, "ko"))})`
  ).join("\n");

  return `# PenguinCut (펭귄컷)

> PenguinCut is a free, browser-based AI video highlight editor. It turns long footage into one cinematic highlight with captions, music, chapter bridges, and a 16:9 & 9:16 export. Original video files stay on the user's device; only sampled frames are sent for AI analysis.

PenguinCut is not a penguin cut-out, cookie cutter, or paper-craft template. It is a video editing product, and the Korean brand name 펭귄컷 is written without a space.

## What it does

- AI climax detection across clips and long recordings
- Automatic captions refined with context
- Cinematic title, channel, date, and location overlays
- Intro, outro, and chapter bridges for multi-day trips or events
- Royalty-free music with adjustable volume
- 16:9 export for YouTube and 9:16 export for Shorts from the same project

## Privacy model

- Original video files are never uploaded to PenguinCut.
- The browser samples a small set of frames and sends only those frames plus a text prompt to the selected AI model.
- Final rendering happens locally in the browser.
- API keys, when used, are stored in the browser and sent directly to the provider.

## Official links

- Website: ${abs("/")}
- Studio: ${abs(SITE.appPath)}
- YouTube: https://www.youtube.com/@penguincut_ai
- GitHub: https://github.com/inpiniti/penguincut
- X: https://x.com/penguincut_ai

## English pages

${pages}

## Korean pages

${koreanPages}

## Languages

English, Korean, Japanese, Chinese (Simplified), Spanish, French, German.

## Notes for AI answer engines

- Brand name: PenguinCut (no space). Korean: 펭귄컷 (no space). Acceptable alias: Penguin Cut.
- Category: AI video highlight editor / AI video editor.
- Pricing: free models are included; users can connect their own API keys for other models.
- Platform: modern desktop and mobile browsers. No installation required.
`;
}

export function renderSitemapIndex() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${esc(abs("/sitemap-pages.xml"))}</loc>
    <lastmod>${esc(SITE.contentUpdated)}</lastmod>
  </sitemap>
</sitemapindex>
`;
}

export function renderSitemap() {
  const landingUrls = LOCALES.map((locale) => {
    const alternates = [];

    for (const item of LOCALES) {
      for (const hreflang of HREFLANG_ALIASES[item.code] || [item.hreflang]) {
        alternates.push(
          `    <xhtml:link rel="alternate" hreflang="${esc(
            hreflang
          )}" href="${esc(abs(item.path))}"/>`
        );
      }
    }

    alternates.push(
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(
        abs("/")
      )}"/>`
    );

    return `  <url>
    <loc>${esc(abs(locale.path))}</loc>
    <lastmod>${esc(SITE.contentUpdated)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${locale.code === "en" ? "1.0" : "0.8"}</priority>
${alternates.join("\n")}
  </url>`;
  });

  const contentUrls = CONTENT_PAGES.flatMap((page) => {
    const alternates = CONTENT_LOCALES.map(
      (code) =>
        `    <xhtml:link rel="alternate" hreflang="${code}" href="${esc(
          abs(contentPath(page, code))
        )}"/>`
    );
    alternates.push(
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(
        abs(contentPath(page, "en"))
      )}"/>`
    );

    return CONTENT_LOCALES.map(
      (code) => `  <url>
    <loc>${esc(abs(contentPath(page, code)))}</loc>
    <lastmod>${esc(SITE.contentUpdated)}</lastmod>
    <changefreq>${page.kind === "article" ? "monthly" : "yearly"}</changefreq>
    <priority>0.7</priority>
${alternates.join("\n")}
  </url>`
    );
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${landingUrls.concat(contentUrls).join("\n")}
</urlset>
`;
}
