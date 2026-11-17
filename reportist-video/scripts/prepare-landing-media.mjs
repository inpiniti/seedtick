// Generates the lightweight media the landing scroll story needs:
//   public/media/frames/f-001.webp .. f-072.webp  — scrub frames from the hero loop
//   public/media/ui/ui-01.webp .. ui-06.webp       — real Studio screenshots
// Run with: npm run media:landing (or node scripts/prepare-landing-media.mjs)

import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const media = join(root, "public", "media");
const framesDir = join(media, "frames");
const uiDir = join(media, "ui");
const launch = join(root, "docs", "launch", "assets");

function run(args) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    stdio: "inherit",
  });
}

mkdirSync(framesDir, { recursive: true });
mkdirSync(uiDir, { recursive: true });

// The source is a 9.53s / 286-frame cropped highlight loop. 72 evenly spaced
// frames give a ~7.5fps scrub source — instant to decode on phones, and light
// enough (~1-2MB total) to preload without hurting LCP.
run([
  "-i",
  join(media, "hero-nature.mp4"),
  "-vf",
  "fps=7.553,scale=960:-2",
  "-frames:v",
  "72",
  "-c:v",
  "libwebp",
  "-quality",
  "78",
  "-compression_level",
  "6",
  join(framesDir, "f-%03d.webp"),
]);

// Real product UI, resized for the sticky showcase panel.
const sources = [
  "ph-01-editor.png",
  "ph-02-ai-analysis.png",
  "ph-03-bridges.png",
  "ph-04-music.png",
  "ph-05-export.png",
  "ph-06-date-bridge.png",
];

sources.forEach((name, index) => {
  const input = join(launch, name);
  if (!existsSync(input)) {
    console.error(`missing ${input}`);
    process.exit(1);
  }
  run([
    "-i",
    input,
    "-vf",
    "scale=960:-2",
    "-c:v",
    "libwebp",
    "-quality",
    "82",
    join(uiDir, `ui-${String(index + 1).padStart(2, "0")}.webp`),
  ]);
});

console.log("landing story media ready");
