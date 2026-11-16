/* ==========================================================================
   100 UI/UX PRACTICES: one automated check per practice.
   Each test is named "#NN <practice>" so the report doubles as proof.
   See UI-PRACTICES.md for where each practice lives in the code.
   Run: npm run test:practices
   ========================================================================== */
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { ROOT, CFG, state, setup, teardown, isoDate, open, fillBooking, fillRental } = require("./helpers.cjs");

const CSS = fs.readFileSync(path.join(ROOT, "css/styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const ROOT_BLOCK = CSS.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
const BODY_CSS = CSS.replace(/:root\s*\{[\s\S]*?\n\}/, ""); // everything outside the token block
const INDEX = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const RENTALS = fs.readFileSync(path.join(ROOT, "rentals.html"), "utf8");
const AXE_SRC = fs.readFileSync(require.resolve("axe-core/axe.min.js", { paths: [ROOT] }), "utf8");

const tokens = {};
ROOT_BLOCK.replace(/(--[\w-]+)\s*:\s*([^;]+);/g, (_, k, v) => { tokens[k] = v.trim(); });

/** innermost rules: [{ selector, body, decls: [[prop, value]] }] (keyframe steps excluded) */
function rules(css) {
  const noKeyframes = css.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*\s*\}/g, "");
  const out = [];
  noKeyframes.replace(/([^{}]+)\{([^{}]*)\}/g, (_, sel, body) => {
    const decls = [];
    body.replace(/([\w-]+)\s*:\s*([^;]+)(;|$)/g, (__, p, v) => { decls.push([p.trim(), v.trim()]); });
    out.push({ selector: sel.trim().replace(/^.*@media[^{]*$/s, "").trim(), body, decls });
  });
  return out;
}
const RULES = rules(BODY_CSS);
const KEYFRAMES = {};
BODY_CSS.replace(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g, (_, name, body) => { KEYFRAMES[name] = body; });

function hexToRgb(hex) { const h = hex.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
function lum([r, g, b]) { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function contrast(a, b) { const [x, y] = [lum(hexToRgb(a)), lum(hexToRgb(b))].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }
function sat(hex) { const [r, g, b] = hexToRgb(hex).map((c) => c / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2; return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)); }
const px = (v) => parseFloat(v);

let home, rent, mobile;
before(async () => {
  await setup();
  home = await open("index.html");
  rent = await open("rentals.html");
  mobile = await open("index.html", { viewport: { width: 390, height: 844 }, contextOptions: { hasTouch: true, isMobile: true } });
});
after(async () => {
  for (const x of [home, rent, mobile]) await x.context.close();
  await teardown();
});

/* ================================ Spacing and layout ================================ */
describe("Spacing and layout", () => {
  test("#1 generous whitespace: sections get ≥ 96px vertical padding and cards ≥ 24px", async () => {
    const r = await home.page.$$eval(".section", (els) => els.map((e) => parseFloat(getComputedStyle(e).paddingTop)));
    assert.ok(r.length >= 8 && r.every((v) => v >= 96), JSON.stringify(r));
    const card = await home.page.$eval(".package", (e) => parseFloat(getComputedStyle(e).paddingLeft));
    assert.ok(card >= 24);
  });

  test("#2 every padding, margin and gap comes from the --s-* spacing scale", () => {
    const scale = Object.keys(tokens).filter((k) => /^--s-\d+$/.test(k)).map((k) => px(tokens[k]));
    assert.deepEqual(scale, [4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160]);
    const bad = [];
    for (const r of RULES) {
      if (/slider-thumb/.test(r.selector)) continue; // vendor thumb geometry, not layout spacing
      for (const [p, v] of r.decls) {
        if (!/^(padding|margin|gap|row-gap|column-gap)(-|$)/.test(p)) continue;
        const stripped = v.replace(/var\([^)]*\)/g, "").replace(/env\([^)]*\)/g, "");
        if (/\d*\.?\d+(px|rem|em)\b/.test(stripped) && !/^-?9999px$/.test(v)) bad.push(`${r.selector} { ${p}: ${v} }`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test("#3 space between groups is bigger than space inside a group", async () => {
    const s = await home.page.$eval("#bookings .section-head", (e) => ({ inside: parseFloat(getComputedStyle(e).rowGap), after: parseFloat(getComputedStyle(e).marginBottom) }));
    assert.ok(s.after >= s.inside * 3, JSON.stringify(s));
    const f = await home.page.evaluate(() => ({ inside: parseFloat(getComputedStyle(document.querySelector(".field")).rowGap), between: parseFloat(getComputedStyle(document.querySelector(".form-grid")).rowGap) }));
    assert.ok(f.between > f.inside, JSON.stringify(f));
  });

  test("#4 each label sits clearly closer to its own field than to the field above", async () => {
    const d = await home.page.evaluate(() => {
      const prev = document.getElementById("bk-date").closest(".field").getBoundingClientRect();
      const label = document.querySelector('label[for="bk-start"]').getBoundingClientRect();
      const input = document.getElementById("bk-start").getBoundingClientRect();
      return { toPrev: label.top - prev.bottom, toOwn: input.top - label.bottom };
    });
    assert.ok(d.toPrev >= 24 && d.toOwn <= 10 && d.toPrev > d.toOwn * 2, JSON.stringify(d));
  });

  test("#5 sections are grouped by background change, not divider lines", async () => {
    const borders = await home.page.$$eval(".section, .faq details, .services > li, .rent-list a", (els) => els.map((e) => parseFloat(getComputedStyle(e).borderTopWidth)));
    assert.ok(borders.every((b) => b === 0), JSON.stringify(borders));
    const bgs = await home.page.$$eval("main > .section", (els) => new Set(els.map((e) => getComputedStyle(e).backgroundColor)).size);
    assert.ok(bgs >= 3, "alternating section backgrounds");
  });

  test("#6 consistent radii and font sizes: tokens only, and matching components match", async () => {
    const bad = [];
    for (const r of RULES) for (const [p, v] of r.decls) {
      if (p === "border-radius" && !/^(var\(--r-[\w]+\)|calc\(var\(--r-\w+\) - var\(--s-\d+\)\)|inherit|0|50%|var\(--r-lg\) var\(--r-lg\) 0 0)$/.test(v)) bad.push(`${r.selector} { ${p}: ${v} }`);
      if (p === "font-size" && !/^var\(--fs-[\w]+\)$/.test(v)) bad.push(`${r.selector} { ${p}: ${v} }`);
    }
    assert.deepEqual(bad, []);
    const radii = await home.page.$$eval(".card", (els) => new Set(els.map((e) => getComputedStyle(e).borderRadius)).size);
    assert.equal(radii, 1);
    const inputs = await home.page.$$eval("#booking-form input:not([type=hidden]):not([type=radio]), #booking-form select, #booking-form textarea", (els) => new Set(els.filter((e) => e.offsetParent).map((e) => getComputedStyle(e).fontSize)).size);
    assert.equal(inputs, 1);
  });

  test("#7 running text stays within about 50–75 characters per line", async () => {
    const lines = await home.page.evaluate(() => {
      const c = document.createElement("canvas").getContext("2d");
      return [...document.querySelectorAll("main p")].filter((p) => p.textContent.length > 100 && p.offsetParent).map((p) => {
        const cs = getComputedStyle(p);
        c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const avg = c.measureText(p.textContent).width / p.textContent.length;
        return Math.round(p.clientWidth / avg);
      });
    });
    assert.ok(lines.length >= 5 && lines.every((n) => n <= 75), JSON.stringify(lines));
  });

  test("#8 nested corners: inner radius = outer radius − padding", async () => {
    const pairs = await home.page.evaluate(() => {
      const r = (el) => parseFloat(getComputedStyle(el).borderTopLeftRadius);
      const p = (el) => parseFloat(getComputedStyle(el).paddingTop);
      const seg = document.querySelector("#estimator-packages");
      const spec = document.querySelector(".spec-card");
      const contact = document.querySelector(".contact__card");
      return [
        [r(seg) - p(seg), r(seg.querySelector(".seg label"))],
        [r(spec) - p(spec), r(spec.querySelector(".spec-card__row"))],
        [r(contact) - p(contact), r(contact.querySelector(".contact__item"))],
      ];
    });
    pairs.forEach(([expected, actual]) => assert.equal(actual, expected));
    const st = await rent.page.evaluate(() => { const s = document.querySelector(".stepper"); return [parseFloat(getComputedStyle(s).borderTopLeftRadius) - parseFloat(getComputedStyle(s).paddingTop), parseFloat(getComputedStyle(s.querySelector("button")).borderTopLeftRadius)]; });
    assert.equal(st[1], st[0]);
  });

  test("#9 optical alignment: play triangles and trailing arrows are nudged", async () => {
    await home.page.click("#hero-video-toggle");
    const tx = await home.page.$eval("#hero-video-toggle svg", (e) => new DOMMatrix(getComputedStyle(e).transform).m41);
    await home.page.click("#hero-video-toggle");
    assert.equal(tx, 1);
    const arrow = await home.page.$eval(".hero .btn--icon-end svg", (e) => new DOMMatrix(getComputedStyle(e).transform).m41);
    assert.equal(arrow, 1);
  });

  test("#10 content width is capped on very wide screens", async () => {
    const x = await open("index.html", { viewport: { width: 2560, height: 1200 } });
    const w = await x.page.$eval("#about .container", (e) => e.getBoundingClientRect().width);
    await x.context.close();
    assert.ok(w <= 1288, String(w));
  });

  test("#11 section padding scales with screen size via clamp()", async () => {
    assert.match(tokens["--section-y"], /^clamp\(/);
    const desk = await home.page.$eval("#about", (e) => parseFloat(getComputedStyle(e).paddingTop));
    const phone = await mobile.page.$eval("#about", (e) => parseFloat(getComputedStyle(e).paddingTop));
    assert.ok(desk > phone, `${desk} > ${phone}`);
  });

  test("#12 buttons with an icon use less padding on the icon side", async () => {
    const r = await home.page.$$eval(".btn--icon-end", (els) => els.filter((e) => e.offsetParent).map((e) => [parseFloat(getComputedStyle(e).paddingLeft), parseFloat(getComputedStyle(e).paddingRight)]));
    assert.ok(r.length >= 3 && r.every(([l, rr]) => rr < l), JSON.stringify(r));
    const s = await home.page.$eval("#contact .btn--icon-start", (e) => [parseFloat(getComputedStyle(e).paddingLeft), parseFloat(getComputedStyle(e).paddingRight)]);
    assert.ok(s[0] < s[1]);
  });
});

/* ================================ Typography ================================ */
describe("Typography", () => {
  test("#13 large headings have slightly tightened letter-spacing", async () => {
    const ls = await home.page.$$eval("h1, h2", (els) => els.filter((e) => e.offsetParent && !e.closest("footer")).map((e) => parseFloat(getComputedStyle(e).letterSpacing)));
    assert.ok(ls.length > 5 && ls.every((v) => v < 0), JSON.stringify(ls));
  });

  test("#14 small all-caps labels have loosened letter-spacing", async () => {
    const r = await home.page.$$eval(".label", (els) => els.filter((e) => e.offsetParent).map((e) => { const cs = getComputedStyle(e); return { tt: cs.textTransform, ls: parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize) }; }));
    assert.ok(r.length > 10 && r.every((x) => x.tt === "uppercase" && x.ls >= 0.1), JSON.stringify(r.slice(0, 3)));
  });

  test("#15 hierarchy uses weight and color, not only size", async () => {
    const r = await home.page.$eval("#bookings .section-head", (e) => {
      const h = getComputedStyle(e.querySelector("h2")), p = getComputedStyle(e.querySelector("p:not(.label)")), l = getComputedStyle(e.querySelector(".label"));
      return { hw: h.fontWeight, pw: p.fontWeight, hc: h.color, pc: p.color, lc: l.color };
    });
    assert.ok(Number(r.hw) >= 800 && Number(r.pw) <= 400);
    assert.notEqual(r.hc, r.pc);
    assert.notEqual(r.lc, r.hc);
  });

  test("#16 body line-height ≈1.5–1.6; headings 1.0–1.2", async () => {
    const r = await home.page.evaluate(() => {
      const ratio = (e) => parseFloat(getComputedStyle(e).lineHeight) / parseFloat(getComputedStyle(e).fontSize);
      return { body: ratio(document.querySelector(".about__body p:not(.label)")), heads: [...document.querySelectorAll("h1, h2, h3")].filter((e) => e.offsetParent).map(ratio) };
    });
    assert.ok(r.body >= 1.5 && r.body <= 1.62, String(r.body));
    assert.ok(r.heads.every((v) => v >= 0.99 && v <= 1.21), JSON.stringify(r.heads));
  });

  test("#17 running text is never heavier than semibold (600)", async () => {
    const heavy = await home.page.$$eval("main p:not(.label), main li, main label, main .answer, main strong", (els) => els.filter((e) => e.offsetParent && !e.closest(".btn, h1, h2, h3, .price-figure, .readout__total, .label, .spec-card, .extra-time, .estimate-panel__head")).filter((e) => Number(getComputedStyle(e).fontWeight) > 600).map((e) => e.outerHTML.slice(0, 80)));
    assert.deepEqual(heavy, []);
  });

  test("#18 two typefaces at most", async () => {
    const fams = await home.page.evaluate(() => [...new Set([...document.querySelectorAll("body *")].filter((e) => !["SOURCE", "SCRIPT", "TEMPLATE"].includes(e.tagName)).map((e) => getComputedStyle(e).fontFamily.split(",")[0].replace(/["']/g, "").trim()))]);
    assert.ok(fams.length <= 2, JSON.stringify(fams));
    assert.ok(!/JetBrains/.test(INDEX), "no third font loaded");
  });

  test("#19 prices, totals and counters use tabular numbers", async () => {
    const r = await home.page.$$eval(".price-figure, .readout__total, .spec-card strong, .extra-time strong, .readout__lines li", (els) => els.map((e) => getComputedStyle(e).fontVariantNumeric));
    assert.ok(r.length > 8 && r.every((v) => v.includes("tabular-nums")), JSON.stringify(r));
    const t = await rent.page.$eval("#rt-estimate-total", (e) => getComputedStyle(e).fontVariantNumeric);
    assert.match(t, /tabular-nums/);
  });

  test("#20 real typographic characters: curly apostrophes, × , – , …", async () => {
    for (const x of [home, rent]) {
      const texts = await x.page.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const out = []; let n; while ((n = w.nextNode())) { if (!n.parentElement.closest("script, style, noscript") && n.nodeValue.trim()) out.push(n.nodeValue); } return out.join("\n"); });
      assert.ok(!/['"]/.test(texts), "no straight quotes: " + (texts.match(/.{0,30}['"].{0,30}/) || [""])[0]);
      assert.ok(!/\.\.\./.test(texts), "no three-dot ellipsis");
      assert.ok(!/ - /.test(texts), "no hyphen used as a dash");
    }
    const all = INDEX + RENTALS;
    assert.ok(/’/.test(all) && /…/.test(all) && /–/.test(all));
    assert.match(await home.page.textContent("#estimator-lines"), /×/);
  });

  test("#21 headlines use text-wrap: balance", async () => {
    const r = await home.page.$$eval("h1, h2, h3", (els) => els.map((e) => getComputedStyle(e).textWrap || getComputedStyle(e).textWrapStyle));
    assert.ok(r.every((v) => /balance/.test(v)), JSON.stringify(r.slice(0, 4)));
  });

  test("#22 inputs are at least 16px on mobile (no iOS zoom)", async () => {
    const sizes = await mobile.page.$$eval("#booking-form input:not([type=hidden]), #booking-form select, #booking-form textarea", (els) => els.filter((e) => e.offsetParent && e.type !== "radio").map((e) => parseFloat(getComputedStyle(e).fontSize)));
    assert.ok(sizes.length >= 10 && sizes.every((s) => s >= 16), JSON.stringify(sizes));
  });

  test("#23 softened contrast for reading: no pure white on pure black", async () => {
    const r = await home.page.evaluate(() => ({ c: getComputedStyle(document.body).color, b: getComputedStyle(document.body).backgroundColor, p: getComputedStyle(document.querySelector(".about__body p:not(.label)")).color }));
    assert.notEqual(r.c, "rgb(255, 255, 255)");
    assert.notEqual(r.p, "rgb(255, 255, 255)");
    assert.notEqual(r.b, "rgb(0, 0, 0)");
  });

  test("#24 muted text keeps ≥ 4.5:1 contrast on every surface", () => {
    const surfaces = ["--ink-950", "--ink-900", "--ink-850", "--ink-800", "--ink-750", "--plum-900", "--plum-800"].map((k) => tokens[k]);
    for (const t of ["--text-2", "--text-3", "--violet-400"]) for (const s of surfaces) assert.ok(contrast(tokens[t], s) >= 4.5, `${t} on ${s}: ${contrast(tokens[t], s).toFixed(2)}`);
  });
});

/* ================================ Colour and depth ================================ */
describe("Colour and depth", () => {
  test("#25 fixed palette: no color literals outside the :root tokens", () => {
    const lit = BODY_CSS.replace(/url\([^)]*\)/g, "").match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi);
    assert.equal(lit, null, JSON.stringify(lit));
    const palette = Object.keys(tokens).filter((k) => /^#/.test(tokens[k]));
    assert.ok(palette.length >= 15 && palette.length <= 25, String(palette.length));
  });

  test("#26 one accent color, saved for primary actions (blue only for focus rings)", async () => {
    const bgs = await home.page.$$eval(".btn", (els) => [...new Set(els.filter((e) => e.offsetParent).map((e) => getComputedStyle(e).backgroundColor))]);
    const chromatic = bgs.filter((c) => { const m = c.match(/\d+/g).map(Number); return m[3] !== 0 && Math.max(m[0], m[1], m[2]) - Math.min(m[0], m[1], m[2]) > 40; });
    assert.deepEqual(chromatic, ["rgb(124, 58, 237)"]);
    const blueUses = RULES.flatMap((r) => r.decls.filter(([, v]) => v.includes("--blue-500")).map(([p]) => p));
    assert.ok(blueUses.length > 0 && blueUses.every((p) => p === "outline"), JSON.stringify(blueUses));
  });

  test("#27 text ≥ 4.5:1 and field borders ≥ 3:1 (axe color-contrast + token math)", async () => {
    for (const x of [home, rent]) {
      await x.page.addScriptTag({ content: AXE_SRC });
      const v = await x.page.evaluate(async () => (await axe.run(document, { runOnly: ["color-contrast"] })).violations.length);
      assert.equal(v, 0);
    }
    for (const s of ["--ink-950", "--ink-850", "--ink-900"]) assert.ok(contrast(tokens["--grey-500"], tokens[s]) >= 3, s);
    assert.ok(contrast(tokens["--white"], tokens["--violet-600"]) >= 4.5);
  });

  test("#28 meaning never relies on color alone (icons + text + shapes)", async () => {
    const x = await open("index.html");
    await x.page.click('#booking-form button[type="submit"]');
    const err = await x.page.$eval("#bk-name-error", (e) => ({ icon: !!e.querySelector("svg"), text: e.textContent.trim().length }));
    assert.ok(err.icon && err.text > 5);
    const tick = await x.page.$eval("#est-pkg-signature + label .tick", (e) => getComputedStyle(e).opacity);
    assert.equal(tick, "1");
    await x.page.check("#custom-cat-0");
    assert.ok(await x.page.isVisible("#custom-cat-0 + label .i-check"));
    await x.context.close();
  });

  test("#29 borders are light (≤ 15% silver)", () => {
    for (const k of ["--line-1", "--line-2"]) { const pct = Number(tokens[k].match(/(\d+)%/)[1]); assert.ok(pct <= 15, k); }
  });

  test("#30 shadow scale tied to elevation, one light direction (from above)", () => {
    const uses = RULES.flatMap((r) => r.decls.filter(([p]) => p === "box-shadow").map(([, v]) => v));
    assert.ok(uses.length > 5 && uses.every((v) => /^var\(--shadow-[1-4]\)$/.test(v)), JSON.stringify(uses));
    for (const n of [1, 2, 3, 4]) {
      const layers = tokens[`--shadow-${n}`].split(/,\s*(?=0 )/);
      layers.forEach((l) => { const [x, y] = l.trim().split(/\s+/).map(parseFloat); assert.equal(x, 0); assert.ok(y > 0); });
    }
  });

  test("#31 every shadow has two layers: tight + soft", () => {
    for (const n of [1, 2, 3, 4]) {
      const layers = tokens[`--shadow-${n}`].split(/,\s*(?=0 )/).map((l) => l.trim().split(/\s+/).map(parseFloat));
      assert.equal(layers.length, 2);
      assert.ok(layers[1][2] > layers[0][2] * 2, "second layer is softer (bigger blur)");
    }
  });

  test("#32 greys are tinted toward the brand violet", () => {
    for (const k of ["--ink-950", "--ink-900", "--ink-850", "--ink-800", "--ink-750", "--text-1", "--text-2", "--text-3", "--grey-500"]) {
      const [r, , b] = hexToRgb(tokens[k]);
      assert.ok(b > r, `${k} leans blue-violet`);
    }
  });

  test("#33 no heavy gradients or boxes-in-boxes on components", async () => {
    const r = await home.page.$$eval(".btn, .card, .package, .form-card, .desk, .spec-card", (els) => els.map((e) => getComputedStyle(e).backgroundImage).filter((v) => v !== "none"));
    assert.deepEqual(r, []);
    const gradients = (BODY_CSS.match(/linear-gradient|radial-gradient/g) || []).length;
    assert.ok(gradients <= 8, `${gradients} gradients (photo scrims and the fader track only)`);
    assert.ok(!/radial-gradient/.test(BODY_CSS), "no decorative glows");
  });

  test("#34 dark theme designed deliberately: tinted surfaces, desaturated accent text", async () => {
    assert.equal(await home.page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), "dark");
    assert.ok(sat(tokens["--violet-400"]) < sat(tokens["--violet-500"]) || lum(hexToRgb(tokens["--violet-400"])) > lum(hexToRgb(tokens["--violet-500"])));
    assert.notEqual(tokens["--text-1"].toLowerCase(), "#ffffff");
    assert.notEqual(tokens["--ink-950"].toLowerCase(), "#000000");
    assert.match(INDEX, /<meta name="theme-color" content="#08080C">/);
  });
});

/* ================================ Buttons and controls ================================ */
describe("Buttons and controls", () => {
  test("#35 tap targets are at least 44×44px on mobile", async () => {
    const small = await mobile.page.evaluate(() => {
      const sel = "a.btn, button, summary, select, input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=range]), .main-nav a, .mobile-menu a, .footer-grid a, .chip label, .seg label, .equip-check, .aside-contact a, .spec-card__row, .rent-list a, .brand, .contact__item, .text-link";
      return [...document.querySelectorAll(sel)].filter((e) => e.offsetParent && !e.closest(".honeypot, .stepper input, .lightbox") && getComputedStyle(e).visibility !== "hidden").filter((e) => {
        const r = e.getBoundingClientRect();
        return r.height < 44 || r.width < 44;
      }).map((e) => e.outerHTML.slice(0, 90));
    });
    assert.deepEqual(small, []);
  });

  test("#36 only a few button heights: 40/48 on desktop, 44/48 on touch", async () => {
    const d = await home.page.$$eval(".btn", (els) => [...new Set(els.filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height)))].sort());
    assert.ok(d.every((h) => [40, 48].includes(h)), JSON.stringify(d));
    const m = await mobile.page.$$eval(".btn", (els) => [...new Set(els.filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height)))].sort());
    assert.ok(m.every((h) => [44, 48].includes(h)), JSON.stringify(m));
  });

  test("#37 button side padding is about twice the vertical padding", async () => {
    const r = await home.page.$$eval(".btn:not(.btn--icon-end):not(.btn--icon-start)", (els) => els.filter((e) => e.offsetParent).map((e) => parseFloat(getComputedStyle(e).paddingLeft) / parseFloat(getComputedStyle(e).paddingTop)));
    assert.ok(r.length > 5 && r.every((x) => x === 2), JSON.stringify(r));
  });

  test("#38 button labels stay on one line, even at 320px", async () => {
    const x = await open("index.html", { viewport: { width: 320, height: 700 } });
    const r = await x.page.$$eval(".btn", (els) => els.filter((e) => e.offsetParent).map((e) => ({ ws: getComputedStyle(e).whiteSpace, fits: e.scrollWidth <= e.clientWidth + 1 })));
    await x.context.close();
    assert.ok(r.every((b) => b.ws === "nowrap" && b.fits), JSON.stringify(r.filter((b) => !b.fits)));
  });

  test("#39 icon buttons extend their clickable area past the visible circle", async () => {
    const r = await home.page.$eval("#hero-video-toggle", (e) => { const a = getComputedStyle(e, "::after"); return [a.content, a.top, a.left]; });
    assert.deepEqual(r, ['""', "-8px", "-8px"]);
  });

  test("#40 every button state is designed: hover, pressed, focus, loading, disabled, success", async () => {
    for (const s of [":hover::before", ":active", ":focus-visible", ":disabled", '[aria-busy="true"]', '[data-state="success"]']) assert.ok(BODY_CSS.includes(".btn" + s) || BODY_CSS.includes(s), s);
    const x = await open("index.html", { formDelay: 900 });
    await fillBooking(x.page);
    await x.page.click('#booking-form button[type="submit"]');
    assert.equal(await x.page.getAttribute("[data-submit]", "aria-busy"), "true");
    await x.page.waitForSelector('[data-submit][data-state="success"]');
    await x.page.waitForSelector("#booking-success:not([hidden])");
    await x.context.close();
  });

  test("#41 visible focus ring via :focus-visible, never a bare outline: none", async () => {
    assert.ok(!/outline\s*:\s*(none|0)\b/.test(BODY_CSS));
    const x = await open("index.html");
    await x.page.keyboard.press("Tab");
    await x.page.keyboard.press("Tab");
    const r = await x.page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return [document.activeElement.className, cs.outlineStyle, parseFloat(cs.outlineWidth) >= 2]; });
    await x.context.close();
    assert.deepEqual(r, ["brand", "solid", true]);
  });

  test("#42 disabled controls show at ~55% opacity with no hover effect", async () => {
    const x = await open("rentals.html");
    const o = await x.page.$eval('.equip-row [data-step="-1"]', (e) => [e.disabled, getComputedStyle(e).opacity]);
    assert.deepEqual(o, [true, "0.55"]);
    const b = await x.page.evaluate(() => { const btn = document.querySelector("#rental-form [data-submit]"); btn.setAttribute("disabled", ""); const v = getComputedStyle(btn).opacity; btn.removeAttribute("disabled"); return v; });
    assert.equal(b, "0.55");
    assert.ok(BODY_CSS.includes(".btn:not(:disabled):not([aria-busy=\"true\"]):hover::before"));
    await x.context.close();
  });

  test("#43 pressing a button scales it to 0.97", async () => {
    const x = await open("index.html");
    const btn = x.page.locator(".hero .btn--primary");
    const box = await btn.boundingBox();
    await x.page.mouse.move(box.x + 20, box.y + 20);
    await x.page.mouse.down();
    await x.page.waitForTimeout(250);
    const a = await btn.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
    await x.page.mouse.up();
    await x.context.close();
    assert.ok(Math.abs(a - 0.97) < 0.005, String(a));
  });

  test("#44 the pointer cursor appears only on clickable things", async () => {
    const bad = await home.page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => getComputedStyle(e).cursor === "pointer").filter((e) => !e.closest("a, button, label, summary, select, input, [role=button]")).map((e) => e.outerHTML.slice(0, 80)));
    assert.deepEqual(bad, []);
  });

  test("#45 one primary button per view; secondary buttons are quieter", async () => {
    const counts = await home.page.$$eval("main section", (secs) => secs.map((s) => [s.id, [...s.querySelectorAll(".btn--primary")].filter((b) => b.offsetParent).length]));
    assert.ok(counts.every(([, n]) => n <= 1), JSON.stringify(counts));
    const ghost = await home.page.$eval(".hero .btn--ghost", (e) => getComputedStyle(e).backgroundColor);
    assert.equal(ghost, "rgba(0, 0, 0, 0)");
  });

  test("#46 destructive actions are red, confirmed first, and can be undone", async () => {
    const x = await open("index.html");
    await x.page.fill("#bk-name", "Jordan Test");
    const color = await x.page.$eval("[data-clear-form]", (e) => getComputedStyle(e).color);
    assert.equal(color, "rgb(251, 113, 133)");
    await x.page.click("[data-clear-form]");
    assert.ok(await x.page.isVisible("[data-confirm-clear]"), "asks before clearing");
    assert.equal(await x.page.inputValue("#bk-name"), "Jordan Test", "nothing cleared yet");
    await x.page.click("[data-confirm-yes]");
    assert.equal(await x.page.inputValue("#bk-name"), "");
    await x.page.click('.toast button:has-text("Undo")');
    assert.equal(await x.page.inputValue("#bk-name"), "Jordan Test", "undo restores");
    await x.context.close();
  });

  test("#47 double submits are prevented with a disabled, spinning button", async () => {
    const x = await open("index.html", { formDelay: 800 });
    await fillBooking(x.page);
    await x.page.dblclick('#booking-form button[type="submit"]');
    await x.page.waitForSelector("[data-submit] .spinner");
    assert.equal(await x.page.isDisabled("[data-submit]"), true);
    await x.page.waitForSelector("#booking-success:not([hidden])");
    assert.equal(x.posts.length, 1);
    await x.context.close();
  });

  test("#48 links inside body text are underlined", async () => {
    const r = await home.page.$$eval("main p a, .answer a", (els) => els.map((e) => getComputedStyle(e).textDecorationLine));
    assert.ok(r.length >= 4 && r.every((v) => v.includes("underline")), JSON.stringify(r));
  });
});

/* ================================ Forms ================================ */
describe("Forms", () => {
  test("#49 labels sit above inputs and stay visible (placeholders are never the label)", async () => {
    for (const x of [home, rent]) {
      const bad = await x.page.evaluate(() => [...document.querySelectorAll(".inquiry-form .field input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=number][disabled]), .inquiry-form .field select, .inquiry-form .field textarea")].filter((i) => i.offsetParent && !i.closest(".stepper")).filter((i) => {
        const l = document.querySelector(`label[for="${i.id}"]`);
        return !l || !l.offsetParent || l.getBoundingClientRect().bottom > i.getBoundingClientRect().top + 1 || !l.textContent.trim();
      }).map((i) => i.id));
      assert.deepEqual(bad, []);
    }
  });

  test("#50 required fields are marked with * and optional ones say (optional), consistently", async () => {
    for (const x of [home, rent]) {
      const r = await x.page.evaluate(() => [...document.querySelectorAll(".inquiry-form .field")].map((f) => {
        const label = f.querySelector(":scope > label, :scope > .field-label");
        const control = f.querySelector("input:not([type=hidden]), select, textarea, [role=radiogroup], .equip-picker");
        const required = !!f.querySelector("[required], [aria-required=true]") || f.id === "rt-equipment-field";
        return { req: required, star: !!label.querySelector(".req"), opt: !!label.querySelector(".opt"), id: control && control.id };
      }));
      assert.ok(r.every((f) => (f.req ? f.star && !f.opt : f.opt && !f.star)), JSON.stringify(r.filter((f) => !(f.req ? f.star : f.opt))));
    }
  });

  test("#51 fields validate on blur, then re-check live while showing an error", async () => {
    const x = await open("index.html");
    await x.page.fill("#bk-email", "jordan@");
    assert.equal(await x.page.textContent("#bk-email-error"), "", "no error while typing");
    await x.page.focus("#bk-phone");
    assert.match(await x.page.textContent("#bk-email-error"), /email format/);
    await x.page.fill("#bk-email", "jordan@example.com");
    assert.equal(await x.page.textContent("#bk-email-error"), "", "clears as you type");
    await x.context.close();
  });

  test("#52 error messages say how to fix the problem", async () => {
    const x = await open("index.html");
    await x.page.fill("#bk-email", "nope");
    await x.page.fill("#bk-phone", "12");
    await x.page.fill("#bk-date", isoDate(-2));
    await x.page.focus("[data-submit]"); // blur first so the new error line doesn't move the button mid-click
    await x.page.click('#booking-form button[type="submit"]');
    const msgs = await x.page.$$eval("#booking-form .field-error", (els) => els.map((e) => e.textContent.trim()).filter(Boolean));
    await x.context.close();
    assert.equal(msgs.length, 12);
    assert.ok(msgs.every((m) => /^(Enter|Choose|Include|Check|Add|Pick|Tick)\b/.test(m)), JSON.stringify(msgs));
    assert.ok(msgs.some((m) => /like name@example\.com/.test(m)) && msgs.some((m) => /like \(901\) 555-0123/.test(m)));
  });

  test("#53 errors sit by their field, are linked with aria-describedby, and focus moves to the first", async () => {
    const x = await open("index.html");
    await x.page.click('#booking-form button[type="submit"]');
    assert.equal(await x.page.evaluate(() => document.activeElement.id), "bk-name");
    const links = await x.page.$$eval('#booking-form [aria-invalid="true"]', (els) => els.map((e) => { const err = document.getElementById(e.getAttribute("aria-describedby").split(" ").pop()); return err && err.textContent.trim().length > 0 && e.closest(".field").contains(err); }));
    await x.context.close();
    assert.ok(links.length === 12 && links.every(Boolean));
  });

  test("#54 the email typo check waits until typing pauses (debounced)", async () => {
    const x = await open("index.html");
    await x.page.fill("#bk-email", "jordan@gmial.com");
    await x.page.waitForTimeout(250);
    assert.equal(await x.page.isVisible("#bk-email-suggest"), false, "not while typing");
    await x.page.waitForTimeout(600);
    assert.match(await x.page.textContent("#bk-email-suggest"), /Did you mean jordan@gmail\.com\?/);
    await x.page.click("#bk-email-suggest button");
    assert.equal(await x.page.inputValue("#bk-email"), "jordan@gmail.com");
    await x.context.close();
  });

  test("#55 every field has the right type, inputmode and autocomplete", async () => {
    for (const x of [home, rent]) {
      const r = await x.page.evaluate(() => [...document.querySelectorAll(".inquiry-form input:not([type=hidden]):not([type=radio]):not([type=checkbox]), .inquiry-form select, .inquiry-form textarea")].filter((e) => !e.closest(".honeypot")).map((e) => ({ id: e.id, type: e.type, ac: e.getAttribute("autocomplete"), im: e.getAttribute("inputmode") })));
      assert.ok(r.every((f) => f.ac), "autocomplete on every field: " + JSON.stringify(r.filter((f) => !f.ac)));
      const want = { email: ["email", "email"], tel: ["tel", "tel"] };
      r.filter((f) => want[f.type]).forEach((f) => assert.deepEqual([f.ac, f.im], want[f.type], f.id));
      r.filter((f) => f.type === "number").forEach((f) => assert.equal(f.im, "numeric", f.id));
      r.filter((f) => /-name$/.test(f.id)).forEach((f) => assert.equal(f.ac, "name"));
    }
  });

  test("#56 nothing the user typed is cleared after an error", async () => {
    const x = await open("index.html");
    await fillBooking(x.page, { email: "broken" });
    await x.page.click('#booking-form button[type="submit"]');
    assert.equal(await x.page.inputValue("#bk-email"), "broken");
    assert.equal(await x.page.inputValue("#bk-details"), "Mostly hip-hop and R&B.");
    await x.context.close();
    const y = await open("index.html", { formMode: "error" });
    await fillBooking(y.page);
    await y.page.click('#booking-form button[type="submit"]');
    await y.page.waitForSelector("[data-form-alert]:not([hidden])");
    assert.equal(await y.page.inputValue("#bk-name"), "Jordan Test");
    await y.context.close();
  });

  test("#57 error shake stays within 3–5px", async () => {
    const kf = KEYFRAMES.shake;
    const amps = (kf.match(/translateX\((-?\d+)px\)/g) || []).map((m) => Math.abs(parseInt(m.match(/-?\d+/)[0], 10))).filter(Boolean);
    assert.ok(amps.length && amps.every((a) => a >= 3 && a <= 5), JSON.stringify(amps));
    const x = await open("index.html");
    await x.page.click('#booking-form button[type="submit"]');
    assert.equal(await x.page.$eval("[data-submit]", (e) => e.classList.contains("shake")), true);
    await x.context.close();
  });

  test("#58 the success message says what happens next", async () => {
    const x = await open("index.html");
    await fillBooking(x.page);
    await x.page.click('#booking-form button[type="submit"]');
    await x.page.waitForSelector("#booking-success:not([hidden])");
    const steps = await x.page.$$eval("#booking-success .next-steps li", (l) => l.map((x) => x.textContent.trim()));
    await x.context.close();
    assert.equal(steps.length, 3);
    assert.match(steps.join(" "), /Expect a reply at jordan@example\.com/);
  });

  test("#59 text areas are generous and resize vertically only", async () => {
    const r = await home.page.$eval("#bk-details", (e) => [parseFloat(getComputedStyle(e).minHeight), getComputedStyle(e).resize]);
    assert.ok(r[0] >= 160);
    assert.equal(r[1], "vertical");
  });

  test("#60 five or fewer options use segmented choices, not a dropdown", async () => {
    for (const x of [home, rent]) {
      const selects = await x.page.$$eval("select", (s) => s.map((e) => [e.id, [...e.options].filter((o) => o.value).length]));
      assert.ok(selects.every(([, n]) => n > 5), JSON.stringify(selects));
    }
    assert.equal(await home.page.$$eval('input[name="Equipment Needs"]', (r) => r.length), 4);
    assert.equal(await rent.page.$$eval('input[name="Pickup or Delivery"]', (r) => r.length), 2);
  });

  test("#61 password fields get a show/hide toggle (component, auto-applied)", async () => {
    const x = await open("index.html");
    const r = await x.page.evaluate(() => {
      const f = document.createElement("div");
      f.className = "field";
      f.innerHTML = '<label for="t-pw">Password</label><input type="password" id="t-pw" autocomplete="new-password">';
      document.querySelector("#booking-form .form-grid").appendChild(f);
      window.DJM.enhancePasswords(f);
      const btn = f.querySelector(".pw-toggle");
      const before = [btn.textContent, btn.getAttribute("aria-label")];
      btn.click();
      return { before, after: [document.getElementById("t-pw").type, btn.getAttribute("aria-pressed"), btn.textContent] };
    });
    await x.context.close();
    assert.deepEqual(r.before, ["Show", "Show password"]);
    assert.deepEqual(r.after, ["text", "true", "Hide"]);
  });

  test("#62 spam is caught by a hidden honeypot, not a CAPTCHA", async () => {
    assert.match(INDEX, /name="_honey"/);
    assert.match(INDEX, /name="_captcha" value="false"/);
    const x = await open("index.html");
    await fillBooking(x.page);
    await x.page.evaluate(() => { document.getElementById("bk-honey").value = "bot"; });
    await x.page.click('#booking-form button[type="submit"]');
    await x.page.waitForSelector("#booking-success:not([hidden])");
    assert.equal(x.posts.length, 0);
    await x.context.close();
  });
});

/* ================================ Motion and microinteractions ================================ */
describe("Motion and microinteractions", () => {
  test("#63 every input gets a response within 100ms", async () => {
    const ms = await home.page.evaluate(() => {
      const r = document.getElementById("estimator-hours");
      const t0 = performance.now();
      r.value = "2";
      r.dispatchEvent(new Event("input", { bubbles: true }));
      const changed = document.getElementById("estimator-total").textContent;
      return { ms: performance.now() - t0, changed };
    });
    assert.ok(ms.ms < 100, String(ms.ms));
    assert.equal(ms.changed, "$850");
    await home.page.evaluate(() => { const r = document.getElementById("estimator-hours"); r.value = "0"; r.dispatchEvent(new Event("input", { bubbles: true })); });
  });

  test("#64 small transitions last 100–300ms", () => {
    const durTokens = { "--dur-1": 120, "--dur-2": 200, "--dur-3": 300, "--dur-enter": 600 };
    for (const k of ["--dur-1", "--dur-2", "--dur-3"]) assert.equal(px(tokens[k]), durTokens[k]);
    const bad = [];
    for (const r of RULES) for (const [p, v] of r.decls) {
      if (p !== "transition") continue;
      if (/reveal-pending\.is-revealed/.test(r.selector)) continue; // entrance animation, not a small transition
      (v.match(/var\(--dur-[\w]+\)|\d+m?s/g) || []).forEach((d) => { const ms = d.startsWith("var") ? durTokens[d.slice(4, -1)] : px(d) * (d.endsWith("ms") ? 1 : 1000); if (ms < 100 || ms > 300) bad.push(`${r.selector}: ${v}`); });
    }
    assert.deepEqual(bad, []);
  });

  test("#65 actions longer than 300ms show progress", async () => {
    const x = await open("index.html", { formDelay: 1500 });
    await fillBooking(x.page);
    await x.page.click('#booking-form button[type="submit"]');
    await x.page.waitForTimeout(100);
    assert.equal(await x.page.$("[data-submit] .spinner"), null, "fast replies skip the loading state");
    await x.page.waitForTimeout(400);
    assert.ok(await x.page.$("[data-submit] .spinner"));
    assert.match(await x.page.textContent("[data-submit]"), /Sending your request…/);
    await x.context.close();
  });

  test("#66 ease-out to enter, ease-in to exit, never linear (except the spinner)", () => {
    assert.match(tokens["--ease-out"], /cubic-bezier/);
    assert.match(tokens["--ease-in"], /cubic-bezier/);
    const transitions = RULES.flatMap((r) => r.decls.filter(([p]) => p === "transition").map(([, v]) => v));
    assert.ok(transitions.every((v) => !/linear/.test(v) && /var\(--ease-(out|in)\)/.test(v)), JSON.stringify(transitions.filter((v) => /linear/.test(v))));
    const menuClosed = RULES.find((r) => r.selector === ".mobile-menu").decls.find(([p]) => p === "transition")[1];
    const menuOpen = RULES.find((r) => r.selector === ".mobile-menu.is-open").decls.find(([p]) => p === "transition")[1];
    assert.match(menuClosed, /--ease-in\b/);
    assert.match(menuOpen, /--ease-out/);
    assert.match(BODY_CSS, /toast-out var\(--dur-2\) var\(--ease-in\)/);
  });

  test("#67 only transform and opacity are animated", () => {
    const bad = [];
    for (const r of RULES) for (const [p, v] of r.decls) {
      if (p !== "transition") continue;
      v.split(/,(?![^(]*\))/).forEach((part) => { const prop = part.trim().split(/\s+/)[0]; if (!["transform", "opacity"].includes(prop)) bad.push(`${r.selector}: ${prop}`); });
    }
    for (const [name, body] of Object.entries(KEYFRAMES)) body.replace(/([\w-]+)\s*:/g, (_, prop) => { if (!["transform", "opacity"].includes(prop)) bad.push(`@keyframes ${name}: ${prop}`); });
    assert.deepEqual(bad, []);
  });

  test("#68 prefers-reduced-motion is respected", async () => {
    const x = await open("index.html", { reducedMotion: "reduce" });
    await x.page.waitForTimeout(500);
    const r = await x.page.evaluate(() => ({
      video: document.getElementById("hero-video").paused,
      pending: document.querySelectorAll(".reveal-pending").length,
      anim: getComputedStyle(document.querySelector(".hero__content > *")).animationDuration,
    }));
    await x.context.close();
    assert.deepEqual(r, { video: true, pending: 0, anim: "0.001s" });
  });

  test("#69 one signature moment; nothing loops at rest", async () => {
    const x = await open("index.html");
    await x.page.waitForTimeout(2200);
    const infinite = await x.page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity && a.playState === "running").length);
    await x.context.close();
    assert.equal(infinite, 0);
    const loopRules = RULES.filter((r) => r.decls.some(([p, v]) => p === "animation" && /infinite/.test(v))).map((r) => r.selector);
    assert.deepEqual(loopRules.sort(), [".skeleton", ".spinner"], "only loading indicators loop");
    assert.ok(/\.hero__content > \*/.test(BODY_CSS) && KEYFRAMES.settle, "hero intro is the signature moment");
  });

  test("#70 list items stagger by 50ms as they appear", async () => {
    const delays = await home.page.$$eval("#package-cards > *", (els) => els.map((e) => e.style.getPropertyValue("--reveal-delay")));
    assert.deepEqual(delays.slice(0, 4), ["0ms", "50ms", "100ms", "150ms"]);
  });

  test("#71 entrances fade and rise, nothing pops in", async () => {
    const x = await open("index.html");
    const r = await x.page.$eval(".reveal-pending", (e) => [getComputedStyle(e).opacity, new DOMMatrix(getComputedStyle(e).transform).m42]);
    await x.context.close();
    assert.deepEqual(r, ["0", 24]);
    assert.match(KEYFRAMES.rise, /opacity: 0; transform: translateY/);
  });

  test("#72 hover effects are subtle: scale 1.02–1.04", async () => {
    const scales = (BODY_CSS.match(/:hover[^{]*\{[^}]*scale\(([\d.]+)\)/g) || []).map((m) => parseFloat(m.match(/scale\(([\d.]+)\)/)[1]));
    assert.ok(scales.length >= 3 && scales.every((s) => s >= 1.02 && s <= 1.04), JSON.stringify(scales));
    const x = await open("index.html");
    await x.page.hover(".services .card");
    await x.page.waitForTimeout(400);
    const a = await x.page.$eval(".services .card", (e) => new DOMMatrix(getComputedStyle(e).transform).a);
    await x.context.close();
    assert.ok(a >= 1.02 && a <= 1.04, String(a));
  });

  test("#73 toasts auto-dismiss after ~5s, pause on hover, and are never used for errors", async () => {
    const x = await open("index.html");
    await x.page.evaluate(() => window.DJM.toast("Auto toast"));
    await x.page.evaluate(() => window.DJM.toast("Hover toast"));
    await x.page.hover('.toast:has-text("Hover toast")');
    await x.page.waitForTimeout(3500);
    assert.ok(await x.page.isVisible('.toast:has-text("Auto toast")'), "still there at 3.5s");
    await x.page.waitForTimeout(2200);
    assert.equal(await x.page.$('.toast:has-text("Auto toast")'), null, "gone after ~5s");
    assert.ok(await x.page.isVisible('.toast:has-text("Hover toast")'), "paused while hovered");
    await x.context.close();
    const y = await open("index.html", { formMode: "error" });
    await fillBooking(y.page);
    await y.page.click('#booking-form button[type="submit"]');
    await y.page.waitForSelector("[data-form-alert]:not([hidden])");
    assert.equal(await y.page.$(".toast"), null, "errors use an inline alert, not a toast");
    await y.context.close();
  });

  test("#74 safe actions update the UI immediately (no waiting on a server)", async () => {
    const x = await open("index.html");
    const ms = await x.page.evaluate(() => {
      const t0 = performance.now();
      document.querySelector('#estimator-form button[type="submit"]').click();
      return { ms: performance.now() - t0, chip: !document.getElementById("bk-estimate-chip").hidden, toast: !!document.querySelector(".toast") };
    });
    await x.context.close();
    assert.ok(ms.ms < 100 && ms.chip && ms.toast, JSON.stringify(ms));
    assert.equal(x.posts.length, 0);
  });
});

