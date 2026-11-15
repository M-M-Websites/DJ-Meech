/* End-to-end tests for the DJ Meech website.
   Run with: npm test   (uses the Playwright + Chromium already on the machine) */
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { createServer } = require("./server.cjs");

const ROOT = path.join(__dirname, "..");
const AXE_SRC = fs.readFileSync(require.resolve("axe-core/axe.min.js", { paths: [ROOT] }), "utf8");
const CONFIG_SRC = fs.readFileSync(path.join(ROOT, "js/config.js"), "utf8");
const CFG = (() => { const window = {}; eval(CONFIG_SRC); return window.DJ_MEECH; })();
const FORM_URL = "https://formsubmit.co/ajax/moorework321@gmail.com";

let server, base, browser;

before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});
after(async () => {
  await browser.close();
  await new Promise((r) => server.close(r));
});

function isoDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Opens a page with fonts blocked (offline-safe) and the form endpoint mocked.
 *  formMode: "success" | "error" | "activation" */
async function open(pagePath = "index.html", { viewport = { width: 1440, height: 900 }, formMode = "success", reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion });
  const errors = [];
  const posts = [];
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await context.route("https://formsubmit.co/**", async (route) => {
    const req = route.request();
    posts.push({ url: req.url(), method: req.method(), headers: req.headers(), body: req.postDataJSON() });
    if (formMode === "error") return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ success: "false", message: "Server error" }) });
    if (formMode === "activation") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: "false", message: "This form needs Activation." }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: "true", message: "The form was submitted successfully." }) });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/fonts\.g|ERR_FAILED/.test(m.text() + (m.location().url || ""))) errors.push("console: " + m.text());
  });
  page.on("requestfailed", (r) => {
    if (!/fonts\.g/.test(r.url())) errors.push("requestfailed: " + r.url() + " " + (r.failure() && r.failure().errorText));
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith(base)) errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  await page.goto(base + pagePath, { waitUntil: "load" });
  return { page, context, errors, posts };
}

async function fillBooking(page, overrides = {}) {
  const v = Object.assign({
    name: "Jordan Test",
    email: "jordan@example.com",
    phone: "9015550123",
    type: "Birthday Party",
    pkg: "The Small Party",
    date: isoDate(30),
    guests: "60",
    start: "19:00",
    end: "23:00",
    location: "Test Venue, Memphis",
    equipment: "Need sound equipment",
    details: "Mostly hip-hop and R&B.",
  }, overrides);
  await page.fill("#bk-name", v.name);
  await page.fill("#bk-email", v.email);
  await page.fill("#bk-phone", v.phone);
  await page.selectOption("#bk-event-type", v.type);
  if (v.pkg) await page.selectOption("#bk-package", v.pkg);
  await page.fill("#bk-date", v.date);
  await page.fill("#bk-guests", v.guests);
  await page.fill("#bk-start", v.start);
  await page.fill("#bk-end", v.end);
  await page.fill("#bk-location", v.location);
  await page.selectOption("#bk-equipment", v.equipment);
  await page.fill("#bk-details", v.details);
}

/* ---------------------------------------------------------------- */
describe("pages load cleanly", () => {
  for (const p of ["index.html", "rentals.html"]) {
    test(`${p}: no console errors, failed requests or 404s`, async () => {
      const { page, context, errors } = await open(p);
      await page.waitForLoadState("networkidle");
      // scroll through so lazy media loads too
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
      });
      await page.waitForLoadState("networkidle");
      const broken = await page.$$eval("img", (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
      assert.deepEqual(broken, [], "broken images");
      assert.deepEqual(errors, []);
      await context.close();
    });
  }

  test("404 page is served for unknown URLs", async () => {
    const { page, context } = await open("does-not-exist");
    assert.match(await page.textContent("h1"), /track skipped/i);
    assert.equal(await page.getAttribute('meta[name="robots"]', "content"), "noindex");
    await context.close();
  });
});

