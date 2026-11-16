// Tells IndexNow (Bing, Yandex, ...) that every page in the sitemap changed.
// Run with: npm run indexnow
//
// The key file must already be deployed: https://penguincut.com/<key>.txt
// containing exactly the key. Bing Webmaster Tools hands the key out under
// URL Submission > IndexNow.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const host = "penguincut.com";

const keyFiles = readdirSync(publicDir).filter((name) =>
  /^[a-zA-Z0-9-]{8,128}\.txt$/.test(name)
);

if (keyFiles.length !== 1) {
  console.error(
    keyFiles.length === 0
      ? "No IndexNow key file found. Put public/<key>.txt next to the other public files."
      : `Expected exactly one key file in public/, found ${keyFiles.length}: ${keyFiles.join(", ")}`
  );
  process.exit(1);
}

const keyFile = keyFiles[0];
const key = readFileSync(join(publicDir, keyFile), "utf8").trim();
const keyLocation = `https://${host}/${keyFile}`;

let sitemap;
try {
  sitemap = readFileSync(join(publicDir, "sitemap-pages.xml"), "utf8");
} catch {
  console.error("public/sitemap-pages.xml is missing. Run `npm run seo` first.");
  process.exit(1);
}

const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
  match[1].trim()
);

if (urlList.length === 0) {
  console.error("No URLs found in public/sitemap-pages.xml.");
  process.exit(1);
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key, keyLocation, urlList }),
});

console.log(`IndexNow: ${response.status} ${response.statusText}`);
console.log(`  key:      ${keyLocation}`);
console.log(`  urls:     ${urlList.length}`);
for (const url of urlList) console.log(`    ${url}`);

if (response.status !== 200 && response.status !== 202) {
  process.exit(1);
}