/* ================================ Loading, empty and error states ================================ */
describe("Loading, empty and error states", () => {
  test("#75 fast loads skip the loading state (skeletons wait 300ms before showing)", async () => {
    const skel = RULES.find((r) => r.selector === ".skeleton");
    assert.match(skel.decls.find(([p]) => p === "animation")[1], /var\(--dur-3\) forwards/);
    assert.equal(skel.decls.find(([p]) => p === "opacity")[1], "0");
    assert.equal(await home.page.$$eval(".skeleton", (s) => s.length), 0, "replaced by real content");
  });

  test("#76 slow loads show skeleton screens, not spinners", async () => {
    const x = await open("index.html", { waitUntil: "commit", beforeGoto: (ctx) => ctx.route("**/js/main.js", async (r) => { await new Promise((res) => setTimeout(res, 1600)); r.continue(); }) });
    await x.page.waitForTimeout(900);
    const o = await x.page.$eval("#package-cards .skeleton", (e) => parseFloat(getComputedStyle(e).opacity));
    assert.ok(o > 0.4, String(o));
    assert.equal(await x.page.$("#package-cards .spinner"), null);
    await x.page.waitForSelector("#package-cards .package");
    await x.context.close();
  });

  test("#77 plain-text status messages accompany loading", async () => {
    const x = await open("index.html", { waitUntil: "commit", beforeGoto: (ctx) => ctx.route("**/js/main.js", async (r) => { await new Promise((res) => setTimeout(res, 1600)); r.continue(); }) });
    await x.page.waitForTimeout(900);
    assert.ok(await x.page.isVisible('#package-cards [role="status"]:has-text("Loading packages…")'));
    await x.context.close();
    assert.match(fs.readFileSync(path.join(ROOT, "js/main.js"), "utf8"), /Sending your request…/);
  });

  test("#78 images reserve their space (no layout jump)", async () => {
    for (const x of [home, rent]) {
      const missing = await x.page.$$eval("img, video", (els) => els.filter((e) => !(e.getAttribute("width") && e.getAttribute("height")) && getComputedStyle(e).aspectRatio === "auto").map((e) => e.outerHTML.slice(0, 80)));
      assert.deepEqual(missing, []);
    }
    const x = await open("index.html");
    const cls = await x.page.evaluate(() => new Promise((res) => { let total = 0; new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) total += e.value; })).observe({ type: "layout-shift", buffered: true }); setTimeout(() => res(total), 1500); }));
    await x.context.close();
    assert.ok(cls < 0.1, `CLS ${cls}`);
  });

  test("#79 empty states explain what’s missing and offer a next step", async () => {
    assert.match(await rent.page.textContent("#rt-estimate-empty"), /No equipment selected yet\. Tick the items you need/);
    const cfg = fs.readFileSync(path.join(ROOT, "js/config.js"), "utf8").replace(/gallery: \[[\s\S]*?\n  \],/, "gallery: [],");
    const x = await open("index.html", { beforeGoto: (ctx) => ctx.route("**/js/config.js", (r) => r.fulfill({ contentType: "text/javascript", body: cfg })) });
    const t = await x.page.textContent("#gallery-grid .empty-state");
    const action = await x.page.$("#gallery-grid .empty-state a.btn");
    await x.context.close();
    assert.match(t, /Photos are on the way/);
    assert.ok(action);
  });

  test("#80 the 404 page is branded and leads back home", async () => {
    const x = await open("missing-page");
    assert.match(await x.page.textContent("h1"), /This track skipped/);
    assert.ok(await x.page.$('a[data-href=""]'));
    await x.context.close();
  });

  test("#81 network failures offer a retry and keep the user’s data", async () => {
    const x = await open("index.html", { formMode: "error" });
    await fillBooking(x.page);
    await x.page.click('#booking-form button[type="submit"]');
    await x.page.waitForSelector("[data-form-alert]:not([hidden])");
    assert.match(await x.page.textContent("[data-form-alert]"), /Your details are still here/);
    await x.page.click("[data-retry]");
    await x.page.waitForFunction(() => document.querySelector("[data-submit]").getAttribute("aria-busy") !== "true");
    await x.page.waitForSelector("[data-form-alert]:not([hidden])");
    assert.equal(x.posts.length, 2, "retry re-sent the request");
    assert.equal(await x.page.inputValue("#bk-location"), "Test Venue, Memphis");
    await x.context.close();
  });

  test("#82 long waits show messages that change as time passes", async () => {
    const x = await open("index.html", { formDelay: 4000 });
    await fillBooking(x.page);
    await x.page.click('#booking-form button[type="submit"]');
    await x.page.waitForTimeout(600);
    assert.match(await x.page.textContent("[data-submit]"), /Sending your request…/);
    await x.page.waitForTimeout(2700);
    assert.match(await x.page.textContent("[data-submit]"), /Still sending…/);
    await x.context.close();
    assert.match(fs.readFileSync(path.join(ROOT, "js/main.js"), "utf8"), /Taking longer than usual/);
  });

  test("#83 below-the-fold images lazy-load; the hero loads first with fetchpriority=high", async () => {
    assert.match(INDEX, /rel="preload" as="image" href="assets\/video\/hero-poster\.webp" type="image\/webp" fetchpriority="high"/);
    assert.match(RENTALS, /studio-session-2-1170\.webp" srcset="[^"]+" sizes="100vw" width="1170" height="1181" fetchpriority="high"/);
    const lazy = await home.page.$$eval("main img", (imgs) => imgs.map((i) => i.loading));
    assert.ok(lazy.length > 8 && lazy.every((l) => l === "lazy"), JSON.stringify(lazy));
  });

  test("#84 image placeholders use a color close to the photo", async () => {
    const r = await home.page.$$eval(".gallery__item", (els) => els.map((e) => getComputedStyle(e).backgroundColor));
    const expected = CFG.gallery.map((g) => { const [a, b, c] = [1, 3, 5].map((i) => parseInt(g.placeholder.slice(i, i + 2), 16)); return `rgb(${a}, ${b}, ${c})`; });
    assert.deepEqual(r, expected);
    assert.equal(await home.page.$eval(".about__frame", (e) => getComputedStyle(e).backgroundColor), "rgb(76, 71, 76)");
  });
});

