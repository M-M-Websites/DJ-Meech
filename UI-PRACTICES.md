# 100 UI/UX practices: where each one lives, and the test that proves it

Every practice below is applied in the site and checked by its own automated test in [`tests/practices.test.cjs`](tests/practices.test.cjs). Each test is named `#NN …` to match this list.

```bash
npm run test:practices
```

This runs the 100 checks in headless Chromium. `npm test` runs these plus the 46 functional tests, 146 in total.

Some checks read the stylesheet directly, for example "every spacing value is a token" or "no color literals outside the palette". Most load the real pages and measure them: computed styles, element sizes, contrast, timing, keyboard focus, and form behaviour with the email service mocked.

---

## Spacing and layout

| # | Practice | How it's applied | Where |
|---|---|---|---|
| 1 | Start with generous whitespace | Section padding is 96–160px. Cards use 24–32px insets. | `--section-y`, `.section`, `.package` in `css/styles.css` |
| 2 | Spacing from a fixed scale | `--s-1`…`--s-11` = 4 8 12 16 24 32 48 64 96 128 160. The test fails on any raw px/rem in padding, margin or gap. | `:root` spacing tokens |
| 3 | More space between groups than inside | Section heads: 16px inside, 64px after. Forms: 8px label→input, 24px field→field. | `.section-head`, `.field`, `.form-grid` |
| 4 | Labels clearly belong to their field | 8px label→own input vs ≥24px to the field above (the test measures it) | `.field`, `.form-grid` |
| 5 | Group with whitespace/background before lines | No section dividers. Sections alternate background (`--raised`, `--plum`). FAQ rows and the rental list use tinted rows with gaps instead of hairlines. | `.section--raised`, `.section--plum`, `.faq details`, `.rent-list a` |
| 6 | Consistent widths, radii, font sizes | Radii only `--r-sm/md/lg/pill`. Font sizes only `--fs-*`. All cards share one radius. All inputs share one size. | `:root` radius and type tokens |
| 7 | 50–75 characters per line | `p { max-width: var(--measure) }` with `--measure: 54ch`. Measured at 66–73 chars/line. | `--measure` |
| 8 | Nested radius = outer − padding | Segmented controls 12−4=8. Spec card 20−8=12. Contact card 20−8=12. Stepper 12−4=8. | `.seg label`, `.spec-card__row`, `.contact__item`, `.stepper button` |
| 9 | Optical alignment | Play triangles and trailing arrows are nudged 1px right. | `.i-play`, `.btn--icon-end svg` |
| 10 | Cap content width | `.container` max 1288px, even at 2560px wide | `--container` |
| 11 | Scale section padding with `clamp()` | `--section-y: clamp(96px, 11vw, 160px)` | `--section-y` |
| 12 | Less padding on the icon side | Trailing icon: right padding 16 vs 24. Leading icon: left 16 vs 24. | `.btn--icon-end`, `.btn--icon-start` |

## Typography

| # | Practice | How it's applied | Where |
|---|---|---|---|
| 13 | Tighten large headings | h1 −0.03em, h2 −0.02em | `--ls-tight`, `.hero h1` |
| 14 | Loosen small all-caps labels | `.label`: 12px, uppercase, +0.16em | `.label`, `--ls-label` |
| 15 | Hierarchy by weight and color | Headings 800 in `--text-1`. Body 400 in `--text-2`. Labels violet. | `h1–h4`, `.section-head p`, `.label` |
| 16 | Line-height 1.5–1.6 body, 1.0–1.2 headings | Body 1.6. h1 1.0, h2 1.05, h3 1.2. | `--lh-body`, `--lh-tight` |
| 17 | Running text ≤ semibold | `strong { font-weight: 600 }`; labels 600; body 400 | base styles |
| 18 | Two typefaces at most | Archivo (display/labels) + Manrope (body). The third font was removed. | `--font-display`, `--font-body`, Google Fonts link |
| 19 | Tabular numbers for prices | `font-variant-numeric: tabular-nums` on every price, total and estimate line | `.price-figure`, `.readout__total`, `.estimate-panel` |
| 20 | Real typographic characters | Curly ’ “ ”, × in estimates, – in ranges, … in loading text. The test scans every visible text node for straight quotes, `...` and ` - `. | HTML, `js/main.js`, `js/config.js` |
| 21 | No lonely last word | `text-wrap: balance` on h1–h4 | base `h1, h2, h3, h4` |
| 22 | Inputs ≥ 16px on mobile | Every input, select and textarea is `--fs-md` (16px). | `.field input…` |
| 23 | Soften pure black/white | Text `#f2f0f7` on `#08080c`, never #fff on #000 | `--text-1`, `--ink-950` |
| 24 | Muted text ≥ 4.5:1 | `--text-2` 9:1, `--text-3` ≥5.6:1 on every surface (the test checks all 7 surfaces) | `--text-2`, `--text-3` |

