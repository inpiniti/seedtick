// Generates the static landing pages, localized copies, and sitemap.
// Run with: npm run seo

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { LOCALES, getLocale } from "../seo/content.mjs";
import { CONTENT_LOCALES, CONTENT_PAGES } from "../seo/pages.mjs";
import {
  renderContentPage,
  renderLlmsTxt,
  renderPage,
  renderSitemap,
  renderSitemapIndex,
} from "../seo/template.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const generated = [];

for (const locale of LOCALES) {
  const html = renderPage(locale);
  const target =
    locale.code === "en"
      ? join(root, "index.html")
      : join(root, "public", locale.code, "index.html");

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html, "utf8");
  generated.push({ path: target, bytes: Buffer.byteLength(html) });
}

// Long-form pages: English at the root, Korean under /ko/. Other locales link
// to the English versions from the landing footer.
for (const page of CONTENT_PAGES) {
  for (const code of CONTENT_LOCALES) {
    const locale = getLocale(code);
    if (!locale) continue;
    const html = renderContentPage(locale, page, page[code]);
    const target =
      code === "en"
        ? join(root, "public", ...page.slug.split("/"), "index.html")
        : join(root, "public", code, ...page.slug.split("/"), "index.html");

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, html, "utf8");
    generated.push({ path: target, bytes: Buffer.byteLength(html) });
  }
}

// /llms.txt summarises the product, privacy model, and canonical URLs for
// AI answer engines and retrieval crawlers.
const llms = renderLlmsTxt();
const llmsPath = join(root, "public", "llms.txt");
writeFileSync(llmsPath, llms, "utf8");
generated.push({ path: llmsPath, bytes: Buffer.byteLength(llms) });

// The public sitemap is an index that points at the URL-level sitemap,
// matching how large sites ship /sitemap.xml (e.g. google.com/sitemap.xml).
const sitemap = renderSitemap();
const pagesPath = join(root, "public", "sitemap-pages.xml");
writeFileSync(pagesPath, sitemap, "utf8");
generated.push({ path: pagesPath, bytes: Buffer.byteLength(sitemap) });

const sitemapIndex = renderSitemapIndex();
const sitemapPath = join(root, "public", "sitemap.xml");
writeFileSync(sitemapPath, sitemapIndex, "utf8");
generated.push({ path: sitemapPath, bytes: Buffer.byteLength(sitemapIndex) });

console.log("Generated SEO pages:");
for (const item of generated) {
  console.log(`  ${item.path.replace(root + "\\", "")} (${item.bytes} bytes)`);
}
