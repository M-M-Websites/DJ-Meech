/* ==========================================================================
   DJ MEECH — SITE SCRIPT
   Content and prices come from js/config.js. Nothing here needs editing to
   change a price, a package or a rental item.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.DJ_MEECH;
  if (!CFG) return;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var money = function (n) {
    return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  };
  var escapeHTML = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var todayISO = function () {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  };
  var parseISODate = function (s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return null;
    var p = s.split("-").map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    return isNaN(d.getTime()) ? null : d;
  };
  var scrollToEl = function (el) {
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  var packages = CFG.packages.filter(function (p) { return p.available !== false; });
  var rentals = CFG.rentals.filter(function (r) { return r.available !== false; });
  var pkgById = function (id) { return packages.find(function (p) { return p.id === id; }); };
  var rentalById = function (id) { return rentals.find(function (r) { return r.id === id; }); };
  var page = document.body.getAttribute("data-page");

  /* ------------------------------------------------------------------
     Bind simple values (prices, contact details, year)
     ------------------------------------------------------------------ */
  function bindValues() {
    var minPrice = Math.min.apply(null, packages.map(function (p) { return p.price; }));
    var set = function (key, text) {
      $$('[data-bind="' + key + '"]').forEach(function (el) { el.textContent = text; });
    };
    if (isFinite(minPrice)) set("min-package-price", money(minPrice));
    set("extra-hour-price", money(CFG.extraHour.price));
    set("delivery-price", money(CFG.delivery.price));
    set("delivery-note", CFG.delivery.note);
    set("year", String(new Date().getFullYear()));

    var area = CFG.business.serviceArea;
    $$('[data-bind="service-area"]').forEach(function (el) {
      if (area) { el.textContent = "Serving " + area; el.hidden = false; }
    });

    var b = CFG.business;
    $$('[data-contact="phone"]').forEach(function (a) {
      a.setAttribute("href", b.phoneHref);
      swapText(a, /\(\d{3}\)\s?\d{3}-\d{4}/, b.phoneDisplay);
    });
    $$('[data-contact="email"]').forEach(function (a) {
      a.setAttribute("href", "mailto:" + b.email);
      swapText(a, /[^\s@]+@[^\s@]+\.[a-z]{2,}/i, b.email);
    });
  }
  function swapText(root, pattern, value) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (pattern.test(node.nodeValue)) node.nodeValue = node.nodeValue.replace(pattern, value);
    }
  }

  /* ------------------------------------------------------------------
     Header: solid background on scroll, mobile menu, active link
     ------------------------------------------------------------------ */
  function initHeader() {
    var header = $("#site-header");
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle("is-solid", window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    var toggle = $(".menu-toggle");
    var menu = $("#mobile-menu");
    var label = toggle && toggle.querySelector(".sr-only");
    var open = false;

    var setOpen = function (state, restoreFocus) {
      open = state;
      toggle.setAttribute("aria-expanded", String(state));
      if (label) label.textContent = state ? "Close menu" : "Open menu";
      document.body.classList.toggle("menu-open", state);
      $$("main, .site-footer, .call-bar").forEach(function (el) { el.inert = state; });
      header.classList.toggle("is-solid", state || window.scrollY > 24);
      if (state) {
        menu.hidden = false;
        requestAnimationFrame(function () { menu.classList.add("is-open"); });
        var first = menu.querySelector("a");
        if (first) first.focus({ preventScroll: true });
      } else {
        menu.classList.remove("is-open");
        window.setTimeout(function () { if (!open) menu.hidden = true; }, reduceMotion ? 0 : 300);
        if (restoreFocus) toggle.focus();
      }
    };

    if (toggle && menu) {
      toggle.addEventListener("click", function () { setOpen(!open, true); });
      menu.addEventListener("click", function (e) {
        if (e.target.closest("a")) setOpen(false, false);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && open) setOpen(false, true);
      });
      // keep Tab inside the open menu (header toggle + menu links)
      document.addEventListener("keydown", function (e) {
        if (!open || e.key !== "Tab") return;
        var focusables = [toggle].concat($$("a, button", menu));
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
      window.addEventListener("resize", function () {
        if (open && window.innerWidth > 1180) setOpen(false, false);
      });
    }

    // active nav item
    var setCurrent = function (key) {
      $$("[data-nav]").forEach(function (a) {
        if (a.getAttribute("data-nav") === key) a.setAttribute("aria-current", page === "rentals" ? "page" : "true");
        else a.removeAttribute("aria-current");
      });
    };
    if (page === "rentals") { setCurrent("rentals"); return; }

    var map = { top: "top", about: "about", services: "about", bookings: "bookings", estimator: "bookings", custom: "bookings", rentals: "rentals", gallery: "gallery", faq: "gallery", book: "contact", contact: "contact" };
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setCurrent(map[entry.target.id]);
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* ------------------------------------------------------------------
     Hero background video
     ------------------------------------------------------------------ */
  function initHeroVideo() {
    var video = $("#hero-video");
    var btn = $("#hero-video-toggle");
    if (!video || !btn) return;
    var userPaused = false;
    var inView = true;
    var saveData = navigator.connection && navigator.connection.saveData;

    var render = function () {
      var paused = video.paused;
      btn.setAttribute("aria-pressed", String(paused));
      btn.querySelector("use").setAttribute("href", paused ? "#i-play" : "#i-pause");
      btn.querySelector(".sr-only").textContent = paused ? "Play background video" : "Pause background video";
    };
    var tryPlay = function () {
      var p = video.play();
      if (p && p.catch) p.catch(function () { render(); });
    };

    if (reduceMotion || saveData) {
      userPaused = true;
      video.removeAttribute("autoplay");
      video.pause();
    }
    video.addEventListener("play", render);
    video.addEventListener("pause", render);
    btn.addEventListener("click", function () {
      if (video.paused) { userPaused = false; tryPlay(); }
      else { userPaused = true; video.pause(); }
      render();
    });

    // pause while off screen to save battery
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          inView = entry.isIntersecting;
          if (entry.isIntersecting) { if (!userPaused && video.paused) tryPlay(); }
          else if (!video.paused) video.pause();
        });
      }, { threshold: 0.05 }).observe(video);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) video.pause();
      else if (!userPaused && inView) tryPlay();
    });
    render();
  }

  /* ------------------------------------------------------------------
     Render: DJ packages
     ------------------------------------------------------------------ */
  function renderPackages() {
    var wrap = $("#package-cards");
    if (!wrap) return;
    var maxHours = Math.max.apply(null, packages.map(function (p) { return p.hours; }));
    wrap.innerHTML = packages.map(function (p) {
      var meter = "";
      for (var i = 0; i < maxHours; i++) meter += '<i class="' + (i < p.hours ? "on" : "") + '" style="height:' + (6 + i * 2) + 'px"></i>';
      return (
        '<article class="package' + (p.badge ? " package--featured" : "") + '" id="package-' + escapeHTML(p.id) + '" aria-labelledby="package-' + escapeHTML(p.id) + '-name">' +
          (p.badge ? '<span class="package__badge">' + escapeHTML(p.badge) + "</span>" : "") +
          '<div class="package__meta"><span>' + p.hours + (p.hours === 1 ? " hour" : " hours") + '</span><span class="meter" aria-hidden="true">' + meter + "</span></div>" +
          '<h3 id="package-' + escapeHTML(p.id) + '-name">' + escapeHTML(p.name) + "</h3>" +
          '<div class="package__price"><small>Starting at</small><span class="price-figure"><sup>$</sup>' + Number(p.price).toLocaleString("en-US") + "</span></div>" +
          '<p class="package__desc">' + escapeHTML(p.description) + "</p>" +
          '<ul class="check-list">' + p.inclusions.map(function (x) { return "<li>" + escapeHTML(x) + "</li>"; }).join("") + "</ul>" +
          '<a class="btn ' + (p.badge ? "btn--primary" : "btn--ghost") + ' btn--block" href="#book" data-preset-package="' + escapeHTML(p.id) + '">' + escapeHTML(p.cta) + "</a>" +
        "</article>"
      );
    }).join("");
  }

  /* ------------------------------------------------------------------
     Render: rentals (catalog cards, home preview list)
     ------------------------------------------------------------------ */
  function renderRentals() {
    var grid = $("#rental-catalog");
    if (grid) {
      grid.innerHTML = rentals.map(function (r) {
        return (
          '<article class="rent-card" id="' + escapeHTML(r.id) + '" aria-labelledby="' + escapeHTML(r.id) + '-name">' +
            '<div class="rent-card__media">' +
              '<img src="' + escapeHTML(r.image) + '" alt="' + escapeHTML((r.illustrative ? "Illustration of " : "") + r.name) + '" width="400" height="300" loading="lazy" decoding="async">' +
              (r.illustrative ? '<span class="media-tag">Illustrative image</span>' : "") +
            "</div>" +
            '<div class="rent-card__body">' +
              '<h3 id="' + escapeHTML(r.id) + '-name">' + escapeHTML(r.name) + "</h3>" +
              '<div class="rent-card__price"><small>Starting at</small><span class="price-figure">' + money(r.price) + "<span>/" + escapeHTML(r.unit) + "</span></span></div>" +
              '<p class="rent-card__desc">' + escapeHTML(r.description) + "</p>" +
              (r.includes && r.includes.length
                ? '<p class="includes-label">Proposed package contents</p><ul class="check-list">' + r.includes.map(function (x) { return "<li>" + escapeHTML(x) + "</li>"; }).join("") + "</ul>"
                : "") +
              '<a class="btn btn--ghost btn--block" href="#rent" data-preset-rental="' + escapeHTML(r.id) + '">Request Rental</a>' +
            "</div>" +
          "</article>"
        );
      }).join("");
    }

    var list = $("#rental-preview");
    if (list) {
      list.innerHTML = rentals.map(function (r) {
        return (
          '<li><a href="rentals.html#' + encodeURIComponent(r.id) + '">' +
            '<img src="' + escapeHTML(r.image) + '" alt="" width="64" height="48" loading="lazy" decoding="async">' +
            '<span class="name">' + escapeHTML(r.name) + "</span>" +
            '<span class="price">From <strong>' + money(r.price) + "</strong>/" + escapeHTML(r.unit) + "</span>" +
          "</a></li>"
        );
      }).join("");
    }
  }

  /* ------------------------------------------------------------------
     Render: gallery + lightbox
     ------------------------------------------------------------------ */
  function initGallery() {
    var grid = $("#gallery-grid");
    var dialog = $("#lightbox");
    if (!grid) return;
    var items = CFG.gallery;

    grid.innerHTML = items.map(function (g, i) {
      var media = g.type === "video"
        ? '<video src="' + escapeHTML(g.src) + '" poster="' + escapeHTML(g.poster) + '" muted loop playsinline preload="none" aria-hidden="true"></video><span class="play-badge">Video</span>'
        : '<img src="' + escapeHTML(g.srcSmall || g.src) + '" srcset="' + (g.srcSmall ? escapeHTML(g.srcSmall) + " 640w, " : "") + escapeHTML(g.src) + " " + g.width + 'w" sizes="(max-width: 720px) 92vw, 45vw" width="' + g.width + '" height="' + g.height + '" alt="' + escapeHTML(g.alt) + '" loading="lazy" decoding="async">';
      return (
        '<button class="gallery__item" type="button" data-index="' + i + '" aria-label="View ' + (g.type === "video" ? "video" : "photo") + ": " + escapeHTML(g.caption) + '">' +
          media +
          '<span class="gallery__caption"><span>' + escapeHTML(g.caption) + '</span><span class="zoom" aria-hidden="true"><svg><use href="#i-' + (g.type === "video" ? "play" : "expand") + '"/></svg></span></span>' +
        "</button>"
      );
    }).join("");

    // preview the clip on hover (desktop only, never with reduced motion)
    if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
      $$(".gallery__item video", grid).forEach(function (v) {
        var item = v.closest(".gallery__item");
        item.addEventListener("mouseenter", function () { var p = v.play(); if (p && p.catch) p.catch(function () {}); });
        item.addEventListener("mouseleave", function () { v.pause(); });
      });
    }

    if (!dialog || typeof dialog.showModal !== "function") return;

    var stage = $("#lightbox-stage");
    var caption = $("#lightbox-caption");
    var count = $("#lightbox-count");
    var current = 0;
    var trigger = null;

    var show = function (i) {
      current = (i + items.length) % items.length;
      var g = items[current];
      var old = stage.querySelector("img, video");
      if (old) old.remove();
      var el;
      if (g.type === "video") {
        el = document.createElement("video");
        el.src = g.src;
        el.poster = g.poster;
        el.controls = true;
        el.muted = true;
        el.loop = true;
        el.playsInline = true;
        el.autoplay = !reduceMotion;
        el.setAttribute("aria-label", g.alt);
      } else {
        el = document.createElement("img");
        el.src = g.src;
        el.alt = g.alt;
        el.width = g.width;
        el.height = g.height;
      }
      stage.insertBefore(el, stage.firstChild);
      caption.textContent = g.caption;
      count.textContent = (current + 1) + " / " + items.length;
    };
    var open = function (i, from) {
      trigger = from;
      show(i);
      dialog.showModal();
      document.body.classList.add("menu-open");
    };
    var close = function () { dialog.close(); };

    grid.addEventListener("click", function (e) {
      var btn = e.target.closest(".gallery__item");
      if (btn) open(Number(btn.getAttribute("data-index")), btn);
    });
    dialog.addEventListener("close", function () {
      var v = stage.querySelector("video");
      if (v) v.pause();
      document.body.classList.remove("menu-open");
      if (trigger) trigger.focus();
    });
    $("[data-lightbox-close]", dialog).addEventListener("click", close);
    $("[data-lightbox-prev]", dialog).addEventListener("click", function () { show(current - 1); });
    $("[data-lightbox-next]", dialog).addEventListener("click", function () { show(current + 1); });
    dialog.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); show(current - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); show(current + 1); }
    });
    // click on the dark area closes
    stage.addEventListener("click", function (e) { if (e.target === stage) close(); });
    // swipe
    var startX = null;
    stage.addEventListener("pointerdown", function (e) { startX = e.clientX; });
    stage.addEventListener("pointerup", function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    });
  }

  /* ------------------------------------------------------------------
     Shared validation
     ------------------------------------------------------------------ */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function fieldWrap(input) { return input.closest(".field"); }
  function errorEl(input) {
    var id = (input.getAttribute("data-error-for") || input.id) + "-error";
    return document.getElementById(id);
  }
  function setError(input, msg) {
    var wrap = fieldWrap(input);
    var err = errorEl(input);
    if (wrap) wrap.classList.toggle("is-invalid", !!msg);
    if (err) err.textContent = msg || "";
    if (msg) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
    if (err && input.id && err.id) {
      var describedBy = (input.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
      if (describedBy.indexOf(err.id) === -1) { describedBy.push(err.id); input.setAttribute("aria-describedby", describedBy.join(" ")); }
    }
    return !msg;
  }
  function labelText(input) {
    var l = input.id && document.querySelector('label[for="' + input.id + '"]');
    return l ? l.textContent.replace("*", "").replace("(optional)", "").trim() : "This field";
  }
  function validateField(input) {
    var v = (input.value || "").trim();
    var name = labelText(input);
    if (input.type === "radio" || input.type === "checkbox") return true;
    if (input.required && !v) {
      var custom = input.getAttribute("data-required-msg");
      if (custom) return setError(input, custom);
      if (input.tagName === "SELECT") return setError(input, "Please choose an option.");
      if (input.type === "date") return setError(input, "Please choose a date.");
      if (input.type === "time") return setError(input, "Please choose a time.");
      return setError(input, "Please enter your " + name.toLowerCase() + ".");
    }
    if (!v) return setError(input, "");
    if (input.type === "email" && !EMAIL_RE.test(v)) return setError(input, "Enter an email address like name@example.com.");
    if (input.type === "tel" && v.replace(/\D/g, "").length < 10) return setError(input, "Enter a phone number with area code, like (901) 555-0123.");
    if (input.type === "number") {
      var n = Number(v);
      if (!isFinite(n) || n < Number(input.min || 0) || Math.floor(n) !== n) return setError(input, "Enter a whole number of guests (1 or more).");
    }
    if (input.type === "date") {
      var d = parseISODate(v);
      if (!d) return setError(input, "Choose a valid date.");
      if (input.min && v < input.min) {
        var after = input.getAttribute("data-min-msg");
        return setError(input, after || "Choose today or a future date.");
      }
    }
    return setError(input, "");
  }
  function formatPhone(input) {
    var digits = input.value.replace(/\D/g, "");
    if (digits.length === 11 && digits[0] === "1") digits = digits.slice(1);
    if (digits.length === 10) input.value = "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
  }
  function wireLiveValidation(form, extraValidate) {
    $$("input, select, textarea", form).forEach(function (input) {
      if (input.type === "hidden" || input.closest(".honeypot")) return;
      var touched = false;
      input.addEventListener("blur", function () {
        if (input.type === "tel") formatPhone(input);
        touched = true;
        if (input.type !== "radio" && input.type !== "checkbox" && input.closest(".field") && input.id && errorEl(input)) validateField(input);
      });
      input.addEventListener("input", function () {
        if (touched && input.closest(".field.is-invalid") && input.id && errorEl(input)) validateField(input);
      });
      input.addEventListener("change", function () {
        if (extraValidate && form.getAttribute("data-submitted")) extraValidate(false);
      });
    });
  }

  /* ------------------------------------------------------------------
     Shared submission (FormSubmit AJAX, with mailto fallback)
     ------------------------------------------------------------------ */
  function endpoint() {
    return "https://formsubmit.co/ajax/" + encodeURI(CFG.forms.endpointId);
  }
  function formToObject(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) {
      if (key === "_honey") return;
      if (data[key] !== undefined) data[key] += ", " + value;
      else data[key] = value;
    });
    // drop empty optional extras so the email stays tidy
    Object.keys(data).forEach(function (k) { if (data[k] === "" && k.charAt(0) !== "_") delete data[k]; });
    return data;
  }
  function mailtoFallback(data, subject) {
    var lines = Object.keys(data).filter(function (k) { return k.charAt(0) !== "_"; }).map(function (k) { return k + ": " + data[k]; });
    var body = lines.join("\n");
    if (body.length > 1800) body = body.slice(0, 1800) + "\n…";
    return "mailto:" + CFG.business.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  function initForm(form, opts) {
    if (!form) return;
    var submitBtn = $("[data-submit]", form);
    var alertBox = $("[data-form-alert]", form);
    var success = document.getElementById(opts.successId);
    var btnLabel = submitBtn.innerHTML;
    var sending = false;

    wireLiveValidation(form, opts.validateExtra);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) return;
      form.setAttribute("data-submitted", "1");
      alertBox.hidden = true;

      if (opts.beforeValidate) opts.beforeValidate();
      var firstInvalid = null;
      $$("input, select, textarea", form).forEach(function (input) {
        if (input.type === "hidden" || input.closest(".honeypot") || input.type === "radio" || input.type === "checkbox" || !input.id || !errorEl(input)) return;
        if (!validateField(input) && !firstInvalid) firstInvalid = input;
      });
      var extraInvalid = opts.validateExtra ? opts.validateExtra(true) : null;
      if (extraInvalid && (!firstInvalid || (extraInvalid.compareDocumentPosition(firstInvalid) & Node.DOCUMENT_POSITION_FOLLOWING))) {
        firstInvalid = extraInvalid;
      }
      if (firstInvalid) {
        firstInvalid.focus({ preventScroll: true });
        firstInvalid.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        return;
      }

      // spam trap: bots fill the hidden field, people never see it
      var honey = form.querySelector('[name="_honey"]');
      if (honey && honey.value) { showSuccess(); return; }

      var data = formToObject(form);
      sending = true;
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-busy", "true");
      submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending…';

      var controller = "AbortController" in window ? new AbortController() : null;
      var timer = window.setTimeout(function () { if (controller) controller.abort(); }, 20000);

      fetch(endpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
        signal: controller ? controller.signal : undefined,
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (json) {
            if (!res.ok || String(json.success) !== "true") throw new Error(json.message || "Request failed (" + res.status + ")");
            return json;
          });
        })
        .then(function () { showSuccess(); })
        .catch(function () { showFailure(data); })
        .then(function () {
          window.clearTimeout(timer);
          sending = false;
          submitBtn.disabled = false;
          submitBtn.removeAttribute("aria-busy");
          submitBtn.innerHTML = btnLabel;
        });
    });

    function showSuccess() {
      form.hidden = true;
      success.hidden = false;
      success.focus({ preventScroll: true });
      scrollToEl(success.closest(".form-card"));
    }
    function showFailure(data) {
      var b = CFG.business;
      alertBox.innerHTML =
        "<strong>Your request didn't go through.</strong>" +
        "<span>Check your connection and try again, or contact DJ Meech directly at " +
        '<a href="' + escapeHTML(b.phoneHref) + '">' + escapeHTML(b.phoneDisplay) + "</a>.</span>" +
        '<span><a href="' + escapeHTML(mailtoFallback(data, opts.mailSubject)) + '">Email these details instead</a></span>';
      alertBox.hidden = false;
      alertBox.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }

    var resetBtn = document.querySelector('[data-reset-form="' + form.id + '"]');
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        form.reset();
        form.removeAttribute("data-submitted");
        $$(".is-invalid", form).forEach(function (el) { el.classList.remove("is-invalid"); });
        $$(".field-error", form).forEach(function (el) { el.textContent = ""; });
        $$("[aria-invalid]", form).forEach(function (el) { el.removeAttribute("aria-invalid"); });
        if (opts.afterReset) opts.afterReset();
        success.hidden = true;
        form.hidden = false;
        var first = form.querySelector("input:not([type=hidden]):not([tabindex='-1'])");
        if (first) first.focus();
      });
    }
  }

  /* ------------------------------------------------------------------
     Booking form + estimator + custom package handoff
     ------------------------------------------------------------------ */
  function initBooking() {
    var form = $("#booking-form");
    if (!form) return null;

    var typeSel = $("#bk-event-type");
    var pkgSel = $("#bk-package");
    CFG.eventTypes.forEach(function (t) { typeSel.add(new Option(t, t)); });
    packages.forEach(function (p) { pkgSel.add(new Option(p.name + " (from " + money(p.price) + ")", p.name)); });
    pkgSel.add(new Option("Custom Event Package", "Custom Event Package"));
    pkgSel.add(new Option("Not sure yet", "Not sure yet"));

    var dateInput = $("#bk-date");
    dateInput.min = todayISO();

    var chip = $("#bk-estimate-chip");
    var chipText = $("#bk-estimate-text");
    var hidden = { pkg: $("#bk-est-package"), hours: $("#bk-est-hours"), total: $("#bk-est-total"), cats: $("#bk-custom-cats") };

    var clearEstimate = function () {
      hidden.pkg.value = hidden.hours.value = hidden.total.value = "";
      chip.hidden = true;
    };
    $("#bk-estimate-remove").addEventListener("click", function () { clearEstimate(); pkgSel.focus(); });
    pkgSel.addEventListener("change", function () {
      if (hidden.pkg.value && pkgSel.value !== hidden.pkg.value) clearEstimate();
    });

    var api = {
      presetPackage: function (id) {
        var p = pkgById(id);
        if (!p) return;
        pkgSel.value = p.name;
        if (p.eventType && !typeSel.value) typeSel.value = p.eventType;
        if (hidden.pkg.value && hidden.pkg.value !== p.name) clearEstimate();
        validateIfShown(pkgSel); validateIfShown(typeSel);
      },
      presetEventType: function (t) {
        if (CFG.eventTypes.indexOf(t) !== -1) { typeSel.value = t; validateIfShown(typeSel); }
      },
      attachEstimate: function (p, hours, total) {
        api.presetPackage(p.id);
        hidden.pkg.value = p.name;
        hidden.hours.value = String(hours);
        hidden.total.value = money(total);
        chipText.textContent = p.name + (hours ? " + " + hours + (hours === 1 ? " extra hour" : " extra hours") : "") + " = " + money(total);
        chip.hidden = false;
      },
      attachCustom: function (cats) {
        pkgSel.value = "Custom Event Package";
        clearEstimate();
        hidden.cats.value = cats.join(", ");
        var map = { "Weddings": "Wedding", "Corporate Events": "Corporate Event", "Community Events": "Community Event", "Large Private Events": "Large Private Event" };
        var firstType = cats.map(function (c) { return map[c]; }).filter(Boolean)[0];
        if (firstType) typeSel.value = firstType;
        var details = $("#bk-details");
        if (cats.length && !details.value.trim()) details.value = "I'm interested in a custom package for: " + cats.join(", ") + ".\n\n";
        validateIfShown(pkgSel); validateIfShown(typeSel);
      },
    };
    function validateIfShown(input) { if (fieldWrap(input).classList.contains("is-invalid")) validateField(input); }

    initForm(form, {
      successId: "booking-success",
      mailSubject: "DJ booking request",
      afterReset: function () { clearEstimate(); hidden.cats.value = ""; },
    });

    // preset from URL: index.html?package=wedding#book
    var params = new URLSearchParams(location.search);
    if (params.get("package")) api.presetPackage(params.get("package"));

    return api;
  }

  function goToBooking(focusName) {
    var section = $("#book");
    scrollToEl(section);
    if (focusName) {
      var name = $("#bk-name");
      window.setTimeout(function () { if (name && !name.value) name.focus({ preventScroll: true }); }, reduceMotion ? 0 : 650);
    }
  }

  function initEstimator(booking) {
    var form = $("#estimator-form");
    if (!form) return;
    var picks = $("#estimator-packages");
    var range = $("#estimator-hours");
    var ticks = $("#estimator-ticks");
    var total = $("#estimator-total");
    var lines = $("#estimator-lines");
    var valueText = $("#estimator-hours-value");
    var opts = CFG.extraHour.options.slice().sort(function (a, b) { return a - b; });
    var rate = CFG.extraHour.price;

    var defaultPkg = packages.find(function (p) { return p.badge; }) || packages[0];
    picks.innerHTML = packages.map(function (p) {
      var id = "est-pkg-" + p.id;
      return '<div class="channel-pick"><input type="radio" name="estPackage" id="' + id + '" value="' + escapeHTML(p.id) + '"' + (p === defaultPkg ? " checked" : "") + '>' +
        '<label for="' + id + '"><span class="name">' + escapeHTML(p.name) + '</span><span class="amt">' + money(p.price) + "</span></label></div>";
    }).join("");

    range.min = "0";
    range.max = String(opts.length - 1);
    range.step = "1";
    range.value = "0";
    ticks.innerHTML = opts.map(function (h) { return "<span>" + (h === 0 ? "0" : "+" + h + "h") + "</span>"; }).join("");

    var state = function () {
      var checked = form.querySelector('input[name="estPackage"]:checked');
      var p = pkgById(checked ? checked.value : defaultPkg.id) || defaultPkg;
      var hours = opts[Number(range.value)] || 0;
      return { p: p, hours: hours, total: p.price + hours * rate };
    };
    var render = function () {
      var s = state();
      total.textContent = money(s.total);
      var pct = opts.length > 1 ? (Number(range.value) / (opts.length - 1)) * 100 : 0;
      range.style.setProperty("--fill", pct + "%");
      var hoursLabel = s.hours === 0 ? "0 hours" : s.hours + (s.hours === 1 ? " hour" : " hours");
      range.setAttribute("aria-valuetext", hoursLabel + ", plus " + money(s.hours * rate));
      valueText.innerHTML = "<strong>" + hoursLabel + "</strong> of extra DJ time: +" + money(s.hours * rate) + " <span class=\"sr-only\">. Estimated total " + money(s.total) + "</span>";
      lines.innerHTML =
        "<li><span>" + escapeHTML(s.p.name) + " (" + s.p.hours + " hrs)</span><span>" + money(s.p.price) + "</span></li>" +
        "<li><span>Additional DJ time (" + s.hours + " × " + money(rate) + ")</span><span>+" + money(s.hours * rate) + "</span></li>" +
        "<li><span>Total DJ time</span><span>" + (s.p.hours + s.hours) + " hrs</span></li>";
    };
    form.addEventListener("input", render);
    form.addEventListener("change", render);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var s = state();
      if (booking) booking.attachEstimate(s.p, s.hours, s.total);
      goToBooking(true);
    });
    render();
  }

  function initCustom(booking) {
    var form = $("#custom-form");
    if (!form) return;
    var wrap = $("#custom-categories");
    wrap.innerHTML = CFG.customCategories.map(function (c, i) {
      var id = "custom-cat-" + i;
      return '<div class="chip"><input type="checkbox" id="' + id + '" name="customCategory" value="' + escapeHTML(c) + '"><label for="' + id + '">' + escapeHTML(c) + "</label></div>";
    }).join("");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var cats = $$('input[name="customCategory"]:checked', form).map(function (i) { return i.value; });
      if (booking) booking.attachCustom(cats);
      goToBooking(true);
    });
  }

  function initPresetLinks(booking) {
    document.addEventListener("click", function (e) {
      var a = e.target.closest("[data-preset-package], [data-preset-event]");
      if (!a || !booking) return;
      var id = a.getAttribute("data-preset-package");
      var t = a.getAttribute("data-preset-event");
      if (id) booking.presetPackage(id);
      if (t) booking.presetEventType(t);
      e.preventDefault();
      goToBooking(true);
    });
  }

  /* ------------------------------------------------------------------
     Rental form: equipment picker, dates, preliminary estimate
     ------------------------------------------------------------------ */
  function initRental() {
    var form = $("#rental-form");
    if (!form) return;
    var picker = $("#rt-equipment");
    var MAX_QTY = 20;

    picker.innerHTML = rentals.map(function (r) {
      var cid = "rt-item-" + r.id;
      var qid = "rt-qty-" + r.id;
      return (
        '<div class="equip-row" data-id="' + escapeHTML(r.id) + '">' +
          '<label class="equip-check" for="' + cid + '"><input type="checkbox" id="' + cid + '" value="' + escapeHTML(r.id) + '">' +
            '<span><span class="nm">' + escapeHTML(r.name) + '</span><span class="pr">From ' + money(r.price) + "/" + escapeHTML(r.unit) + "</span></span></label>" +
          '<div class="stepper">' +
            '<button type="button" data-step="-1" aria-label="Decrease ' + escapeHTML(r.name) + ' quantity" disabled>−</button>' +
            '<input type="number" id="' + qid + '" min="1" max="' + MAX_QTY + '" value="1" inputmode="numeric" aria-label="' + escapeHTML(r.name) + ' quantity" disabled>' +
            '<button type="button" data-step="1" aria-label="Increase ' + escapeHTML(r.name) + ' quantity" disabled>+</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");

    var start = $("#rt-start");
    var ret = $("#rt-return");
    var today = todayISO();
    start.min = today;
    ret.min = today;
    ret.setAttribute("data-min-msg", "Return date can't be before the start date.");
    start.addEventListener("change", function () {
      ret.min = start.value && start.value >= today ? start.value : today;
      // flag a return date that is now before the start, rather than silently changing it
      if (ret.value) validateField(ret);
      update();
    });
    ret.addEventListener("change", update);

    var estimateBox = $("#rt-estimate");
    var estimateTotal = $("#rt-estimate-total");
    var estimateLines = $("#rt-estimate-lines");
    var summaryEquip = $("#rt-equipment-summary");
    var summaryEst = $("#rt-estimate-summary");

    var clampQty = function (input) {
      var n = Math.round(Number(input.value));
      if (!isFinite(n) || n < 1) n = 1;
      if (n > MAX_QTY) n = MAX_QTY;
      input.value = String(n);
      return n;
    };
    var syncRow = function (row) {
      var cb = row.querySelector('input[type="checkbox"]');
      var qty = row.querySelector('input[type="number"]');
      var minus = row.querySelector('[data-step="-1"]');
      var plus = row.querySelector('[data-step="1"]');
      row.classList.toggle("is-on", cb.checked);
      qty.disabled = !cb.checked;
      var n = clampQty(qty);
      minus.disabled = !cb.checked || n <= 1;
      plus.disabled = !cb.checked || n >= MAX_QTY;
    };
    var selected = function () {
      return $$(".equip-row", picker).filter(function (row) {
        return row.querySelector('input[type="checkbox"]').checked;
      }).map(function (row) {
        return { item: rentalById(row.getAttribute("data-id")), qty: clampQty(row.querySelector('input[type="number"]')) };
      });
    };
    var rentalDays = function () {
      var s = parseISODate(start.value);
      var r = parseISODate(ret.value);
      if (!s || !r || r < s) return null;
      var diff = Math.round((r - s) / 86400000);
      return Math.max(1, diff);
    };

    function update() {
      $$(".equip-row", picker).forEach(syncRow);
      var sel = selected();
      var days = rentalDays();
      var delivery = form.querySelector('input[name="Pickup or Delivery"]:checked');
      var wantsDelivery = delivery && delivery.value !== "Pickup";

      summaryEquip.value = sel.map(function (s) { return s.item.name + " × " + s.qty; }).join("; ");

      if (!sel.length) {
        estimateBox.hidden = true;
        summaryEst.value = "";
        return;
      }
      var perDay = sel.reduce(function (sum, s) { return sum + s.item.price * s.qty; }, 0);
      var d = days || 1;
      var html = sel.map(function (s) {
        return "<li><span>" + escapeHTML(s.item.name) + " × " + s.qty + (days ? " × " + d + (d === 1 ? " day" : " days") : "") + "</span><span>" + money(s.item.price * s.qty * d) + "</span></li>";
      }).join("");
      var total = perDay * d;
      if (wantsDelivery) {
        html += "<li><span>Delivery &amp; setup (starting at)</span><span>" + money(CFG.delivery.price) + "</span></li>";
        total += CFG.delivery.price;
      }
      if (!days) html += "<li><span>Add your rental dates to estimate the full rental period. Showing 1 day.</span><span></span></li>";
      estimateLines.innerHTML = html;
      estimateTotal.textContent = money(total);
      estimateBox.hidden = false;
      summaryEst.value = money(total) + " (" + (days ? d + (d === 1 ? " day" : " days") : "1 day, dates not set") + (wantsDelivery ? ", incl. delivery from " + money(CFG.delivery.price) : "") + ")";
    }

    picker.addEventListener("change", function (e) {
      if (e.target.type === "checkbox") {
        var row = e.target.closest(".equip-row");
        syncRow(row);
      }
      update();
      if (form.getAttribute("data-submitted")) validateExtra(false);
    });
    // quantities are clamped on "change" (blur/enter), not while the user is still typing
    picker.addEventListener("input", function (e) {
      if (e.target.type !== "number") return;
      var n = Number(e.target.value);
      if (e.target.value !== "" && n >= 1 && n <= MAX_QTY && Math.floor(n) === n) update();
    });
    picker.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-step]");
      if (!btn) return;
      var qty = btn.parentElement.querySelector('input[type="number"]');
      qty.value = String(clampQty(qty) + Number(btn.getAttribute("data-step")));
      clampQty(qty);
      update();
    });
    $$('input[name="Pickup or Delivery"]', form).forEach(function (r) { r.addEventListener("change", update); });

    function validateExtra(report) {
      var first = null;
      var equipField = $("#rt-equipment-field");
      var equipErr = $("#rt-equipment-error");
      if (!selected().length) {
        equipField.classList.add("is-invalid");
        equipErr.textContent = "Select at least one item you'd like to rent.";
        first = first || picker.querySelector('input[type="checkbox"]');
      } else {
        equipField.classList.remove("is-invalid");
        equipErr.textContent = "";
      }
      var handField = $("#rt-handoff-field");
      var handErr = $("#rt-handoff-error");
      if (!form.querySelector('input[name="Pickup or Delivery"]:checked')) {
        handField.classList.add("is-invalid");
        handErr.textContent = "Choose pickup or delivery.";
        first = first || $("#rt-handoff-pickup");
      } else {
        handField.classList.remove("is-invalid");
        handErr.textContent = "";
      }
      return report ? first : null;
    }

    initForm(form, {
      successId: "rental-success",
      mailSubject: "Equipment rental inquiry",
      validateExtra: validateExtra,
      beforeValidate: function () {
        ret.min = start.value && start.value >= today ? start.value : today;
        update();
      },
      afterReset: function () {
        ret.min = today;
        $("#rt-equipment-field").classList.remove("is-invalid");
        $("#rt-handoff-field").classList.remove("is-invalid");
        update();
      },
    });

    var preset = function (id) {
      var row = picker.querySelector('.equip-row[data-id="' + id + '"]');
      if (!row) return;
      row.querySelector('input[type="checkbox"]').checked = true;
      syncRow(row);
      update();
      if (form.getAttribute("data-submitted")) validateExtra(false);
    };
    document.addEventListener("click", function (e) {
      var a = e.target.closest("[data-preset-rental]");
      if (!a) return;
      e.preventDefault();
      preset(a.getAttribute("data-preset-rental"));
      scrollToEl($("#rent"));
      var cb = picker.querySelector('.equip-row[data-id="' + a.getAttribute("data-preset-rental") + '"] input[type="checkbox"]');
      window.setTimeout(function () { if (cb) cb.focus({ preventScroll: true }); }, reduceMotion ? 0 : 650);
    });
    var params = new URLSearchParams(location.search);
    if (params.get("item")) preset(params.get("item"));
    update();
  }

  /* ------------------------------------------------------------------
     Scroll reveal (enhancement only: content is visible without it)
     ------------------------------------------------------------------ */
  function initReveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    var targets = [];
    $$("[data-reveal]").forEach(function (el) { targets.push(el); });
    $$("[data-reveal-group]").forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.style.setProperty("--reveal-delay", (i * 0.08).toFixed(2) + "s");
        targets.push(child);
      });
    });
    var vh = window.innerHeight;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    targets.forEach(function (el) {
      // only animate things that start below the fold
      if (el.getBoundingClientRect().top > vh * 0.92) {
        el.classList.add("reveal-pending");
        io.observe(el);
      }
    });
    // anchor jumps should never land on invisible content
    window.addEventListener("hashchange", function () {
      $$(".reveal-pending:not(.is-revealed)").forEach(function (el) { el.classList.add("is-revealed"); });
    });
  }

  /* ------------------------------------------------------------------
     Mobile quick-contact bar
     ------------------------------------------------------------------ */
  function initCallBar() {
    var bar = $("#call-bar");
    if (!bar) return;
    document.body.classList.add("has-call-bar");
    var hideZones = $$("#book, #rent, #contact, .site-footer");
    var inZone = new Set();
    var update = function () {
      var show = window.scrollY > window.innerHeight * 0.6 && inZone.size === 0;
      bar.classList.toggle("is-visible", show);
      bar.setAttribute("aria-hidden", String(!show));
      $$("a", bar).forEach(function (a) { a.tabIndex = show ? 0 : -1; });
    };
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) inZone.add(entry.target); else inZone.delete(entry.target);
        });
        update();
      });
      hideZones.forEach(function (z) { io.observe(z); });
    }
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  bindValues();
  renderPackages();
  renderRentals();
  initHeader();
  initHeroVideo();
  initGallery();
  var booking = initBooking();
  initEstimator(booking);
  initCustom(booking);
  initPresetLinks(booking);
  initRental();
  initReveal();
  initCallBar();

  // honor a #hash target after content rendered (e.g. rentals.html#complete-pa)
  if (location.hash.length > 1) {
    var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) window.setTimeout(function () { target.scrollIntoView({ block: "start" }); }, 60);
  }
})();