describe("SEO", () => {
  test("home page metadata matches the brief", async () => {
    const { page, context } = await open("index.html");
    assert.equal(await page.title(), "DJ Meech | DJ Booking & Equipment Rentals");
    assert.equal(
      await page.getAttribute('meta[name="description"]', "content"),
      "Book DJ Meech for your next event. Explore DJ packages, equipment rental options, and estimated starting prices. Request your personalized quote today."
    );
    await context.close();
  });

  for (const p of ["index.html", "rentals.html"]) {
    test(`${p}: one H1, ordered headings, alt text, valid JSON-LD, indexable`, async () => {
      const { page, context } = await open(p);
      assert.equal(await page.locator("h1").count(), 1);
      const levels = await page.$$eval("h1,h2,h3,h4", (hs) => hs.map((h) => Number(h.tagName[1])));
      for (let i = 1; i < levels.length; i++) assert.ok(levels[i] - levels[i - 1] <= 1, `heading level jumps from h${levels[i - 1]} to h${levels[i]}`);
      const missingAlt = await page.$$eval("img", (imgs) => imgs.filter((i) => !i.hasAttribute("alt")).map((i) => i.src));
      assert.deepEqual(missingAlt, []);
      const ld = await page.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => x.textContent));
      assert.ok(ld.length >= 1);
      ld.forEach((t) => JSON.parse(t));
      assert.match(await page.getAttribute('meta[name="robots"]', "content"), /index, follow/);
      assert.ok((await page.getAttribute('meta[name="description"]', "content")).length > 80);
      await context.close();
    });
  }

  test("titles and descriptions are unique per page", async () => {
    const a = await open("index.html");
    const b = await open("rentals.html");
    assert.notEqual(await a.page.title(), await b.page.title());
    assert.notEqual(await a.page.getAttribute('meta[name="description"]', "content"), await b.page.getAttribute('meta[name="description"]', "content"));
    await a.context.close();
    await b.context.close();
  });
});

describe("contact details and links", () => {
  for (const p of ["index.html", "rentals.html"]) {
    test(`${p}: every phone and email link is correct, every internal link resolves`, async () => {
      const { page, context } = await open(p);
      const tel = await page.$$eval('a[href^="tel:"]', (as) => as.map((a) => a.getAttribute("href")));
      const mail = await page.$$eval('a[href^="mailto:"]', (as) => as.map((a) => a.getAttribute("href")));
      assert.ok(tel.length >= 4 && tel.every((h) => h === "tel:+19013197461"), JSON.stringify(tel));
      assert.ok(mail.length >= 3 && mail.every((h) => h === "mailto:moorework321@gmail.com"), JSON.stringify(mail));
      const text = await page.textContent("body");
      assert.ok(text.includes("(901) 319-7461"));
      assert.ok(text.includes("moorework321@gmail.com"));

      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
      const ids = new Set(await page.$$eval("[id]", (els) => els.map((e) => e.id)));
      const others = {};
      for (const href of hrefs) {
        if (/^(tel|mailto|https?):/.test(href)) continue;
        const [file, hash] = href.split("#");
        if (!file) { assert.ok(ids.has(hash), `missing #${hash} on ${p}`); continue; }
        assert.ok(fs.existsSync(path.join(ROOT, file)), `missing file ${file}`);
        if (hash) (others[file] = others[file] || new Set()).add(hash);
      }
      for (const [file, hashes] of Object.entries(others)) {
        const o = await open(file);
        const oIds = new Set(await o.page.$$eval("[id]", (els) => els.map((e) => e.id)));
        for (const h of hashes) assert.ok(oIds.has(h), `missing #${h} on ${file}`);
        await o.context.close();
      }
      await context.close();
    });
  }
});

describe("navigation", () => {
  test("desktop nav shows all six items and both action buttons", async () => {
    const { page, context } = await open("index.html");
    const items = await page.$$eval(".main-nav a", (as) => as.map((a) => a.textContent.trim().toUpperCase()));
    assert.deepEqual(items, ["HOME", "ABOUT", "DJ BOOKINGS", "EQUIPMENT RENTALS", "GALLERY", "CONTACT"]);
    assert.ok(await page.isVisible('.header-actions a:has-text("Book DJ Meech")'));
    assert.ok(await page.isVisible('.header-actions a:has-text("Rent Equipment")'));
    await page.click('.main-nav a:has-text("Gallery")');
    await page.waitForFunction(() => Math.abs(document.getElementById("gallery").getBoundingClientRect().top) < 150);
    await page.waitForFunction(() => document.querySelector('.main-nav a[data-nav="gallery"]').hasAttribute("aria-current"));
    assert.ok(await page.evaluate(() => document.getElementById("site-header").classList.contains("is-solid")));
    await context.close();
  });

  test("rentals page marks Equipment Rentals as current", async () => {
    const { page, context } = await open("rentals.html");
    assert.equal(await page.getAttribute('.main-nav a[data-nav="rentals"]', "aria-current"), "page");
    await context.close();
  });

  test("mobile menu opens, traps nothing visible behind, closes on Escape and on link tap", async () => {
    const { page, context } = await open("index.html", { viewport: { width: 390, height: 844 } });
    assert.equal(await page.isVisible(".main-nav"), false);
    const toggle = page.locator(".menu-toggle");
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    await page.waitForSelector("#mobile-menu.is-open");
    assert.ok(await page.evaluate(() => document.body.classList.contains("menu-open")));
    await page.keyboard.press("Escape");
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    await page.waitForFunction(() => document.getElementById("mobile-menu").hidden);
    await toggle.click();
    await page.click('#mobile-menu a:has-text("DJ Bookings")');
    await page.waitForFunction(() => document.getElementById("mobile-menu").hidden);
    await page.waitForFunction(() => Math.abs(document.getElementById("bookings").getBoundingClientRect().top) < 150);
    await context.close();
  });

  test("no horizontal scrolling at any common screen width", async () => {
    for (const width of [320, 375, 414, 768, 1024, 1280, 1920]) {
      for (const p of ["index.html", "rentals.html"]) {
        const { page, context } = await open(p, { viewport: { width, height: 900 } });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.equal(overflow, 0, `${p} overflows by ${overflow}px at ${width}px`);
        await context.close();
      }
    }
  });
});

