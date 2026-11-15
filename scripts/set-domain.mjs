#!/usr/bin/env node
/**
 * Point the site's SEO tags at its live domain.
 *
 *   node scripts/set-domain.mjs https://www.example.com
 *
 * - writes sitemap.xml
 * - adds the Sitemap line to robots.txt
 * - adds/updates <link rel="canonical"> and og:url on each page
 * - makes og:image and the JSON-LD image absolute
 * Safe to run again with a different domain.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = process.argv[2];
if (!arg || !/^https?:\/\/[^/\s]+/i.test(arg)) {
  console.error("Usage: node scripts/set-domain.mjs https://your-domain.com");
  process.exit(1);
}
const base = arg.replace(/\/+$/, "") + "/";
const pages = [
  { file: "index.html", path: "", priority: "1.0" },
  { file: "rentals.html", path: "rentals.html", priority: "0.8" },
];
const today = new Date().toISOString().slice(0, 10);

for (const p of pages) {
  const file = join(root, p.file);
  let html = readFileSync(file, "utf8");
  const url = base + p.path;
  const ogImage = base + "assets/img/og-image.jpg";

  html = html.replace(/\s*<link rel="canonical"[^>]*>/g, "").replace(/\s*<meta property="og:url"[^>]*>/g, "");
  html = html.replace(/(<meta name="robots"[^>]*>)/, `$1\n  <link rel="canonical" href="${url}">`);
  html = html.replace(/(<meta property="og:type"[^>]*>)/, `$1\n  <meta property="og:url" content="${url}">`);
  html = html.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${ogImage}">`);
  html = html.replace(/"image": "[^"]*"/, `"image": "${ogImage}"`);
  html = html.replace(/\s*"url": "[^"]*",/, "");
  html = html.replace(/("@type": "EntertainmentBusiness",)/, `$1\n    "url": "${base}",`);
  writeFileSync(file, html);
  console.log("updated", p.file);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${base + p.path}</loc><lastmod>${today}</lastmod><priority>${p.priority}</priority></url>`).join("\n")}
</urlset>
`;
writeFileSync(join(root, "sitemap.xml"), sitemap);
console.log("wrote sitemap.xml");

let robots = readFileSync(join(root, "robots.txt"), "utf8").replace(/\n?Sitemap:.*\n?/g, "\n").trimEnd();
robots += `\n\nSitemap: ${base}sitemap.xml\n`;
writeFileSync(join(root, "robots.txt"), robots);
console.log("updated robots.txt");