## Colour and depth

| # | Practice | How it's applied | Where |
|---|---|---|---|
| 25 | Fixed palette | 20 named shades in `:root`. Tints are `color-mix()` of them. The test fails on any hex/rgb/hsl outside `:root`. | `:root` palette |
| 26 | One accent, for primary actions | Violet is the only filled-button colour. Electric Blue is used only for focus outlines. | `.btn--primary`, `:focus-visible` |
| 27 | Text ≥ 4.5:1, UI edges ≥ 3:1 | axe-core color-contrast passes on both pages. Field borders `--grey-500` ≥ 3:1. White on violet 5.7:1. | `--grey-500`, `--violet-600` |
| 28 | Never color alone | Errors = red + alert icon + text. Selected options show a check mark. Chips switch + to ✓. | `setError()` in `js/main.js`, `.seg .tick`, `.chip .i-check` |
| 29 | Light borders | Lines are 9% / 14% silver. | `--line-1`, `--line-2` |
| 30 | Shadow scale, one light direction | `--shadow-1…4`, all offsets x=0, y>0 (light from above). Every `box-shadow` uses a token. | `:root` elevation tokens |
| 31 | Two-layer shadows | Each token = tight layer + soft, larger-blur layer | `--shadow-1…4` |
| 32 | Tint greys toward the brand | Every grey has blue > red (violet bias). | `--ink-*`, `--text-*`, `--grey-500` |
| 33 | Avoid heavy gradients and boxes in boxes | No gradients on buttons or cards, and no decorative glows. Only photo scrims and the fader track use gradients. | `.btn`, `.card`, `.hero__shade` |
| 34 | Deliberate dark mode | Dark-first palette with tinted surfaces, a lighter violet for text, and `color-scheme: dark` plus `theme-color`. Not an inversion. | `:root`, `<meta name="theme-color">` |

## Buttons and controls

| # | Practice | How it's applied | Where |
|---|---|---|---|
| 35 | Tap targets ≥ 44×44 | Nav, footer and contact links, chips, steppers and icon buttons all have `min-height`/`min-width: var(--tap)`. The test measures every control on mobile. | `--tap` |
| 36 | Few button heights | 40 (small) and 48 (default). Small becomes 44 on touch screens. | `--btn-h-sm`, `--btn-h-md`, `@media (pointer: coarse)` |
| 37 | Side padding ≈ 2× vertical | 12/24 and 8/16 | `.btn`, `.btn--sm` |
| 38 | One-line labels | `white-space: nowrap`. The test checks every button fits at 320px wide. | `.btn` |
| 39 | Invisible extra hit area | Icon buttons have an `::after` extending 8px past the circle. | `.icon-btn::after` |
| 40 | Every state designed | Hover layer, pressed scale, focus ring, loading (spinner + text), disabled (55%), success (green "Sent ✓") | `.btn` states; `initForm()` in `js/main.js` |
| 41 | Visible `:focus-visible` ring | 2px Electric Blue outline. The stylesheet contains no `outline: none`. | `:focus-visible`, `.btn:focus-visible` |
| 42 | Disabled = ~55% opacity, no hover | `.btn:disabled`, `.stepper button:disabled` at 0.55. Hover only applies `:not(:disabled)`. | `.btn:disabled` |
| 43 | Press scales to 0.97 | `:active { transform: scale(0.97) }` (measured while held down) | `.btn`, `.icon-btn`, `.stepper button` |
| 44 | Pointer cursor only on clickables | The test walks every element with `cursor: pointer` and checks it's a link, button, label, summary or input. | `css/styles.css` |
| 45 | One primary per view | Each section has at most 1 violet button. The rest are ghost or quiet. | all sections |
| 46 | Destructive = red + confirm or undo | "Clear form" is red, asks "Clear everything…?", and then offers **Undo**. Removing an estimate also offers Undo. | `[data-clear-form]`, `toast()` in `js/main.js` |
| 47 | No double submits | Button disabled and `aria-busy`, with an inline spinner while sending (the test double-clicks and gets 1 request) | `initForm()` |
| 48 | Underline links in body text | `p a`, `.answer a` underlined | base link styles |

## Forms