describe("hero", () => {
  test("copy, buttons and starting price match the brief", async () => {
    const { page, context } = await open("index.html");
    assert.equal((await page.textContent("h1")).replace(/\s+/g, " ").trim().toUpperCase(), "YOUR EVENT. YOUR SOUND. YOUR VIBE.");
    assert.match(await page.textContent(".hero__eyebrow"), /The DJ Meech Experience/i);
    assert.match(await page.textContent(".hero"), /From unforgettable celebrations to professional event sound/);
    assert.match((await page.textContent(".hero__price")).replace(/\s+/g, " "), /DJ bookings starting at \$300/i);
    assert.ok(await page.isVisible('.hero a:has-text("Book DJ Meech")'));
    assert.ok(await page.isVisible('.hero a:has-text("View Rental Equipment")'));
    await context.close();
  });

  test("background video plays muted and can be paused", async () => {
    const { page, context } = await open("index.html");
    await page.waitForFunction(() => { const v = document.getElementById("hero-video"); return v.currentTime > 0.3 && !v.paused; }, null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => document.getElementById("hero-video").muted), true);
    await page.click("#hero-video-toggle");
    assert.equal(await page.evaluate(() => document.getElementById("hero-video").paused), true);
    assert.equal(await page.getAttribute("#hero-video-toggle", "aria-pressed"), "true");
    await page.click("#hero-video-toggle");
    await page.waitForFunction(() => !document.getElementById("hero-video").paused);
    await context.close();
  });

  test("video stays paused for visitors who prefer reduced motion", async () => {
    const { page, context } = await open("index.html", { reducedMotion: "reduce" });
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => document.getElementById("hero-video").paused), true);
    assert.match(await page.textContent("#hero-video-toggle .sr-only"), /Play/);
    await context.close();
  });
});

describe("DJ packages", () => {
  test("four package cards with the right names, prices, durations and buttons", async () => {
    const { page, context } = await open("index.html");
    const cards = await page.$$eval(".package", (els) => els.map((el) => ({
      name: el.querySelector("h3").textContent.trim(),
      price: el.querySelector(".price-figure").textContent.trim(),
      meta: el.querySelector(".package__meta").textContent.trim(),
      badge: el.querySelector(".package__badge") ? el.querySelector(".package__badge").textContent.trim() : null,
      cta: el.querySelector(".btn").textContent.trim(),
      items: el.querySelectorAll(".check-list li").length,
    })));
    assert.deepEqual(cards.map((c) => c.name), ["The Small Party", "The Signature Experience", "Corporate Experience", "The Wedding Experience"]);
    assert.deepEqual(cards.map((c) => c.price), ["$300", "$600", "$750", "$1,200"]);
    assert.deepEqual(cards.map((c) => c.meta), ["2 hours", "4 hours", "4 hours", "5 hours"]);
    assert.deepEqual(cards.map((c) => c.badge), [null, "Most Popular", null, null]);
    assert.deepEqual(cards.map((c) => c.cta), ["Book This Package", "Book This Package", "Request Corporate Booking", "Request Wedding Booking"]);
    assert.ok(cards.every((c) => c.items === 4));
    const note = await page.textContent(".pricing-note");
    assert.match(note, /All prices shown are estimated starting rates\. Final pricing depends on event details, duration, location, equipment requirements, and availability\. Sound equipment, lighting, delivery, and other services may cost extra\. Contact us for a personalized quote\./);
    assert.match(note.replace(/\s+/g, " "), /From \$125 ?\/hour/);
    await context.close();
  });

  test("'Request Wedding Booking' fills the booking form with the wedding package", async () => {
    const { page, context } = await open("index.html");
    await page.click('.package a:has-text("Request Wedding Booking")');
    assert.equal(await page.inputValue("#bk-package"), "The Wedding Experience");
    assert.equal(await page.inputValue("#bk-event-type"), "Wedding");
    await page.waitForFunction(() => Math.abs(document.getElementById("book").getBoundingClientRect().top) < 150);
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === "bk-name");
    await context.close();
  });

  test("service links preset the booking form", async () => {
    const { page, context } = await open("index.html");
    await page.click('.service:has-text("Corporate Events")');
    assert.equal(await page.inputValue("#bk-package"), "Corporate Experience");
    await context.close();
  });
});

