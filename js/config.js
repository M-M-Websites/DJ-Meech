/* ==========================================================================
   DJ MEECH — SITE CONTENT & PRICING
   --------------------------------------------------------------------------
   This is the ONE file a website manager edits to change prices, packages,
   rental inventory, gallery photos or contact details. Every price card,
   the booking estimator, the rental estimate and the form dropdowns read
   from here, so a change made once shows up everywhere.

   - Prices are whole US dollars (no "$", no commas): 1200, not "$1,200".
   - To hide a package or rental item without deleting it, set
     `available: false`.
   - To add a gallery photo, put the image in /assets/img/ and add an entry
     to `gallery` below.
   ========================================================================== */

window.DJ_MEECH = {
  business: {
    name: "DJ Meech",
    phoneDisplay: "(901) 319-7461",
    phoneHref: "tel:+19013197461",
    email: "moorework321@gmail.com",
    // Leave null until the owner confirms a service area. When set, it is
    // shown in the contact section and footer.
    serviceArea: null,
  },

  /* Form delivery. Inquiries are emailed to `business.email` through
     FormSubmit (https://formsubmit.co), which needs no server.
     The FIRST submission sends a one-time "Activate form" email to the
     inbox; the owner must click it before inquiries start arriving.
     After activation FormSubmit offers a random alias for the address;
     paste it into `endpointId` to keep the email out of the page source. */
  forms: {
    provider: "formsubmit",
    endpointId: "moorework321@gmail.com",
  },

  /* DJ booking packages (shown on the home page, used by the estimator
     and the booking form). */
  packages: [
    {
      id: "small-party",
      name: "The Small Party",
      price: 300,
      hours: 2,
      badge: null,
      description:
        "Ideal for smaller celebrations, birthday gatherings, and intimate events.",
      inclusions: [
        "Up to 2 hours of DJ performance",
        "Event music preference consultation",
        "Personalized music selection",
        "Basic event coordination",
      ],
      cta: "Book this package",
      eventType: "Birthday Party",
      available: true,
    },
    {
      id: "signature",
      name: "The Signature Experience",
      price: 600,
      hours: 4,
      badge: "Most Popular",
      description:
        "Bring energy to birthday parties, private celebrations, and special occasions with an extended DJ experience.",
      inclusions: [
        "Up to 4 hours of DJ performance",
        "Event music planning",
        "Personalized playlist preferences",
        "Event coordination",
      ],
      cta: "Book this package",
      eventType: "Private Celebration",
      available: true,
    },
    {
      id: "corporate",
      name: "Corporate Experience",
      price: 750,
      hours: 4,
      badge: null,
      description:
        "Music and entertainment for professional gatherings, company celebrations, and corporate events.",
      inclusions: [
        "Up to 4 hours of DJ performance",
        "Music planning based on event atmosphere",
        "Event schedule coordination",
        "Music preference consultation",
      ],
      cta: "Request corporate booking",
      eventType: "Corporate Event",
      available: true,
    },
    {
      id: "wedding",
      name: "The Wedding Experience",
      price: 1200,
      hours: 5,
      badge: null,
      description:
        "Create an unforgettable soundtrack for your wedding celebration with a personalized DJ experience.",
      inclusions: [
        "Up to 5 hours of DJ performance",
        "Wedding music consultation",
        "Personalized music planning",
        "Reception timeline coordination",
      ],
      cta: "Request wedding booking",
      eventType: "Wedding",
      available: true,
    },
  ],

  /* Extra DJ time, used by the price cards note and the estimator. */
  extraHour: {
    price: 125,
    options: [0, 1, 2, 3], // choices offered in the estimator
  },

  /* Equipment rental catalog (rentals page + rental form + estimate).
     `image` points to an illustration in /assets/img/equipment/. Replace
     with real inventory photos when available and set
     `illustrative: false` so the "Illustrative image" tag disappears. */
  rentals: [
    {
      id: "pa-speaker",
      name: "Powered PA Speaker",
      price: 85,
      unit: "day",
      description:
        "A single powered speaker for music, announcements and speeches at smaller gatherings.",
      image: "assets/img/equipment/pa-speaker.svg",
      illustrative: true,
      includes: [],
      available: true,
    },
    {
      id: "dual-speakers",
      name: "Dual Speaker Package",
      price: 160,
      unit: "day",
      description:
        "A matched pair of powered speakers for fuller, more even sound across your space.",
      image: "assets/img/equipment/dual-speakers.svg",
      illustrative: true,
      includes: [],
      available: true,
    },
    {
      id: "wireless-mic",
      name: "Wireless Microphone System",
      price: 50,
      unit: "day",
      description:
        "Cable-free microphone for toasts, speeches, presentations and announcements.",
      image: "assets/img/equipment/wireless-mic.svg",
      illustrative: true,
      includes: [],
      available: true,
    },
    {
      id: "dj-controller",
      name: "DJ Controller",
      price: 100,
      unit: "day",
      description:
        "A DJ controller for mixing music at your event. Ask about compatibility with your setup.",
      image: "assets/img/equipment/dj-controller.svg",
      illustrative: true,
      includes: [],
      available: true,
    },
    {
      id: "event-lighting",
      name: "Basic Event Lighting",
      price: 75,
      unit: "day",
      description:
        "Simple event lighting to add color and atmosphere to the dance floor or stage area.",
      image: "assets/img/equipment/event-lighting.svg",
      illustrative: true,
      includes: [],
      available: true,
    },
    {
      id: "complete-pa",
      name: "Complete PA System",
      price: 250,
      unit: "day",
      description:
        "A complete sound setup for events that need music and a microphone. Final contents are confirmed with your quote.",
      image: "assets/img/equipment/complete-pa.svg",
      illustrative: true,
      includes: [
        "2 PA speakers",
        "Speaker stands",
        "Audio mixer",
        "Microphone",
        "Required cables",
      ],
      available: true,
    },
  ],

  delivery: {
    price: 75,
    note: "Delivery and setup subject to availability, equipment requirements, and event location.",
  },

  /* Custom event inquiry categories ("Need something bigger?"). */
  customCategories: [
    "Large Private Events",
    "Corporate Events",
    "Weddings",
    "Community Events",
    "Custom Audio Requirements",
  ],

  /* Event types offered in the booking form. */
  eventTypes: [
    "Birthday Party",
    "Private Celebration",
    "Wedding",
    "Corporate Event",
    "Community Event",
    "Large Private Event",
    "Other",
  ],

  /* Photo gallery. `type: "video"` items open the clip in the viewer.
     Captions describe the setting only; do not name people in photos
     without their permission. */
  gallery: [
    {
      type: "image",
      src: "assets/img/home-studio-1170.webp",
      srcSmall: "assets/img/home-studio-640.webp",
      width: 1170,
      height: 1461,
      alt: "A producer seated at a keyboard and studio monitors in a home recording studio, light streaming through the window",
      caption: "The creative process",
      placeholder: "#635e54",
    },
    {
      type: "image",
      src: "assets/img/studio-session-1-1170.webp",
      srcSmall: "assets/img/studio-session-1-640.webp",
      width: 1170,
      height: 1455,
      alt: "Three people working in a professional recording studio surrounded by outboard audio equipment",
      caption: "Inside the studio",
      placeholder: "#4c474c",
    },
    {
      type: "video",
      src: "assets/video/hero.mp4",
      poster: "assets/video/hero-poster.webp",
      width: 960,
      height: 450,
      alt: "Hands mixing music on an illuminated DJ controller",
      caption: "On the decks",
      placeholder: "#5a4541",
    },
    {
      type: "image",
      src: "assets/img/studio-session-2-1170.webp",
      srcSmall: "assets/img/studio-session-2-640.webp",
      width: 1170,
      height: 1181,
      alt: "A person working on a laptop at a recording studio mixing console",
      caption: "Behind the sound",
      placeholder: "#585655",
    },
  ],
};
