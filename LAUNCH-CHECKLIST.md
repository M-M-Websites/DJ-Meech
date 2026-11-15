# Launch checklist

The site is built and tested. The brief asks that DJ Meech approve the items below before the site is published. Each item can be changed in [`js/config.js`](js/config.js) without touching any other file.

## 1. Owner approvals

### DJ packages (proposed)
- [ ] **The Small Party**: from $300, 2 hours, and its 4 inclusions
- [ ] **The Signature Experience**: from $600, 4 hours, its 4 inclusions, and the "Most Popular" label (a suggested feature, not a sales claim)
- [ ] **Corporate Experience**: from $750, 4 hours, and its 4 inclusions
- [ ] **The Wedding Experience**: from $1,200, 5 hours, and its 4 inclusions
- [ ] **Additional DJ time**: from $125/hour (estimator offers 0 to 3 extra hours)
- [ ] Hero line "DJ bookings starting at $300" (updates automatically from the lowest package price)

### Equipment rentals (proposed)
Confirm each item is actually available. Remove or hide (`available: false`) any that aren't.
- [ ] Powered PA Speaker: from $85/day
- [ ] Dual Speaker Package: from $160/day
- [ ] Wireless Microphone System: from $50/day
- [ ] DJ Controller: from $100/day
- [ ] Basic Event Lighting: from $75/day
- [ ] Complete PA System: from $250/day. Confirm contents: two PA speakers, speaker stands, audio mixer, microphone, required cables
- [ ] Delivery & Setup: from $75
- [ ] Equipment pictures are labeled "Illustrative image". Replace with real inventory photos when available.

### Business information
- [ ] Phone (901) 319-7461 and email moorework321@gmail.com
- [ ] Service area / city: **awaiting confirmation**. Once confirmed, set `business.serviceArea`. City keywords can then be added to page titles and descriptions.
- [ ] Photo use: the people shown in the studio photos and video are fine with appearing on the site. They are not named anywhere on the site.

## 2. Technical go-live
- [ ] Deploy the folder to a host (see README → Going live)
- [ ] Run `node scripts/set-domain.mjs https://your-domain.com`, then commit and redeploy
- [ ] Send one test booking from the live site and click **Activate Form** in the FormSubmit email sent to moorework321@gmail.com
- [ ] Send a second test booking and a test rental inquiry. Confirm both emails arrive.
- [ ] Verify the site in Google Search Console and submit `sitemap.xml`
- [ ] Optional: switch `forms.endpointId` to the FormSubmit alias to hide the email address in the page source

## 3. What the site deliberately does not do
- It does not take payments or deposits. No payment system is connected.
- It does not confirm bookings or reserve equipment. The forms only send inquiries.
- It has no reviews, ratings, awards, years of experience, addresses or event history, because none were supplied.