/* ================================ Microcopy ================================ */
describe("Microcopy", () => {
  test("#85 buttons are named for the outcome, never “Submit”", async () => {
    for (const x of [home, rent]) {
      const labels = await x.page.$$eval("button, .btn", (b) => b.map((e) => (e.getAttribute("aria-label") || e.textContent).trim()));
      assert.ok(labels.every((l) => !/^(submit|send|ok|click here|go)$/i.test(l)), JSON.stringify(labels));
    }
    assert.deepEqual([await home.page.textContent("#booking-form [data-submit]"), await rent.page.textContent("#rental-form [data-submit]")].map((s) => s.trim()), ["Request my booking", "Request rental quote"]);
  });

  test("#86 headings put the key words first", async () => {
    const h = await home.page.$$eval("h2", (e) => e.map((x) => x.textContent.trim()));
    for (const want of ["Services for every occasion.", "Equipment rentals for your event.", "Booking questions, answered."]) assert.ok(h.includes(want), want);
    assert.ok((await rent.page.$$eval("h2", (e) => e.map((x) => x.textContent.trim()))).includes("Rental gear and daily rates."));
    const rows = await home.page.$$eval(".spec-card__row > span", (e) => e.map((x) => x.textContent));
    assert.deepEqual(rows, ["DJ packages", "Extra DJ time", "Equipment rentals"]);
  });

  test("#87 sentence case for headings, buttons and navigation", async () => {
    const PROPER = new Set(["I", "DJ", "Meech", "FAQ", "Small", "Party", "Signature", "Experience", "Corporate", "Wedding", "The", "It’s", "I’ll", "Your", "Let’s"]);
    for (const x of [home, rent]) {
      const r = await x.page.$$eval("h1, h2, .btn, .main-nav a, .faq summary", (els) => els.filter((e) => e.offsetParent && !e.closest(".package h3, footer")) /* footer column titles are small caps labels (#14) */.map((e) => ({ t: e.textContent.replace(/\s+/g, " ").trim(), tt: getComputedStyle(e).textTransform })));
      for (const { t, tt } of r) {
        assert.equal(tt, "none", t);
        t.split(/(?<=[.?!])\s+/).forEach((sentence) => sentence.split(" ").slice(1).forEach((w) => { if (/^[A-Z]/.test(w)) assert.ok(PROPER.has(w.replace(/[.,?!]$/, "")), `“${w}” in “${t}”`); }));
      }
    }
  });

  test("#88 numbers are written as numerals", async () => {
    for (const x of [home, rent]) {
      const text = await x.page.evaluate(() => document.body.innerText);
      const m = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi);
      assert.equal(m, null, JSON.stringify(m));
    }
  });

  test("#89 confirmations are personal: “Thanks, Jordan!”", async () => {
    const x = await open("index.html");
    await fillBooking(x.page);
    await x.page.click('#booking-form button[type="submit"]');
    await x.page.waitForSelector("#booking-success:not([hidden])");
    assert.equal(await x.page.textContent("#booking-success h3"), "Thanks, Jordan!");
    await x.context.close();
  });

  test("#90 error messages don’t blame the user or use jargon", async () => {
    const src = fs.readFileSync(path.join(ROOT, "js/main.js"), "utf8") + INDEX + RENTALS;
    const msgs = [...src.matchAll(/setError\([^,]+,\s*"([^"]+)"/g)].map((m) => m[1]).concat([...src.matchAll(/data-required-msg="([^"]+)"/g)].map((m) => m[1]));
    assert.ok(msgs.length >= 8);
    msgs.forEach((m) => assert.ok(!/invalid|wrong|error|illegal|must|failed|you forgot/i.test(m), m));
  });

  test("#91 truncated text keeps the full text available", async () => {
    const x = await open("index.html", { viewport: { width: 360, height: 800 } });
    await x.page.check("#est-pkg-wedding", { force: true });
    await x.page.locator("#estimator-hours").fill("3");
    await x.page.click('#estimator-form button[type="submit"]');
    const r = await x.page.$eval("#bk-estimate-wrap", (e) => ({ ov: getComputedStyle(e).textOverflow, title: e.title, text: e.textContent }));
    await x.context.close();
    assert.equal(r.ov, "ellipsis");
    assert.equal(r.title, r.text, "full text in the title");
  });

  test("#92 recent dates are relative, with the full date on hover", async () => {
    const x = await open("index.html");
    await x.page.fill("#bk-date", isoDate(30));
    const hint = await x.page.$eval("#bk-date-hint", (e) => ({ t: e.textContent, title: e.title }));
    assert.match(hint.t, /in 30 days$/);
    assert.match(hint.title, /\d{4}$/);
    await x.page.fill("#bk-name", "Jordan");
    await x.page.waitForTimeout(800);
    const draft = await x.page.$eval("[data-draft-status]", (e) => ({ t: e.textContent, title: e.title }));
    await x.context.close();
    assert.equal(draft.t, "Draft saved just now");
    assert.match(draft.title, /^Saved on .+ at /);
  });
});

