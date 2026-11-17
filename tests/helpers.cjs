/* Shared test setup: static server, browser, page opener, form filler. */
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { createServer } = require("./server.cjs");

const ROOT = path.join(__dirname, "..");
const CONFIG_SRC = fs.readFileSync(path.join(ROOT, "js/config.js"), "utf8");
const CFG = (() => { const window = {}; eval(CONFIG_SRC); return window.DJ_MEECH; })();
const FORM_URL = "https://formsubmit.co/ajax/moorework321@gmail.com";

const state = { server: null, base: null, browser: null };

async function setup() {
  state.server = createServer();
  await new Promise((r) => state.server.listen(0, "127.0.0.1", r));
  state.base = `http://127.0.0.1:${state.server.address().port}/`;
  state.browser = await chromium.launch();
  return state;
}
async function teardown() {
  await state.browser.close();
  await new Promise((r) => state.server.close(r));
}

function isoDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Opens a page with fonts blocked (offline-safe) and the form endpoint mocked.
 *  formMode: "success" | "error" | "activation"; formDelay: ms before the mock replies */
async function open(pagePath = "index.html", opts = {}) {
  const { viewport = { width: 1440, height: 900 }, formMode = "success", formDelay = 0, reducedMotion = "no-preference", contextOptions = {}, beforeGoto, waitUntil = "load" } = opts;
  const context = await state.browser.newContext({ viewport, reducedMotion, ...contextOptions });
  const errors = [];
  const posts = [];
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await context.route("https://formsubmit.co/**", async (route) => {
    const req = route.request();
    posts.push({ url: req.url(), method: req.method(), headers: req.headers(), body: req.postDataJSON() });
    if (formDelay) await new Promise((r) => setTimeout(r, formDelay));
    if (formMode === "error") return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ success: "false", message: "Server error" }) });
    if (formMode === "activation") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: "false", message: "This form needs Activation." }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: "true", message: "The form was submitted successfully." }) });
  });
  // CSS smooth scrolling moves the page while Playwright aims a click; tests scroll instantly.
  await context.addInitScript(() => {
    const s = document.createElement("style");
    s.textContent = "html{scroll-behavior:auto!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s));
  });
  if (beforeGoto) await beforeGoto(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/fonts\.g|ERR_FAILED/.test(m.text() + (m.location().url || ""))) errors.push("console: " + m.text());
  });
  page.on("requestfailed", (r) => { if (!/fonts\.g/.test(r.url())) errors.push("requestfailed: " + r.url() + " " + (r.failure() && r.failure().errorText)); });
  page.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(state.base)) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.goto(state.base + pagePath, { waitUntil });
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
  await page.check(`input[name="Equipment Needs"][value="${v.equipment}"]`, { force: true });
  await page.fill("#bk-details", v.details);
}

async function fillRental(page) {
  await page.fill("#rt-name", "Sam Renter");
  await page.fill("#rt-email", "sam@example.com");
  await page.fill("#rt-phone", "9015550199");
  await page.check("#rt-item-complete-pa");
  await page.fill("#rt-start", isoDate(5));
  await page.fill("#rt-return", isoDate(6));
  await page.dispatchEvent("#rt-return", "change");
  await page.fill("#rt-location", "Community Hall");
  await page.check("#rt-handoff-pickup", { force: true });
  await page.fill("#rt-details", "Outdoor afternoon event.");
}

module.exports = { ROOT, CFG, FORM_URL, state, setup, teardown, isoDate, open, fillBooking, fillRental };