describe("budget estimator", () => {
  test("every package × extra-hours combination totals correctly", async () => {
    const { page, context } = await open("index.html");
    assert.equal(await page.textContent("#estimator-total"), "$600", "defaults to the featured package");
    const rate = CFG.extraHour.price;
    for (const p of CFG.packages) {
      await page.check(`#est-pkg-${p.id}`, { force: true });
      for (let i = 0; i < CFG.extraHour.options.length; i++) {
        await page.locator("#estimator-hours").fill(String(i));
        const expected = "$" + (p.price + CFG.extraHour.options[i] * rate).toLocaleString("en-US");
        assert.equal(await page.textContent("#estimator-total"), expected, `${p.name} + ${i}h`);
      }
    }
    await context.close();
  });

  test("matches the brief's example: Signature + 1 hour = $725, and keyboard works", async () => {
    const { page, context } = await open("index.html");
    await page.focus("#estimator-hours");
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.textContent("#estimator-total"), "$725");
    assert.match(await page.textContent(".desk"), /This estimate is not a confirmed quote\. Equipment, travel, setup, event requirements, and other fees may affect the final price\./);
    await context.close();
  });

  test("'Request My Custom Quote' carries package and estimate into the booking form", async () => {
    const { page, context, posts } = await open("index.html");
    await page.check("#est-pkg-wedding", { force: true });
    await page.locator("#estimator-hours").fill("2");
    await page.click('button:has-text("Request My Custom Quote")');
    assert.equal(await page.inputValue("#bk-package"), "The Wedding Experience");
    assert.equal(await page.inputValue("#bk-est-total"), "$1,450");
    assert.equal(await page.inputValue("#bk-est-hours"), "2");
    assert.ok(await page.isVisible("#bk-estimate-chip"));
    assert.match(await page.textContent("#bk-estimate-text"), /The Wedding Experience \+ 2 extra hours = \$1,450/);

    await fillBooking(page, { pkg: null, type: "Wedding" });
    await page.click('#booking-form button[type="submit"]');
    await page.waitForSelector("#booking-success:not([hidden])");
    assert.equal(posts.length, 1);
    assert.equal(posts[0].body["Estimated DJ Service Total"], "$1,450");
    assert.equal(posts[0].body["Selected DJ Package"], "The Wedding Experience");
    await context.close();
  });

  test("changing the package in the form drops a stale estimate", async () => {
    const { page, context } = await open("index.html");
    await page.click('button:has-text("Request My Custom Quote")');
    assert.ok(await page.isVisible("#bk-estimate-chip"));
    await page.selectOption("#bk-package", "The Small Party");
    assert.equal(await page.isVisible("#bk-estimate-chip"), false);
    assert.equal(await page.inputValue("#bk-est-total"), "");
    await context.close();
  });
});

describe("custom event packages", () => {
  test("chosen categories flow into the booking form", async () => {
    const { page, context } = await open("index.html");
    assert.match(await page.textContent("#custom"), /Custom pricing available/i);
    const cats = await page.$$eval("#custom-categories label", (l) => l.map((x) => x.textContent));
    assert.deepEqual(cats, ["Large Private Events", "Corporate Events", "Weddings", "Community Events", "Custom Audio Requirements"]);
    await page.check("#custom-cat-2"); // Weddings
    await page.check("#custom-cat-4"); // Custom Audio Requirements
    await page.click('button:has-text("Build My Event Package")');
    assert.equal(await page.inputValue("#bk-package"), "Custom Event Package");
    assert.equal(await page.inputValue("#bk-event-type"), "Wedding");
    assert.equal(await page.inputValue("#bk-custom-cats"), "Weddings, Custom Audio Requirements");
    assert.match(await page.inputValue("#bk-details"), /Weddings, Custom Audio Requirements/);
    await context.close();
  });
});

