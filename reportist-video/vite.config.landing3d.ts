// Builds the landing-only 3D engine as a single self-contained IIFE.
// Static SEO pages load /vendor/landing-3d.js with a plain <script> tag,
// so the main /studio React bundle stays completely unaffected.

import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  appType: "custom",
  build: {
    outDir: "public/vendor",
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL("./src/landing3d/main.ts", import.meta.url)),
      name: "Landing3D",
      formats: ["iife"],
      fileName: () => "landing-3d.js",
    },
  },
});