/* ================================ Mobile and accessibility ================================ */
describe("Mobile and accessibility", () => {
  test("#93 key actions sit in thumb reach on mobile (sticky bottom bar)", async () => {
    const x = await open("index.html", { viewport: { width: 390, height: 844 } });
    await x.page.evaluate(() => window.scrollTo(0, 1600));
    await x.page.waitForSelector("#call-bar.is-visible");
    await x.page.waitForTimeout(400);
    const r = await x.page.$eval("#call-bar", (e) => ({ bottom: Math.round(e.getBoundingClientRect().bottom), labels: [...e.querySelectorAll("a")].map((a) => a.textContent.trim()) }));
    await x.context.close();
    assert.equal(r.bottom, 844);
    assert.deepEqual(r.labels, ["Call", "Book DJ Meech"]);
  });

  test("#94 nothing scrolls sideways at 320px", async () => {
    for (const p of ["index.html", "rentals.html", "missing"]) {
      const x = await open(p, { viewport: { width: 320, height: 640 } });
      assert.equal(await x.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, p);
      await x.context.close();
    }
  });

  test("#95 safe areas around notches are respected", () => {
    assert.match(INDEX, /viewport-fit=cover/);
    for (const sel of [".site-header", ".call-bar", ".mobile-menu", ".site-footer", ".toasts"]) {
      const r = RULES.find((x) => x.selector === sel);
      assert.ok(r && /env\(safe-area-inset/.test(r.body), sel);
    }
    assert.match(tokens["--gutter-l"], /safe-area-inset-left/);
    assert.match(tokens["--gutter-r"], /safe-area-inset-right/);
  });

  test("#96 a skip-to-content link is the first thing keyboard users reach", async () => {
    const x = await open("index.html");
    await x.page.keyboard.press("Tab");
    const r = await x.page.evaluate(() => ({ text: document.activeElement.textContent, href: document.activeElement.getAttribute("href"), visible: document.activeElement.getBoundingClientRect().top >= 0 }));
    await x.page.keyboard.press("Enter");
    const focused = await x.page.evaluate(() => document.activeElement.id);
    await x.context.close();
    assert.deepEqual(r, { text: "Skip to content", href: "#main", visible: true });
    assert.equal(focused, "main");
  });

  test("#97 alt text describes purpose; decorative images have empty alt", async () => {
    for (const x of [home, rent]) {
      const imgs = await x.page.$$eval("img", (els) => els.map((e) => ({ alt: e.getAttribute("alt"), deco: !!e.closest('[aria-hidden="true"], .rent-list') })));
      assert.ok(imgs.every((i) => i.alt !== null));
      imgs.filter((i) => i.deco).forEach((i) => assert.equal(i.alt, ""));
      imgs.filter((i) => !i.deco).forEach((i) => assert.ok(i.alt.split(" ").length >= 4, i.alt));
    }
  });

  test("#98 layout holds at 200% zoom and with large system text", async () => {
    for (const p of ["index.html", "rentals.html"]) {
      const x = await open(p, { viewport: { width: 640, height: 450 } }); // 1280×900 at 200%
      assert.equal(await x.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${p} 200% zoom`);
      await x.context.close();
      // larger system text: double the browser's default font size, as an OS/browser setting would
      const y = await open(p, { viewport: { width: 1280, height: 900 }, beforeGoto: async (ctx) => { ctx.on("page", async (pg) => { const cdp = await ctx.newCDPSession(pg); await cdp.send("Page.setFontSizes", { fontSizes: { standard: 32, fixed: 26 } }); }); } });
      await y.page.reload();
      const r = await y.page.evaluate(() => ({ base: parseFloat(getComputedStyle(document.documentElement).fontSize), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, clipped: [...document.querySelectorAll("h1, h2, .btn")].filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 2).length }));
      await y.context.close();
      assert.equal(r.base, 32, "large default font applied");
      delete r.base;
      assert.deepEqual(r, { overflow: 0, clipped: 0 }, `${p} large text`);
    }
  });

  test("#99 icon-only buttons have aria-labels; icons are paired with text", async () => {
    for (const x of [home, rent]) {
      const unlabeled = await x.page.$$eval("button, a", (els) => els.filter((e) => !e.textContent.trim() && !e.getAttribute("aria-label")).map((e) => e.outerHTML.slice(0, 80)));
      assert.deepEqual(unlabeled, []);
    }
    const iconOnly = await home.page.$$eval("button.icon-btn", (b) => b.map((e) => e.getAttribute("aria-label")));
    assert.ok(iconOnly.length >= 4 && iconOnly.every(Boolean));
    const withText = await home.page.$$eval(".btn svg, .contact__item svg, .aside-contact svg", (s) => s.every((e) => e.closest("a, button").textContent.trim().length > 2));
    assert.ok(withText);
  });

  test("#100 favicon, theme-color and Open Graph image are set and load", async () => {
    for (const html of [INDEX, RENTALS]) {
      assert.match(html, /<link rel="icon" href="assets\/img\/favicon\.svg"/);
      assert.match(html, /<meta name="theme-color"/);
      assert.match(html, /<meta property="og:image" content="assets\/img\/og-image\.jpg">/);
      assert.match(html, /<link rel="apple-touch-icon"/);
    }
    for (const f of ["assets/img/favicon.svg", "assets/img/og-image.jpg", "assets/img/apple-touch-icon.png"]) {
      const res = await fetch(state.base + f);
      assert.equal(res.status, 200, f);
    }
  });
});
