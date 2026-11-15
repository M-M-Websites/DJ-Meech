# DJ Meech: Website

The website for **DJ Meech**: DJ booking packages, a budget estimator, an equipment rental catalog, booking and rental inquiry forms, a photo and video gallery, an FAQ and contact details.

It's a static site (plain HTML, CSS and JavaScript). There's no build step, database or server code, so it runs on any static host.

| Page | What's on it |
|---|---|
| `index.html` | Hero video, About, Services, DJ packages, budget estimator, custom events, rental preview, gallery, FAQ, booking form, contact |
| `rentals.html` | Equipment catalog, delivery and setup, rental inquiry form with a live estimate, contact |
| `404.html` | Branded "page not found" page |

---

## Editing content (no coding needed)

**Every price, package, rental item, gallery photo and contact detail lives in one file: [`js/config.js`](js/config.js).**
Change it once and the price cards, estimator, rental estimate and form dropdowns all update together.

| To… | Edit in `js/config.js` |
|---|---|
| Change a package price or inclusion | `packages[]`: `price`, `hours`, `inclusions` |
| Move the "Most Popular" label | set `badge: "Most Popular"` on one package and `badge: null` on the rest |
| Change the extra-hour rate | `extraHour.price` |
| Change a rental price or description | `rentals[]` |
| Hide a package or rental item without deleting it | `available: false` |
| Swap an illustration for a real equipment photo | put the photo in `assets/img/`, set `image` to its path and `illustrative: false` |
| Change the delivery & setup price | `delivery.price` |
| Add a gallery photo | add an entry to `gallery[]` (see below) |
| Show a service area once confirmed | `business.serviceArea: "Memphis, TN and surrounding areas"` (example) |

Prices are plain numbers: `1200`, not `"$1,200"`.

### Adding a gallery photo

1. Export the photo as WebP, about 1170px wide (and optionally a 640px copy for phones).
2. Put it in `assets/img/`.
3. Add an entry to `gallery` in `js/config.js`:

```js
{
  type: "image",
  src: "assets/img/event-photo-1170.webp",
  srcSmall: "assets/img/event-photo-640.webp",
  width: 1170,
  height: 1462,
  alt: "Dance floor lit in purple during an evening reception",
  caption: "Reception Night",
},
```

Describe what's in the picture. Don't name people unless they've agreed to it.

---

## Booking and rental forms

Both forms email the inquiry to the address in `forms.endpointId` (currently `moorework321@gmail.com`) through [FormSubmit](https://formsubmit.co). FormSubmit is free and needs no account or server.

**One-time activation (required before launch):**
1. Put the site online and send one test inquiry from the live site.
2. FormSubmit emails an **"Activate Form"** message to `moorework321@gmail.com`. Click the button in it.
3. From then on, every booking and rental request arrives in that inbox as a formatted email. Reply to it directly; the reply-to address is the customer's email.

Until the form is activated, a visitor who submits sees a clear message with the phone number and a one-tap "Email these details instead" link, so no inquiry is lost.

**Optional:** after activation, FormSubmit offers a random alias (like `a1b2c3d4e5…`). Put it in `forms.endpointId` to keep the email address out of the page source.

Neither form takes payment or confirms a booking. They only send an inquiry.

---

## Going live

Upload the folder to any static host. Good free options:

- **Netlify** or **Cloudflare Pages**: drag-and-drop the folder, or connect this GitHub repo.
- **GitHub Pages**: Settings → Pages → Deploy from branch → `main` / root.

Upload everything except `node_modules/`, `tests/` and `package*.json`, which are only for development. Uploading them does no harm.

Then point the SEO tags at the real domain (one command, needs Node.js):

```bash
node scripts/set-domain.mjs https://www.your-domain.com
```

This writes `sitemap.xml`, adds it to `robots.txt`, and sets canonical, `og:url` and absolute social-image URLs on each page. Commit and redeploy afterwards.

### Google Search Console

1. Add the domain as a property at <https://search.google.com/search-console>.
2. Pick the **HTML tag** method and paste the `<meta name="google-site-verification" …>` tag where the comment says so near the top of `index.html`.
3. After verifying, submit `https://www.your-domain.com/sitemap.xml` under **Sitemaps**.

---

## Previewing and testing locally

Requires Node.js 18 or newer.

```bash
npm start
```

Then open <http://localhost:8080>.

The automated test suite drives both pages in headless Chromium. It covers navigation, the estimator math, form validation and submission (the email service is mocked, so no real emails are sent), the rental estimate, the gallery viewer, layout at seven screen widths, broken links and images, SEO tags, and a WCAG 2.1 AA accessibility audit with axe-core.

```bash
npm install
npm test
```

Playwright with Chromium must be available (`npm i -D playwright && npx playwright install chromium` on a fresh machine).

---

## Project layout

```
index.html            Home page
rentals.html          Equipment rental page
404.html              Not-found page
css/styles.css        All styles (brand colors and fonts are tokens at the top)
js/config.js          ← all editable content and prices
js/main.js            Rendering, estimator, forms, gallery, navigation
assets/               Original client video and photos (kept as supplied)
assets/img/           Web-optimized photos, equipment illustrations, icons, social image
assets/video/         Web-optimized hero video (WebM + MP4) and poster
scripts/set-domain.mjs  Sets the live domain for SEO files
tests/                Automated end-to-end tests and local preview server
LAUNCH-CHECKLIST.md   Items the owner must approve before launch
```

## Brand

| Token | Color |
|---|---|
| Midnight Black | `#08080C` |
| Dark Purple | `#1A102C` |
| Electric Purple | `#8B5CF6` |
| Electric Blue | `#3B82F6` |
| Platinum Silver | `#C0C0C0` |
| White | `#FFFFFF` |

Type: Archivo (headlines), Manrope (body), JetBrains Mono (labels and figures), all from Google Fonts.