describe("booking form", () => {
  test("has every required field and the optional budget", async () => {
    const { page, context } = await open("index.html");
    const required = await page.$$eval("#booking-form [required]", (els) => els.map((e) => document.querySelector(`label[for="${e.id}"]`).textContent.replace("*", "").trim()));
    assert.deepEqual(required, ["Full Name", "Email Address", "Phone Number", "Event Type", "Selected DJ Package", "Event Date", "Estimated Guest Count", "Event Start Time", "Event End Time", "Event Location", "Equipment Needs", "Additional Details"]);
    assert.equal(await page.getAttribute("#bk-budget", "required"), null);
    assert.equal((await page.textContent('#booking-form button[type="submit"]')).trim(), "Request My Booking");
    await context.close();
  });

  test("empty submit shows errors, focuses the first problem and sends nothing", async () => {
    const { page, context, posts } = await open("index.html");
    await page.click('#booking-form button[type="submit"]');
    assert.equal(await page.evaluate(() => document.activeElement.id), "bk-name");
    assert.equal(await page.locator("#booking-form .field.is-invalid").count(), 12);
    assert.equal(await page.getAttribute("#bk-email", "aria-invalid"), "true");
    assert.match(await page.getAttribute("#bk-email", "aria-describedby"), /bk-email-error/);
    assert.equal(posts.length, 0);
    await context.close();
  });

  test("rejects a bad email, short phone number and past date", async () => {
    const { page, context, posts } = await open("index.html");
    await fillBooking(page, { email: "not-an-email", phone: "555", date: isoDate(-3) });
    await page.click('#booking-form button[type="submit"]');
    assert.match(await page.textContent("#bk-email-error"), /email address/);
    assert.match(await page.textContent("#bk-phone-error"), /area code/);
    assert.match(await page.textContent("#bk-date-error"), /today or a future date/);
    assert.equal(posts.length, 0);
    // fixing the email clears its error as you type
    await page.fill("#bk-email", "ok@example.com");
    assert.equal(await page.textContent("#bk-email-error"), "");
    await context.close();
  });

  test("valid submission sends everything to DJ Meech's inbox and shows the confirmation", async () => {
    const { page, context, posts } = await open("index.html");
    await fillBooking(page, { budget: "" });
    await page.fill("#bk-budget", "$500");
    await page.click('#booking-form button[type="submit"]');
    await page.waitForSelector("#booking-success:not([hidden])");
    assert.equal(posts.length, 1);
    const { url, method, body, headers } = posts[0];
    assert.equal(url, FORM_URL);
    assert.equal(method, "POST");
    assert.equal(headers.accept, "application/json");
    assert.deepEqual(
      { name: body.name, email: body.email, phone: body.phone, type: body["Event Type"], pkg: body["Selected DJ Package"], guests: body["Estimated Guest Count"], start: body["Event Start Time"], end: body["Event End Time"], loc: body["Event Location"], eq: body["Equipment Needs"], details: body["Additional Details"], budget: body["Estimated Event Budget"] },
      { name: "Jordan Test", email: "jordan@example.com", phone: "(901) 555-0123", type: "Birthday Party", pkg: "The Small Party", guests: "60", start: "19:00", end: "23:00", loc: "Test Venue, Memphis", eq: "Need sound equipment", details: "Mostly hip-hop and R&B.", budget: "$500" }
    );
    assert.equal(body["Event Date"], isoDate(30));
    assert.equal(body._subject, "New DJ booking request — DJ Meech website");
    assert.equal(body._honey, undefined, "honeypot is never sent");
    assert.equal(
      (await page.textContent("#booking-success p")).trim(),
      "Thank you for your booking request! DJ Meech will review your event details and contact you regarding pricing and availability."
    );
    assert.equal(await page.isVisible("#booking-form"), false);
    // "Send another request" brings back a clean form
    await page.click('button:has-text("Send another request")');
    assert.ok(await page.isVisible("#booking-form"));
    assert.equal(await page.inputValue("#bk-name"), "");
    await context.close();
  });

  test("a server failure keeps the form and offers phone and email fallbacks", async () => {
    const { page, context, posts } = await open("index.html", { formMode: "error" });
    await fillBooking(page);
    await page.click('#booking-form button[type="submit"]');
    await page.waitForSelector("#booking-form [data-form-alert]:not([hidden])");
    assert.equal(posts.length, 1);
    assert.ok(await page.isVisible("#booking-form"));
    assert.equal(await page.isVisible("#booking-success"), false);
    const fallback = await page.getAttribute('#booking-form [data-form-alert] a[href^="mailto:"]', "href");
    assert.match(fallback, /^mailto:moorework321@gmail\.com\?subject=DJ%20booking%20request&body=/);
    assert.match(decodeURIComponent(fallback), /Event Location: Test Venue, Memphis/);
    assert.ok(await page.$('#booking-form [data-form-alert] a[href="tel:+19013197461"]'));
    assert.equal(await page.isDisabled('#booking-form button[type="submit"]'), false, "user can retry");
    await context.close();
  });

  test("an un-activated form endpoint is treated as a failure, not a fake success", async () => {
    const { page, context } = await open("index.html", { formMode: "activation" });
    await fillBooking(page);
    await page.click('#booking-form button[type="submit"]');
    await page.waitForSelector("#booking-form [data-form-alert]:not([hidden])");
    assert.equal(await page.isVisible("#booking-success"), false);
    await context.close();
  });

  test("spam bots that fill the hidden field are dropped silently", async () => {
    const { page, context, posts } = await open("index.html");
    await fillBooking(page);
    await page.evaluate(() => { document.getElementById("bk-honey").value = "spam"; });
    await page.click('#booking-form button[type="submit"]');
    await page.waitForSelector("#booking-success:not([hidden])");
    assert.equal(posts.length, 0);
    await context.close();
  });

  test("double-clicking submit sends one request", async () => {
    const { page, context, posts } = await open("index.html");
    await fillBooking(page);
    await page.dblclick('#booking-form button[type="submit"]');
    await page.waitForSelector("#booking-success:not([hidden])");
    await page.waitForTimeout(300);
    assert.equal(posts.length, 1);
    await context.close();
  });
});