| # | Practice | How it's applied | Where |
|---|---|---|---|
| 49 | Labels above, always visible | Every field has a visible `<label>` above it. Placeholders are only examples. | form markup |
| 50 | Consistent required/optional marking | Required fields get `*` and the one optional field says "(optional)". The test checks every field. | `.req`, `.opt` |
| 51 | Validate on blur, re-check while typing | Errors appear on blur and clear live as you fix them. | `initForm()` |
| 52 | Errors say how to fix | For example "Include the area code, like (901) 555-0123." Every message starts with an action word. | `validateField()` |
| 53 | Inline errors, linked, focus first | Error under each field, `aria-describedby` + `aria-invalid`, focus moves to the first problem | `setError()`, submit handler |
| 54 | Delay checks until typing pauses | Email typo hint ("Did you mean …@gmail.com?") is debounced 600ms. The draft autosave is debounced too. | `initEmailHelp()`, `debounce()` |
| 55 | Right type, inputmode, autocomplete | `email`/`tel`/`numeric`/`name`/`street-address`/`off` set on every field | form markup |
| 56 | Never clear input after an error | Validation and network failures keep every value. Drafts survive a reload. | `initForm()`, drafts |
| 57 | Error shake 3–5px | 4px shake on the submit button for an invalid submit (skipped for reduced motion) | `@keyframes shake` |
| 58 | Success says what's next | 3-item "what happens next" list, including where the reply will arrive | `.next-steps` |
| 59 | Generous text areas, vertical resize only | `min-height: 160px; resize: vertical` | `.field textarea` |
| 60 | ≤ 5 options → chips, not dropdowns | "Equipment needs" (4) and "Pickup or delivery" (2) are segmented controls. Only 6+ options use selects. | `.segmented` |
| 61 | Password show/hide toggle | `enhancePasswords()` adds an accessible Show/Hide toggle to any password field. The site has no accounts, so it's tested on an injected field. | `enhancePasswords()`, `.pw-toggle` |
| 62 | Honeypot, not CAPTCHA | Hidden `_honey` field. Bots are dropped silently and `_captcha=false`. | form markup, `initForm()` |

## Motion and microinteractions

