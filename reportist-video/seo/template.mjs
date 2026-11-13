// Renders the static, crawlable landing pages and the XML sitemap.
// All visible copy comes from seo/content.mjs.

import {
  HREFLANG_ALIASES,
  LOCALES,
  SITE,
} from "./content.mjs";

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
  chevron: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="m6 9 6 6 6-6"/>
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

function appHref(locale) {
  return SITE.appPath + (locale.code === "en" ? "" : `?lang=${locale.code}`);
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

function renderLanguageLinks(currentLocale, className = "") {
  return LOCALES.map((locale) => {
    const current = locale.code === currentLocale.code;
    return `<a class="${className}" href="${esc(locale.path)}" hreflang="${esc(
      locale.hreflang
    )}" lang="${esc(locale.htmlLang)}"${current ? ' aria-current="page"' : ""}>${esc(
      locale.nativeLabel
    )}</a>`;
  }).join("\n            ");
}

function renderHeader(locale) {
  return `
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="${esc(locale.path)}" aria-label="PenguinCut">
        <img src="/penguin-logo.svg" alt="" width="36" height="36">
        <span>PenguinCut</span>
      </a>

      <button class="nav-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>
        <span></span><span></span><span></span>
      </button>

      <nav class="site-nav" id="site-nav" aria-label="Main navigation" data-nav>
        <a href="#features">${esc(locale.nav.features)}</a>
        <a href="#how-it-works">${esc(locale.nav.how)}</a>
        <a href="#use-cases">${esc(locale.nav.useCases)}</a>
        <a href="#languages">${esc(locale.nav.languages)}</a>
        <a href="#faq">${esc(locale.nav.faq)}</a>

        <details class="lang-switcher">
          <summary>
            ${ICONS.globe}
            <span>${esc(locale.nativeLabel)}</span>
            ${ICONS.chevron}
          </summary>
          <div class="lang-panel">
            ${renderLanguageLinks(locale)}
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
    <section class="hero" aria-labelledby="hero-title">
      <div class="container hero-grid">
        <div class="hero-copy">
          <p class="eyebrow"><span class="eyebrow-dot"></span>${esc(
            hero.badge
          )}</p>
          <h1 id="hero-title">${hero.title}<span class="accent">${hero.accent}</span></h1>
          <p class="hero-lead">${esc(hero.lead)}</p>

          <div class="hero-actions">
            <a class="button" href="${esc(appHref(locale))}">
              ${esc(hero.primary)}
              ${ICONS.arrow}
            </a>
            <a class="button button-ghost" href="#how-it-works">${esc(
              hero.secondary
            )}</a>
          </div>

          <ul class="trust-list">
            ${hero.trust
              .map(
                (item) =>
                  `<li>${ICONS.check}<span>${esc(item)}</span></li>`
              )
              .join("\n            ")}
          </ul>
        </div>

        <div class="hero-stage" aria-hidden="true">
          <div class="orb orb-a"></div>
          <div class="orb orb-b"></div>

          <div class="studio-mock">
            <div class="studio-chrome">
              <span class="chrome-dot"></span>
              <span class="chrome-dot"></span>
              <span class="chrome-dot"></span>
              <span class="chrome-title">${esc(hero.visual.windowTitle)}</span>
              <span class="chrome-status"><i class="status-dot"></i>${esc(
                hero.visual.status
              )}</span>
            </div>

            <div class="studio-body">
              <div class="studio-topline">
                <span class="studio-pill">16:9</span>
                <span class="studio-pill">1080p</span>
                <span class="studio-pill studio-pill-accent">${esc(
                  hero.visual.badge
                )}</span>
              </div>

              <div class="studio-main">
                <div class="preview">
                  <div class="preview-glow"></div>
                  <div class="preview-caption">${esc(
                    hero.visual.caption
                  )}</div>
                  <div class="preview-play">${ICONS.play}</div>
                  <div class="preview-badge">${esc(hero.visual.cardMeta)}</div>
                </div>

                <div class="studio-side">
                  <div class="side-block">
                    <span class="side-label">${esc(
                      hero.visual.cardTitle
                    )}</span>
                    <span class="side-value">${esc(
                      hero.visual.cardMeta
                    )}</span>
                    <span class="side-meter"><i></i></span>
                  </div>
                  <div class="side-block side-block-accent">
                    <span class="side-label">${esc(hero.visual.export)}</span>
                    <span class="side-arrow">${ICONS.arrow}</span>
                  </div>
                </div>
              </div>

              <div class="timeline">
                <div class="timeline-head">
                  <span>${esc(hero.visual.timeline)}</span>
                  <span>00:42 / 01:18</span>
                </div>
                <div class="timeline-track">
                  <span class="tl-clip tl-clip-1"></span>
                  <span class="tl-clip tl-clip-2"></span>
                  <span class="tl-clip tl-clip-3 tl-clip-hot"><i></i></span>
                  <span class="tl-clip tl-clip-4"></span>
                  <span class="tl-clip tl-clip-5"></span>
                  <span class="tl-playhead"></span>
                </div>
                <div class="timeline-ruler">
                  <span>00:00</span><span>00:30</span><span>01:00</span><span>01:30</span>
                </div>
              </div>
            </div>
          </div>

          <div class="float-card float-card-a">
            <span class="float-icon">${ICONS.sparkles}</span>
            <span><strong>${esc(hero.visual.badge)}</strong><small>${esc(
              hero.visual.status
            )}</small></span>
          </div>

          <div class="float-card float-card-b">
            <span class="float-icon float-icon-accent">${ICONS.check}</span>
            <span><strong>${esc(hero.visual.cardTitle)}</strong><small>${esc(
              hero.visual.cardMeta
            )}</small></span>
          </div>
        </div>
      </div>
    </section>`;
}

function renderStrip(locale) {
  return `
    <section class="trust-strip" aria-label="${esc(locale.hero.badge)}">
      <div class="container trust-strip-inner">
        ${locale.strip
          .map((item) => `<span>${esc(item)}</span>`)
          .join("\n        ")}
      </div>
    </section>`;
}

function renderFeatures(locale) {
  const { features } = locale;
  return `
    <section class="section" id="features" aria-labelledby="features-title">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow">${esc(features.eyebrow)}</p>
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

function renderHow(locale) {
  const { how } = locale;
  return `
    <section class="section section-alt" id="how-it-works" aria-labelledby="how-title">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow">${esc(how.eyebrow)}</p>
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

function renderFooter(locale) {
  const year = new Date().getFullYear();
  return `
  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a class="brand" href="${esc(locale.path)}" aria-label="PenguinCut">
          <img src="/penguin-logo.svg" alt="" width="36" height="36">
          <span>PenguinCut</span>
        </a>
        <p>${esc(locale.footer.tagline)}</p>
      </div>

      <nav class="footer-col" aria-labelledby="footer-product">
        <h2 id="footer-product">${esc(locale.footer.product)}</h2>
        <a href="${esc(appHref(locale))}">${esc(locale.nav.open)}</a>
        <a href="#features">${esc(locale.nav.features)}</a>
        <a href="#how-it-works">${esc(locale.nav.how)}</a>
        <a href="#faq">${esc(locale.nav.faq)}</a>
      </nav>

      <nav class="footer-col" aria-labelledby="footer-languages">
        <h2 id="footer-languages">${esc(locale.footer.language)}</h2>
        ${renderLanguageLinks(locale)}
      </nav>
    </div>

    <div class="container footer-bottom">
      <span>${esc(locale.footer.legal.replace("{year}", String(year)))}</span>
      <a href="/sitemap.xml">Sitemap</a>
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
        url: `${SITE.origin}/`,
        logo: {
          "@type": "ImageObject",
          url: abs("/icon-512x512.png"),
          width: 512,
          height: 512,
        },
        description: locale.description,
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: `${SITE.origin}/`,
        name: SITE.brand,
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
  const isEnglish = locale.code === "en";
  const redirectHash = isEnglish ? "" : `?lang=${locale.code}`;

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
  <meta property="og:image:alt" content="${esc(SITE.ogImageAlt)}">
  <meta property="og:locale" content="${esc(locale.ogLocale)}">
  ${renderOgAlternates(locale)}

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(locale.title)}">
  <meta name="twitter:description" content="${esc(locale.description)}">
  <meta name="twitter:image" content="${esc(abs(SITE.ogImage))}">
  <meta name="twitter:image:alt" content="${esc(SITE.ogImageAlt)}">

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

  ${SITE.verification?.google ? `<meta name="google-site-verification" content="${esc(SITE.verification.google)}">` : ""}
  ${SITE.verification?.naver ? `<meta name="naver-site-verification" content="${esc(SITE.verification.naver)}">` : ""}

  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="preload" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"></noscript>
  <link rel="stylesheet" href="/landing.css">

  <script>
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
      ${renderFeatures(locale)}
      ${renderHow(locale)}
      ${renderUseCases(locale)}
      ${renderLanguages(locale)}
      ${renderFaq(locale)}
      ${renderCta(locale)}
    </main>
    ${renderFooter(locale)}
    <script src="/landing.js" defer></script>
  </body>
</html>
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
  const urls = LOCALES.map((locale) => {
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
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}