describe("equipment rentals", () => {
  test("catalog shows six items with images, starting prices, descriptions and buttons", async () => {
    const { page, context } = await open("rentals.html");
    assert.equal((await page.textContent("h1")).trim().toUpperCase(), "PROFESSIONAL SOUND. YOUR EVENT.");
    const cards = await page.$$eval(".rent-card", (els) => els.map((el) => ({
      name: el.querySelector("h3").textContent.trim(),
      price: el.querySelector(".price-figure").textContent.trim(),
      img: !!el.querySelector("img[alt]"),
      tag: !!el.querySelector(".media-tag"),
      desc: el.querySelector(".rent-card__desc").textContent.trim().length > 20,
      cta: el.querySelector(".btn").textContent.trim(),
    })));
    assert.deepEqual(cards.map((c) => c.name), ["Powered PA Speaker", "Dual Speaker Package", "Wireless Microphone System", "DJ Controller", "Basic Event Lighting", "Complete PA System"]);
    assert.deepEqual(cards.map((c) => c.price), ["$85/day", "$160/day", "$50/day", "$100/day", "$75/day", "$250/day"]);
    assert.ok(cards.every((c) => c.img && c.tag && c.desc && c.cta === "Request Rental"));
    const pa = await page.$$eval("#complete-pa .check-list li", (l) => l.map((x) => x.textContent));
    assert.deepEqual(pa, ["Two PA speakers", "Speaker stands", "Audio mixer", "Microphone", "Required cables"]);
    assert.match((await page.textContent(".delivery-band")).replace(/\s+/g, " "), /Delivery & Setup.*Delivery and setup subject to availability, equipment requirements, and event location\..*Starting at ?\$75/);
    await context.close();
  });

  test("home page preview links each item to its card in the catalog", async () => {
    const { page, context } = await open("index.html");
    const links = await page.$$eval("#rental-preview a", (as) => as.map((a) => a.getAttribute("href")));
    assert.deepEqual(links, CFG.rentals.map((r) => "rentals.html#" + r.id));
    await page.click('#rental-preview a:has-text("Complete PA System")');
    await page.waitForURL(/rentals\.html#complete-pa/);
    await page.waitForFunction(() => { const r = document.getElementById("complete-pa").getBoundingClientRect(); return r.top >= 0 && r.top < window.innerHeight; });
    await context.close();
  });

  test("'Request Rental' pre-selects the item; steppers and estimate update live", async () => {
    const { page, context } = await open("rentals.html");
    await page.click('#dual-speakers a:has-text("Request Rental")');
    assert.equal(await page.isChecked("#rt-item-dual-speakers"), true);
    assert.ok(await page.isVisible("#rt-estimate"));
    assert.equal(await page.textContent("#rt-estimate-total"), "$160");

    await page.check("#rt-item-wireless-mic");
    await page.click('.equip-row[data-id="wireless-mic"] [data-step="1"]');
    assert.equal(await page.inputValue("#rt-qty-wireless-mic"), "2");
    // 160 + 2×50 = 260/day
    assert.equal(await page.textContent("#rt-estimate-total"), "$260");

    await page.fill("#rt-start", isoDate(10));
    await page.fill("#rt-return", isoDate(13));
    await page.dispatchEvent("#rt-return", "change");
    // 3 days × 260 = 780
    assert.equal(await page.textContent("#rt-estimate-total"), "$780");
    await page.check("#rt-handoff-delivery", { force: true });
    assert.equal(await page.textContent("#rt-estimate-total"), "$855");
    assert.match(await page.textContent("#rt-estimate"), /excludes potential taxes, delivery fees, setup charges, and refundable deposits/);

    // quantity can't go below 1 or be typed out of range
    await page.click('.equip-row[data-id="dual-speakers"] [data-step="-1"]', { force: true });
    assert.equal(await page.inputValue("#rt-qty-dual-speakers"), "1");
    await page.fill("#rt-qty-dual-speakers", "999");
    await page.dispatchEvent("#rt-qty-dual-speakers", "change");
    assert.equal(await page.inputValue("#rt-qty-dual-speakers"), "20");

    // unticking removes it from the estimate
    await page.uncheck("#rt-item-dual-speakers");
    await page.uncheck("#rt-item-wireless-mic");
    assert.equal(await page.isVisible("#rt-estimate"), false);
    await context.close();
  });

  test("validation: needs equipment, pickup/delivery and a return date on/after start", async () => {
    const { page, context, posts } = await open("rentals.html");
    await page.click('#rental-form button[type="submit"]');
    assert.match(await page.textContent("#rt-equipment-error"), /at least one item/);
    assert.match(await page.textContent("#rt-handoff-error"), /pickup or delivery/);
    assert.equal(await page.evaluate(() => document.activeElement.id), "rt-name");
    await page.fill("#rt-start", isoDate(10));
    await page.dispatchEvent("#rt-start", "change");
    await page.fill("#rt-return", isoDate(8));
    await page.dispatchEvent("#rt-return", "blur");
    await page.click('#rental-form button[type="submit"]');
    assert.match(await page.textContent("#rt-return-error"), /before the start date/);
    assert.equal(posts.length, 0);
    await context.close();
  });

  test("valid rental inquiry is sent with items, quantities and estimate, then confirmed", async () => {
    const { page, context, posts } = await open("rentals.html");
    await page.fill("#rt-name", "Sam Renter");
    await page.fill("#rt-email", "sam@example.com");
    await page.fill("#rt-phone", "+1 901 555 0199");
    await page.check("#rt-item-complete-pa");
    await page.check("#rt-item-event-lighting");
    await page.click('.equip-row[data-id="event-lighting"] [data-step="1"]');
    await page.fill("#rt-start", isoDate(5));
    await page.fill("#rt-return", isoDate(6));
    await page.dispatchEvent("#rt-return", "change");
    await page.fill("#rt-location", "Community Hall");
    await page.check("#rt-handoff-pickup", { force: true });
    await page.fill("#rt-details", "Outdoor afternoon event.");
    assert.equal(await page.textContent("#rt-estimate-total"), "$400"); // 250 + 2×75, 1 day, pickup
    await page.click('#rental-form button[type="submit"]');
    await page.waitForSelector("#rental-success:not([hidden])");
    assert.equal(posts.length, 1);
    const b = posts[0].body;
    assert.equal(posts[0].url, FORM_URL);
    assert.equal(b["Requested Equipment"], "Basic Event Lighting × 2; Complete PA System × 1");
    assert.equal(b["Preliminary Estimate"], "$400 (1 day)");
    assert.equal(b["Pickup or Delivery"], "Pickup");
    assert.equal(b["Rental Start Date"], isoDate(5));
    assert.equal(b["Rental Return Date"], isoDate(6));
    assert.equal(b.phone, "(901) 555-0199");
    assert.equal(b._subject, "New equipment rental inquiry — DJ Meech website");
    assert.equal(
      (await page.textContent("#rental-success p")).trim(),
      "Your rental inquiry has been received! We'll contact you to discuss equipment availability and confirm pricing."
    );
    await context.close();
  });

  test("?item= deep link pre-selects equipment", async () => {
    const { page, context } = await open("rentals.html?item=dj-controller#rent");
    assert.equal(await page.isChecked("#rt-item-dj-controller"), true);
    await context.close();
  });
});

describe("gallery", () => {
  test("shows the client's photos and the clip, opens a full-screen viewer with keyboard controls", async () => {
    const { page, context } = await open("index.html");
    const captions = await page.$$eval(".gallery__caption > span:first-child", (s) => s.map((x) => x.textContent));
    assert.deepEqual(captions, CFG.gallery.map((g) => g.caption));
    assert.ok(captions.includes("Inside the Studio") && captions.includes("Behind the Sound") && captions.includes("The Creative Process"));

    const first = page.locator(".gallery__item").first();
    await first.click();
    await page.waitForSelector("#lightbox[open]");
    assert.equal(await page.textContent("#lightbox-count"), "1 / 4");
    assert.equal(await page.textContent("#lightbox-caption"), CFG.gallery[0].caption);
    await page.waitForFunction(() => { const i = document.querySelector("#lightbox-stage img"); return i && i.complete && i.naturalWidth > 1000; });
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.textContent("#lightbox-count"), "2 / 4");
    await page.click("[data-lightbox-next]");
    assert.ok(await page.$("#lightbox-stage video[controls]"), "third item is the video clip");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await page.textContent("#lightbox-count"), "4 / 4", "wraps around");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#lightbox:not([open])", { state: "attached" });
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains("gallery__item")), true, "focus returns to the photo");
    await context.close();
  });
});