| # | Practice | How it's applied | Where |
|---|---|---|---|
| 63 | Respond within 100ms | Estimator, steppers and chips update synchronously (measured < 100ms). | `initEstimator()` |
| 64 | Small transitions 100–300ms | `--dur-1/2/3` = 120/200/300ms. The test rejects any transition outside that range. | motion tokens |
| 65 | Show progress after 300ms | The spinner and "Sending your request…" appear only if sending takes > 300ms. | submit timers in `initForm()` |
| 66 | Ease out to enter, in to exit | `--ease-out` for entrances, `--ease-in` for the menu closing and toasts leaving. No linear easing (except the spinner's rotation). | motion tokens |
| 67 | Animate only transform and opacity | Hover backgrounds and shadows fade in on pseudo-element layers through opacity. The test parses every transition and keyframe. | `.btn::before`, `.card::after` |
| 68 | Respect reduced motion | Video stays paused, no reveals, near-zero durations | `@media (prefers-reduced-motion)`, `initHeroVideo()` |
| 69 | One signature moment | The hero intro (staggered rise + slow video settle). Nothing loops at rest. | `.hero__content > *`, `@keyframes settle` |
| 70 | Stagger 30–60ms | Group items reveal 50ms apart. | `initReveal()` |
| 71 | Fade-and-rise entrances | Opacity 0 → 1 with a 24px rise. Nothing pops in. | `.reveal-pending`, `@keyframes rise` |
| 72 | Subtle hover scale 1.02–1.04 | Cards and rental rows 1.02, gallery photos 1.03 | `.card-hover:hover`, `.gallery__item:hover img` |
| 73 | Toasts auto-dismiss 4–6s, pause on hover | 5s, paused on hover or focus. Errors use inline alerts, never toasts. | `toast()` |
| 74 | Update the UI immediately where safe | Attaching an estimate, presets and undo are instant and local. Submissions wait for the server, because claiming delivery early isn't safe. | `attachEstimate()`, `toast()` |

## Loading, empty and error states

| # | Practice | How it's applied | Where |
|---|---|---|---|
| 75 | Skip loading states when fast | Skeletons stay invisible for 300ms and are replaced before then on a normal load. | `.skeleton` |
| 76 | Skeletons, not spinners, for content | Packages, rental catalog and gallery start as skeleton cards. | `index.html`, `rentals.html` |
| 77 | Plain-text status | "Loading packages…", "Loading photos…", "Sending your request…" | `.loading-status`, submit label |
| 78 | Reserve image space | Every `img`/`video` has width and height or an aspect-ratio. Measured layout shift < 0.1. | markup, render functions |
| 79 | Helpful empty states | The rental estimate explains what to do before anything is ticked. Empty packages, catalog or gallery show a message and an action. | `#rt-estimate-empty`, `emptyState()` |
| 80 | Branded 404 with a way home | `404.html` with Home and Rentals buttons that work in a sub-folder | `404.html` |
| 81 | Network failure → retry, keep data | Inline alert with **Try again**, the phone number and an "Email these details instead" link. All values are kept. | `showFailure()` |
| 82 | Changing messages for long waits | "Sending your request…" → "Still sending…" (3s) → "Taking longer than usual…" (8s) | submit timers |
| 83 | Lazy-load below the fold; hero first | All lower images use `loading="lazy"`. The hero poster and rentals hero use `fetchpriority="high"`. | `<head>` preload, `rentals.html` |
| 84 | Placeholder colour close to the image | Each photo's average colour (`--ph`) shows while it loads. | `.ph`, `placeholder` in `js/config.js` |

## Microcopy

| # | Practice | How it's applied | Where |
|---|---|---|---|
| 85 | Buttons named for the outcome | "Request my booking", "Request rental quote", "Build my event package". No "Submit". | markup |
| 86 | Key words first in headings | "Services for every occasion", "Equipment rentals for your event", "Booking questions, answered", "Rental gear and daily rates" | headings |
| 87 | Sentence case | Headings, buttons and nav are sentence case. Caps appear only in small labels (#14). | markup, no `text-transform` on headings or buttons |
| 88 | Numerals for numbers | "2 PA speakers", "Up to 4 hours". The test scans all visible text for spelled-out numbers. | `js/config.js`, markup |
| 89 | Personal confirmations | "Thanks, Jordan!" uses the first name from the form. | `showSuccess()` |
| 90 | Errors don't blame or use jargon | No "invalid", "wrong", "error" or "must" in any message | `validateField()`, `data-required-msg` |
| 91 | Keep truncated text available | A long attached-estimate line is ellipsized, and the full text is in its `title`. | `#bk-estimate-wrap` |
| 92 | Relative dates, full date on hover | "Wednesday, December 16 · in 30 days" and "Draft saved just now", each with the full date in a `title` | `initDateHint()`, drafts |

## Mobile and accessibility

| # | Practice | How it's applied | Where |
|---|---|---|---|
| 93 | Key actions in thumb reach | Sticky bottom bar on mobile: **Call** + **Book DJ Meech** | `.call-bar` |
| 94 | No sideways scroll at 320px | Checked on home, rentals and the 404 page at 320px | responsive rules |
| 95 | Respect notch safe areas | `viewport-fit=cover`, plus `env(safe-area-inset-*)` on gutters, header, menu, bottom bar, toasts and footer | `--gutter-l/r` etc. |
| 96 | Skip-to-content link | First Tab stop, visible on focus, moves focus to `<main>` | `.skip-link` |
| 97 | Purposeful alt text; decorative = empty | Photos describe the scene. Background and thumbnail images use `alt=""`. | markup, render functions |
| 98 | Works at 200% zoom and large system text | Breakpoints are in `em`, so they follow the browser's font setting. The test runs at 640px (200% zoom) and with a 32px default font. | `@media (max-width: …em)` |
| 99 | Icons paired with text; icon-only buttons labelled | Every icon-only button has an `aria-label`. Other icons sit next to text. | `.icon-btn`, toasts, lightbox |
| 100 | Favicon, theme-color, OG image | SVG favicon, Apple touch icon, `theme-color`, 1200×630 Open Graph image, all checked to load | `<head>` |

---

### Where a practice needed judgement

- **#61 Password toggle.** The site has no passwords because there are no accounts. The reusable toggle is built in and applies itself to any password field added later. The test proves it on an injected field.
- **#74 Optimistic UI.** It's applied where it's safe (local actions). Form submissions deliberately wait for the email service, because showing "sent" before it's confirmed would mislead the customer.
- **#86 / #87 Brief wording.** Headings the client brief specifies (for example "Choose your experience.") keep its wording, in sentence case. New headings put the key word first.
- **#2 Spacing scale.** The one non-token value is the range slider's thumb offset (`margin-top: -13px` on `::-webkit-slider-thumb`). That's browser geometry for centring the thumb, not layout spacing, so the test skips it explicitly.
