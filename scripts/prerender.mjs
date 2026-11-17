#!/usr/bin/env node
/**
 * Bake the config-driven blocks (packages, rental catalog, gallery, form
 * options…) into the HTML so the prices and equipment are readable without
 * JavaScript and by search engines.
 *
 *   npm run prerender
 *
 * js/config.js stays the one place to edit content: in the browser, js/main.js
 * re-renders every block from config.js anyway. Run this after editing
 * config.js so the no-JavaScript copy matches; `npm test` fails if they drift.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { createServer } = require("../tests/server.cjs");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const BLOCKS = {
  "index.html": {
    packages: () => document.getElementById("package-cards").innerHTML,
    estimator: () => document.getElementById("estimator-packages").innerHTML,
    custom: () => document.getElementById("custom-categories").innerHTML,
    "rental-preview": () => document.getElementById("rental-preview").innerHTML,
    gallery: () => document.getElementById("gallery-grid").innerHTML,
    "event-types": () => [...document.querySelectorAll("#bk-event-type option")].slice(1).map((o) => o.outerHTML).join(""),
    "package-options": () => [...document.querySelectorAll("#bk-package option")].slice(1).map((o) => o.outerHTML).join(""),
  },
  "rentals.html": {
    "rental-catalog": () => document.getElementById("rental-catalog").innerHTML,
    "rental-picker": () => window.DJM.pickerHTML(true),
  },
};

export function inject(html, name, content) {
  const re = new RegExp(`(<!-- prerender:${name} -->)[\\s\\S]*?(<!-- /prerender:${name} -->)`);
  if (!re.test(html)) throw new Error(`marker ${name} missing`);
  return html.replace(re, (_, a, b) => a + content + b);
}

export async function render(file) {
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/${file}`, { waitUntil: "load" });
    const out = {};
    for (const [name, fn] of Object.entries(BLOCKS[file])) out[name] = await page.evaluate(fn);
    return out;
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const file of Object.keys(BLOCKS)) {
    const blocks = await render(file);
    let html = readFileSync(join(root, file), "utf8");
    for (const [name, content] of Object.entries(blocks)) html = inject(html, name, content);
    writeFileSync(join(root, file), html);
    console.log("prerendered", file, Object.keys(blocks).join(", "));
  }
}