describe("FAQ", () => {
  test("five questions that expand to the brief's answers", async () => {
    const { page, context } = await open("index.html");
    const qs = await page.$$eval(".faq summary", (s) => s.map((x) => x.textContent.trim()));
    assert.deepEqual(qs, ["How much does DJ Meech charge?", "Does DJ Meech provide equipment rentals?", "How do I reserve an event date?", "Can I customize my DJ package?", "Does DJ Meech travel?"]);
    const summary = page.locator(".faq summary").nth(4);
    assert.equal(await page.isVisible(".faq details:nth-child(5) .answer"), false);
    await summary.click();
    assert.ok(await page.isVisible(".faq details:nth-child(5) .answer"));
    assert.match(await page.textContent(".faq details:nth-child(5) .answer"), /Include your event location in your inquiry so travel availability and costs can be discussed\./);
    await context.close();
  });
});

describe("content guardrails", () => {
  test("no fake reviews, ratings, addresses or invented claims", async () => {
    for (const p of ["index.html", "rentals.html"]) {
      const { page, context } = await open(p);
      const text = (await page.textContent("body")).toLowerCase();
      for (const banned of ["testimonial", "★", "5 stars", "rated", "years of experience", "award", "certified", "lorem", "guarantee"]) {
        assert.ok(!text.includes(banned), `${p} contains "${banned}"`);
      }
      await context.close();
    }
  });

  test("contact section has all three buttons", async () => {
    const { page, context } = await open("index.html");
    const btns = await page.$$eval("#contact .btn-row .btn", (b) => b.map((x) => x.textContent.trim().toUpperCase()));
    assert.deepEqual(btns, ["CALL NOW", "REQUEST BOOKING", "RENT EQUIPMENT"]);
    assert.match(await page.textContent("#contact h2"), /Your next event starts here\./i);
    await context.close();
  });
});

describe("accessibility (axe-core, WCAG 2.1 AA)", () => {
  for (const [p, vp] of [["index.html", { width: 1440, height: 900 }], ["rentals.html", { width: 1440, height: 900 }], ["index.html", { width: 390, height: 844 }], ["rentals.html", { width: 390, height: 844 }]]) {
    test(`${p} @ ${vp.width}px has no violations`, async () => {
      const { page, context } = await open(p, { viewport: vp, reducedMotion: "reduce" });
      await page.addScriptTag({ content: AXE_SRC });
      const result = await page.evaluate(async () => {
        // eslint-disable-next-line no-undef
        const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map((n) => n.target.join(" ") + " :: " + n.failureSummary.split("\n").slice(0, 2).join(" ")) }));
      });
      assert.deepEqual(result, [], JSON.stringify(result, null, 2));
      await context.close();
    });
  }
});
