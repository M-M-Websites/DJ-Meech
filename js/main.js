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

  var money = function (n) { return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 }); };
  var escapeHTML = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var icon = function (id, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : "") + ' aria-hidden="true"><use href="#' + id + '"/></svg>'; };
  var todayISO = function () {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  var parseISODate = function (s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return null;
    var p = s.split("-").map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    return isNaN(d.getTime()) ? null : d;
  };
  var scrollToEl = function (el) { if (el) el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); };
  var debounce = function (fn, ms) {
    var t;
    return function () { var args = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, args); }, ms); };
  };
  var storage = {
    get: function (k) { try { return JSON.parse(window.localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } },
  };

  /* Relative time ("just now", "2 minutes ago", "in 45 days") with full date kept for hover */
  var rtf = "RelativeTimeFormat" in Intl ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }) : null;
  var fullDate = function (d, withTime) {
    return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) +
      (withTime ? " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "");
  };
  var relativeFromNow = function (d) {
    var secs = Math.round((d.getTime() - Date.now()) / 1000);
    var abs = Math.abs(secs);
    if (abs < 45) return "just now";
    if (!rtf) return fullDate(d, true);
    if (abs < 3600) return rtf.format(Math.round(secs / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(secs / 3600), "hour");
    return rtf.format(Math.round(secs / 86400), "day");
  };
  var relativeDay = function (d) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var days = Math.round((d - t) / 86400000);
    return rtf ? rtf.format(days, "day") : days + " days";
  };

  var packages = CFG.packages.filter(function (p) { return p.available !== false; });
  var rentals = CFG.rentals.filter(function (r) { return r.available !== false; });
  var pkgById = function (id) { return packages.find(function (p) { return p.id === id; }); };
  var rentalById = function (id) { return rentals.find(function (r) { return r.id === id; }); };
  var page = document.body.getAttribute("data-page");

  /* ------------------------------------------------------------------
     Toasts: auto-dismiss after 5s, pause while hovered or focused.
     Used only for confirmations and undo, never for errors.
     ------------------------------------------------------------------ */
  var toastRegion = $("#toasts");
  function toast(message, opts) {
    opts = opts || {};
    if (!toastRegion) return null;
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = '<span class="toast__msg"></span>';
    el.querySelector(".toast__msg").textContent = message;
    if (opts.action) {
      var act = document.createElement("button");
      act.type = "button";
      act.className = "btn btn--ghost btn--sm";
      act.textContent = opts.action.label;
      act.addEventListener("click", function () { opts.action.onClick(); dismiss(); });
      el.appendChild(act);
    }
    var close = document.createElement("button");
    close.type = "button";
    close.className = "icon-btn";
    close.setAttribute("aria-label", "Dismiss notification");
    close.innerHTML = icon("i-close");
    close.addEventListener("click", function () { dismiss(); });
    el.appendChild(close);

    var duration = opts.duration || 5000;
    var remaining = duration;
    var started = Date.now();
    var timer = setTimeout(dismiss, remaining);
    var pause = function () { clearTimeout(timer); remaining -= Date.now() - started; el.setAttribute("data-paused", "true"); };
    var resume = function () { if (el.matches(":hover") || el.contains(document.activeElement)) return; started = Date.now(); el.removeAttribute("data-paused"); timer = setTimeout(dismiss, Math.max(remaining, 1000)); };
    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resume);
    el.addEventListener("focusin", pause);
    el.addEventListener("focusout", function () { setTimeout(resume, 0); });

    var gone = false;
    function dismiss() {
      if (gone) return;
      gone = true;
      clearTimeout(timer);
      el.classList.add("is-leaving");
      setTimeout(function () { el.remove(); }, reduceMotion ? 0 : 200);
    }
    while (toastRegion.children.length >= 3) toastRegion.firstElementChild.remove();
    toastRegion.appendChild(el);
    return { el: el, dismiss: dismiss };
  }

  /* ------------------------------------------------------------------
     Bind simple values (prices, contact details, year)
     ------------------------------------------------------------------ */
  function bindValues() {
    var set = function (key, text) { $$('[data-bind="' + key + '"]').forEach(function (el) { el.textContent = text; }); };
    if (packages.length) set("min-package-price", money(Math.min.apply(null, packages.map(function (p) { return p.price; }))));
    if (rentals.length) set("min-rental-price", money(Math.min.apply(null, rentals.map(function (r) { return r.price; }))));
    set("extra-hour-price", money(CFG.extraHour.price));
    set("delivery-price", money(CFG.delivery.price));
    set("delivery-note", CFG.delivery.note);
    set("year", String(new Date().getFullYear()));
    var area = CFG.business.serviceArea;
    $$('[data-bind="service-area"]').forEach(function (el) { if (area) { el.textContent = "Serving " + area; el.hidden = false; } });

    var b = CFG.business;
    $$('[data-contact="phone"]').forEach(function (a) { a.setAttribute("href", b.phoneHref); swapText(a, /\(\d{3}\)\s?\d{3}-\d{4}/, b.phoneDisplay); });
    $$('[data-contact="email"]').forEach(function (a) { a.setAttribute("href", "mailto:" + b.email); swapText(a, /[^\s@]+@[^\s@]+\.[a-z]{2,}/i, b.email); });
  }
  function swapText(root, pattern, value) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) if (pattern.test(node.nodeValue)) node.nodeValue = node.nodeValue.replace(pattern, value);
  }

  /* ------------------------------------------------------------------
     Header: solid background on scroll, mobile menu, current section
     ------------------------------------------------------------------ */
  function initHeader() {
    var header = $("#site-header");
    if (!header) return;
    var onScroll = function () { header.classList.toggle("is-solid", window.scrollY > 24 || document.body.classList.contains("menu-open")); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    var toggle = $(".menu-toggle");
    var menu = $("#mobile-menu");
    var open = false;
    var setOpen = function (state, restoreFocus) {
      open = state;
      toggle.setAttribute("aria-expanded", String(state));
      toggle.setAttribute("aria-label", state ? "Close menu" : "Open menu");
      document.body.classList.toggle("menu-open", state);
      $$("main, .site-footer, .call-bar").forEach(function (el) { el.inert = state; });
      onScroll();
      if (state) {
        menu.hidden = false;
        requestAnimationFrame(function () { requestAnimationFrame(function () { menu.classList.add("is-open"); }); });
        var first = menu.querySelector("a");
        if (first) first.focus({ preventScroll: true });
      } else {
        menu.classList.remove("is-open");
        setTimeout(function () { if (!open) menu.hidden = true; }, reduceMotion ? 0 : 200);
        if (restoreFocus) toggle.focus();
      }
    };
    if (toggle && menu) {
      toggle.addEventListener("click", function () { setOpen(!open, true); });
      menu.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false, false); });
      document.addEventListener("keydown", function (e) {
        if (!open) return;
        if (e.key === "Escape") { setOpen(false, true); return; }
        if (e.key !== "Tab") return;
        var f = [toggle].concat($$("a, button", menu));
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      });
      window.addEventListener("resize", function () { if (open && !window.matchMedia("(max-width: 73.75em)").matches) setOpen(false, false); });
    }

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
      entries.forEach(function (entry) { if (entry.isIntersecting) setCurrent(map[entry.target.id]); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
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
      btn.setAttribute("aria-label", paused ? "Play background video" : "Pause background video");
      btn.innerHTML = paused ? icon("i-play", "i-play") : icon("i-pause");
    };
    var tryPlay = function () { var p = video.play(); if (p && p.catch) p.catch(function () { render(); }); };
    // Playback starts here rather than via an autoplay attribute, which would begin buffering
    // the video before this script runs, even for visitors who never see it play.
    if (reduceMotion || saveData) { userPaused = true; video.pause(); }
    video.addEventListener("play", render);
    video.addEventListener("pause", render);
    btn.addEventListener("click", function () {
      if (video.paused) { userPaused = false; tryPlay(); } else { userPaused = true; video.pause(); }
      render();
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          inView = entry.isIntersecting;
          if (entry.isIntersecting) { if (!userPaused && video.paused) tryPlay(); }
          else if (!video.paused) video.pause();
        });
      }, { threshold: 0.05 }).observe(video);
    } else if (!userPaused) tryPlay();
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) video.pause();
      else if (!userPaused && inView) tryPlay();
    });
    render();
  }

  /* ------------------------------------------------------------------
     Render: packages, rentals, gallery (replacing the skeletons)
     ------------------------------------------------------------------ */
  function emptyState(title, body) {
    var b = CFG.business;
    return '<div class="empty-state"><strong>' + escapeHTML(title) + "</strong><p>" + escapeHTML(body) + '</p><a class="btn btn--ghost btn--icon-start" href="' + escapeHTML(b.phoneHref) + '">' + icon("i-phone") + "Call " + escapeHTML(b.phoneDisplay) + "</a></div>";
  }
  function done(wrap) { wrap.removeAttribute("aria-busy"); }

  function renderPackages() {
    var wrap = $("#package-cards");
    if (!wrap) return;
    if (!packages.length) { wrap.innerHTML = emptyState("Packages are being updated", "New DJ packages are on the way. Call for current pricing in the meantime."); done(wrap); return; }
    var maxHours = Math.max.apply(null, packages.map(function (p) { return p.hours; }));
    wrap.innerHTML = packages.map(function (p) {
      var meter = "";
      for (var i = 0; i < maxHours; i++) meter += '<i class="' + (i < p.hours ? "on" : "") + '" style="height:' + (6 + i * 2) + 'px"></i>';
      var id = escapeHTML(p.id);
      return (
        '<article class="package card card-hover' + (p.badge ? " package--featured" : "") + '" id="package-' + id + '" aria-labelledby="package-' + id + '-name">' +
          (p.badge ? '<span class="package__badge label">' + escapeHTML(p.badge) + "</span>" : "") +
          '<div class="package__meta"><span class="label">' + p.hours + (p.hours === 1 ? " hour" : " hours") + '</span><span class="meter" aria-hidden="true">' + meter + "</span></div>" +
          '<h3 id="package-' + id + '-name">' + escapeHTML(p.name) + "</h3>" +
          '<div class="package__price"><span class="label">Starting at</span><span class="price-figure"><sup>$</sup>' + Number(p.price).toLocaleString("en-US") + "</span></div>" +
          '<p class="package__desc">' + escapeHTML(p.description) + "</p>" +
          '<ul class="check-list">' + p.inclusions.map(function (x) { return "<li>" + icon("i-check") + "<span>" + escapeHTML(x) + "</span></li>"; }).join("") + "</ul>" +
          '<a class="btn ' + (p.badge ? "btn--primary" : "btn--ghost") + ' btn--block" href="#book" data-preset-package="' + id + '">' + escapeHTML(p.cta) + "</a>" +
        "</article>"
      );
    }).join("");
    done(wrap);
  }

  function renderRentals() {
    var grid = $("#rental-catalog");
    if (grid) {
      grid.innerHTML = !rentals.length ? emptyState("Rental equipment is being updated", "The catalog is being refreshed. Call to ask what’s available for your date.") : rentals.map(function (r) {
        var id = escapeHTML(r.id);
        return (
          '<article class="rent-card card card-hover" id="' + id + '" aria-labelledby="' + id + '-name">' +
            '<div class="rent-card__media">' +
              '<img src="' + escapeHTML(r.image) + '" alt="' + escapeHTML((r.illustrative ? "Illustration of a " : "") + r.name) + '" width="400" height="300" loading="lazy" decoding="async">' +
              (r.illustrative ? '<span class="label">Illustrative image</span>' : "") +
            "</div>" +
            '<div class="rent-card__body">' +
              '<h3 id="' + id + '-name">' + escapeHTML(r.name) + "</h3>" +
              '<div class="rent-card__price"><span class="label">From</span><span class="price-figure">' + money(r.price) + '</span><span class="unit">/' + escapeHTML(r.unit) + "</span></div>" +
              '<p class="rent-card__desc">' + escapeHTML(r.description) + "</p>" +
              (r.includes && r.includes.length ? '<p class="includes-label label">Proposed package contents</p><ul class="check-list">' + r.includes.map(function (x) { return "<li>" + icon("i-check") + "<span>" + escapeHTML(x) + "</span></li>"; }).join("") + "</ul>" : "") +
              '<a class="btn btn--ghost btn--block" href="#rent" data-preset-rental="' + id + '">Request rental</a>' +
            "</div>" +
          "</article>"
        );
      }).join("");
      done(grid);
    }
    var list = $("#rental-preview");
    if (list) {
      list.innerHTML = rentals.map(function (r) {
        return '<li><a href="rentals.html#' + encodeURIComponent(r.id) + '"><img src="' + escapeHTML(r.image) + '" alt="" width="72" height="54" loading="lazy" decoding="async"><span class="name">' + escapeHTML(r.name) + '</span><span class="price">From <strong>' + money(r.price) + "</strong>/" + escapeHTML(r.unit) + "</span></a></li>";
      }).join("");
    }
  }

  function initGallery() {
    var grid = $("#gallery-grid");
    var dialog = $("#lightbox");
    if (!grid) return;
    var items = CFG.gallery || [];
    if (!items.length) { grid.innerHTML = '<div class="empty-state"><strong>Photos are on the way</strong><p>Event photos will appear here soon. In the meantime, see the DJ packages and starting prices.</p><a class="btn btn--ghost" href="#bookings">See DJ packages</a></div>'; done(grid); return; }
    grid.innerHTML = items.map(function (g, i) {
      var media = g.type === "video"
        ? '<video src="' + escapeHTML(g.src) + '" poster="' + escapeHTML(g.poster) + '" width="' + g.width + '" height="' + g.height + '" muted loop playsinline preload="none" aria-hidden="true"></video><span class="play-badge label">Video</span>'
        : '<img src="' + escapeHTML(g.srcSmall || g.src) + '" srcset="' + (g.srcSmall ? escapeHTML(g.srcSmall) + " 640w, " : "") + escapeHTML(g.src) + " " + g.width + 'w" sizes="(max-width: 720px) 92vw, 45vw" width="' + g.width + '" height="' + g.height + '" alt="' + escapeHTML(g.alt) + '" loading="lazy" decoding="async">';
      return '<button class="gallery__item ph" style="--ph:' + escapeHTML(g.placeholder || "") + '" type="button" data-index="' + i + '" aria-label="View ' + (g.type === "video" ? "video" : "photo") + ": " + escapeHTML(g.caption) + '">' + media +
        '<span class="gallery__caption"><span>' + escapeHTML(g.caption) + '</span><span class="zoom" aria-hidden="true">' + (g.type === "video" ? icon("i-play", "i-play") : icon("i-expand")) + "</span></span></button>";
    }).join("");
    done(grid);

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
        el.src = g.src; el.poster = g.poster; el.controls = true; el.muted = true; el.loop = true; el.playsInline = true; el.autoplay = !reduceMotion;
        el.setAttribute("aria-label", g.alt);
      } else {
        el = document.createElement("img");
        el.src = g.src; el.alt = g.alt; el.width = g.width; el.height = g.height;
      }
      el.className = "ph";
      el.style.setProperty("--ph", g.placeholder || "");
      stage.insertBefore(el, stage.firstChild);
      caption.textContent = g.caption;
      count.textContent = (current + 1) + " of " + items.length;
    };
    grid.addEventListener("click", function (e) {
      var btn = e.target.closest(".gallery__item");
      if (!btn) return;
      trigger = btn;
      show(Number(btn.getAttribute("data-index")));
      dialog.showModal();
      document.body.classList.add("menu-open");
    });
    dialog.addEventListener("close", function () {
      var v = stage.querySelector("video");
      if (v) v.pause();
      document.body.classList.remove("menu-open");
      if (trigger) trigger.focus();
    });
    $("[data-lightbox-close]", dialog).addEventListener("click", function () { dialog.close(); });
    $("[data-lightbox-prev]", dialog).addEventListener("click", function () { show(current - 1); });
    $("[data-lightbox-next]", dialog).addEventListener("click", function () { show(current + 1); });
    dialog.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); show(current - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); show(current + 1); }
    });
    stage.addEventListener("click", function (e) { if (e.target === stage) dialog.close(); });
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
     Validation: on blur, then live while a field shows an error.
     Messages say how to fix the problem and never blame the user.
     ------------------------------------------------------------------ */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function fieldWrap(el) { return el.closest(".field"); }
  function errorEl(input) {
    var ids = (input.getAttribute("aria-describedby") || "").split(" ");
    for (var i = 0; i < ids.length; i++) { var e = document.getElementById(ids[i]); if (e && e.classList.contains("field-error")) return e; }
    return input.id ? document.getElementById(input.id + "-error") : null;
  }
  function setError(target, msg) {
    var wrap = fieldWrap(target);
    var err = errorEl(target);
    if (wrap) wrap.classList.toggle("is-invalid", !!msg);
    if (err) err.innerHTML = msg ? icon("i-alert") + "<span>" + escapeHTML(msg) + "</span>" : "";
    if (msg) target.setAttribute("aria-invalid", "true"); else target.removeAttribute("aria-invalid");
    if (err && target.id) {
      var d = (target.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
      if (d.indexOf(err.id) === -1) { d.push(err.id); target.setAttribute("aria-describedby", d.join(" ")); }
    }
    return !msg;
  }
  function labelText(input) {
    var l = input.id && document.querySelector('label[for="' + input.id + '"]');
    return l ? l.textContent.replace("*", "").replace("(optional)", "").trim().toLowerCase() : "this field";
  }
  function validateField(input) {
    var v = (input.value || "").trim();
    var name = labelText(input);
    if (input.required && !v) {
      var custom = input.getAttribute("data-required-msg");
      if (custom) return setError(input, custom);
      if (input.tagName === "SELECT" || input.type === "date" || input.type === "time") return setError(input, "Choose the " + name + ".");
      return setError(input, "Enter your " + name + ".");
    }
    if (!v) return setError(input, "");
    if (input.type === "email" && !EMAIL_RE.test(v)) return setError(input, "Check the email format, like name@example.com.");
    if (input.type === "tel" && v.replace(/\D/g, "").length < 10) return setError(input, "Include the area code, like (901) 555-0123.");
    if (input.type === "number") {
      var n = Number(v);
      if (!isFinite(n) || n < Number(input.min || 0) || Math.floor(n) !== n) return setError(input, "Enter a whole number of guests, like 75.");
    }
    if (input.type === "date") {
      if (!parseISODate(v)) return setError(input, "Choose a date from the calendar.");
      if (input.min && v < input.min) return setError(input, input.getAttribute("data-min-msg") || "Choose today or a later date.");
    }
    return setError(input, "");
  }
  function validateRadioGroup(group) {
    var checked = group.querySelector("input:checked");
    var msg = group.getAttribute("data-required-msg") || "Choose one of the options.";
    return setError(group, checked ? "" : msg);
  }
  function formatPhone(input) {
    var digits = input.value.replace(/\D/g, "");
    if (digits.length === 11 && digits[0] === "1") digits = digits.slice(1);
    if (digits.length === 10) input.value = "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
  }
  function validatable(form) {
    return $$("input, select, textarea", form).filter(function (i) {
      return i.type !== "hidden" && i.type !== "radio" && i.type !== "checkbox" && !i.closest(".honeypot") && !i.closest(".stepper") && i.id && errorEl(i);
    });
  }

  /* Email typo help, debounced until typing pauses */
  var COMMON_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com", "live.com", "msn.com", "comcast.net", "att.net"];
  function editDistance(a, b) {
    var m = [], i, j;
    for (i = 0; i <= a.length; i++) { m[i] = [i]; }
    for (j = 0; j <= b.length; j++) { m[0][j] = j; }
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  }
  function suggestEmail(value) {
    var at = value.lastIndexOf("@");
    if (at < 1) return null;
    var domain = value.slice(at + 1).toLowerCase();
    if (!domain || COMMON_DOMAINS.indexOf(domain) !== -1) return null;
    var best = null, bestD = 3;
    COMMON_DOMAINS.forEach(function (d) { var dist = editDistance(domain, d); if (dist < bestD) { bestD = dist; best = d; } });
    return best && bestD <= 2 ? value.slice(0, at + 1) + best : null;
  }
  function initEmailHelp(input) {
    var box = document.getElementById(input.id + "-suggest");
    if (!box) return;
    var check = debounce(function () {
      var s = suggestEmail(input.value.trim());
      if (!s) { box.hidden = true; box.innerHTML = ""; return; }
      box.innerHTML = "Did you mean <button type=\"button\"></button>?";
      box.querySelector("button").textContent = s;
      box.hidden = false;
      box.querySelector("button").addEventListener("click", function () {
        input.value = s;
        box.hidden = true;
        validateField(input);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      });
    }, 600);
    input.addEventListener("input", check);
  }

  /* Friendly date hints: full date plus "in 12 days" */
  function initDateHint(input) {
    var hint = document.getElementById(input.id + "-hint");
    if (!hint) return;
    var update = function () {
      var d = parseISODate(input.value);
      if (!d) { hint.textContent = ""; hint.removeAttribute("title"); return; }
      hint.textContent = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) + " · " + relativeDay(d);
      hint.title = fullDate(d);
    };
    input.addEventListener("input", update);
    input.addEventListener("change", update);
    update();
    return update;
  }

  /* Password fields get a show/hide toggle (applies to any password input) */
  function enhancePasswords(root) {
    $$('.field input[type="password"]', root || document).forEach(function (input) {
      if (input.closest(".pw-wrap")) return;
      var wrap = document.createElement("div");
      wrap.className = "pw-wrap";
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pw-toggle";
      btn.textContent = "Show";
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", "Show password");
      btn.setAttribute("aria-controls", input.id);
      btn.addEventListener("click", function () {
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.textContent = show ? "Hide" : "Show";
        btn.setAttribute("aria-pressed", String(show));
        btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      });
      wrap.appendChild(btn);
    });
  }

  /* ------------------------------------------------------------------
     Shared form behavior: validation, drafts, clear with undo,
     submission with progress, retry, success state
     ------------------------------------------------------------------ */
  function endpoint() { return "https://formsubmit.co/ajax/" + encodeURI(CFG.forms.endpointId); }
  function formToObject(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) {
      if (key === "_honey") return;
      if (data[key] !== undefined) data[key] += ", " + value; else data[key] = value;
    });
    Object.keys(data).forEach(function (k) { if (data[k] === "" && k.charAt(0) !== "_") delete data[k]; });
    return data;
  }
  function mailtoFallback(data, subject) {
    var body = Object.keys(data).filter(function (k) { return k.charAt(0) !== "_"; }).map(function (k) { return k + ": " + data[k]; }).join("\n");
    if (body.length > 1800) body = body.slice(0, 1800) + "\n…";
    return "mailto:" + CFG.business.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }
  function snapshot(form) {
    var s = {};
    $$("input, select, textarea", form).forEach(function (el) {
      if (!el.id || el.closest(".honeypot") || el.name === "_subject" || el.name === "_template" || el.name === "_captcha" || el.name === "Form") return;
      s[el.id] = el.type === "checkbox" || el.type === "radio" ? el.checked : el.value;
    });
    return s;
  }
  function restore(form, s) {
    Object.keys(s).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !form.contains(el)) return;
      if (el.type === "checkbox" || el.type === "radio") el.checked = !!s[id]; else el.value = s[id];
    });
  }
  function hasContent(s) {
    return Object.keys(s).some(function (k) { var v = s[k]; return v === true || (typeof v === "string" && v.trim() !== "" && !/^rt-qty-/.test(k)); });
  }

  function initForm(form, opts) {
    if (!form) return null;
    var submitBtn = $("[data-submit]", form);
    var alertBox = $("[data-form-alert]", form);
    var success = document.getElementById(opts.successId);
    var btnLabel = submitBtn.innerHTML;
    var sending = false;
    var draftKey = "djmeech-draft-" + form.id;
    var draftStatus = $("[data-draft-status]", form);
    var lastSaved = null;

    var refresh = function () { if (opts.refresh) opts.refresh(); };

    /* live validation */
    validatable(form).forEach(function (input) {
      var touched = false;
      input.addEventListener("blur", function () {
        if (input.type === "tel") formatPhone(input);
        touched = true;
        validateField(input);
      });
      input.addEventListener("input", function () {
        if ((touched || form.hasAttribute("data-submitted")) && fieldWrap(input).classList.contains("is-invalid")) validateField(input);
      });
      if (input.type === "email") initEmailHelp(input);
      if (input.type === "date") initDateHint(input);
    });
    $$('[role="radiogroup"][aria-required="true"]', form).forEach(function (group) {
      group.addEventListener("change", function () { if (fieldWrap(group).classList.contains("is-invalid")) validateRadioGroup(group); });
    });

    /* drafts: saved a moment after typing stops, restored on return */
    var renderDraftStatus = function () {
      if (!draftStatus) return;
      if (!lastSaved) { draftStatus.textContent = ""; draftStatus.removeAttribute("title"); return; }
      draftStatus.textContent = "Draft saved " + relativeFromNow(lastSaved);
      draftStatus.title = "Saved on " + fullDate(lastSaved, true);
    };
    var saveDraft = debounce(function () {
      if (form.hidden) return;
      var s = snapshot(form);
      if (!hasContent(s)) { storage.del(draftKey); lastSaved = null; renderDraftStatus(); return; }
      lastSaved = new Date();
      storage.set(draftKey, { at: lastSaved.getTime(), values: s });
      renderDraftStatus();
    }, 600);
    form.addEventListener("input", saveDraft);
    form.addEventListener("change", saveDraft);
    setInterval(renderDraftStatus, 30000);
    var clearDraft = function () { storage.del(draftKey); lastSaved = null; renderDraftStatus(); };

    var resetForm = function () {
      form.reset();
      form.removeAttribute("data-submitted");
      $$(".is-invalid", form).forEach(function (el) { el.classList.remove("is-invalid"); });
      $$(".field-error", form).forEach(function (el) { el.innerHTML = ""; });
      $$("[aria-invalid]", form).forEach(function (el) { el.removeAttribute("aria-invalid"); });
      $$(".email-suggest", form).forEach(function (el) { el.hidden = true; });
      alertBox.hidden = true;
      if (opts.afterReset) opts.afterReset();
      $$('input[type="date"]', form).forEach(function (el) { el.dispatchEvent(new Event("change")); });
      refresh();
    };

    /* clear form: confirm first, then offer undo */
    var clearBtn = $("[data-clear-form]", form);
    var confirmBox = $("[data-confirm-clear]", form);
    if (clearBtn && confirmBox) {
      clearBtn.addEventListener("click", function () {
        confirmBox.hidden = false;
        $("[data-confirm-yes]", confirmBox).focus();
      });
      $("[data-confirm-no]", confirmBox).addEventListener("click", function () { confirmBox.hidden = true; clearBtn.focus(); });
      $("[data-confirm-yes]", confirmBox).addEventListener("click", function () {
        var before = snapshot(form);
        resetForm();
        clearDraft();
        confirmBox.hidden = true;
        clearBtn.focus();
        toast("Form cleared.", { action: { label: "Undo", onClick: function () { restore(form, before); refresh(); saveDraft(); if (opts.afterRestore) opts.afterRestore(); } } });
      });
    }

    /* submission */
    var timers = [];
    var setLabel = function (html) { submitBtn.innerHTML = html; };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) return;
      form.setAttribute("data-submitted", "1");
      alertBox.hidden = true;
      if (opts.beforeValidate) opts.beforeValidate();

      var invalid = [];
      validatable(form).forEach(function (input) { if (!validateField(input)) invalid.push(input); });
      $$('[role="radiogroup"][aria-required="true"]', form).forEach(function (g) { if (!validateRadioGroup(g)) invalid.push(g.querySelector("input")); });
      if (opts.validateExtra) { var extra = opts.validateExtra(); if (extra) invalid.push(extra); }
      if (invalid.length) {
        invalid.sort(function (a, b) { return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1; });
        invalid[0].focus({ preventScroll: true });
        invalid[0].scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        if (!reduceMotion) {
          submitBtn.classList.remove("shake");
          void submitBtn.offsetWidth;
          submitBtn.classList.add("shake");
          submitBtn.addEventListener("animationend", function () { submitBtn.classList.remove("shake"); }, { once: true });
        }
        return;
      }

      var honey = form.querySelector('[name="_honey"]');
      if (honey && honey.value) { showSuccess({}); return; }

      var data = formToObject(form);
      sending = true;
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-busy", "true");
      // fast replies skip the loading state; slower ones show progress that updates
      timers.push(setTimeout(function () { setLabel('<span class="spinner" aria-hidden="true"></span>Sending your request…'); }, 300));
      timers.push(setTimeout(function () { setLabel('<span class="spinner" aria-hidden="true"></span>Still sending…'); }, 3000));
      timers.push(setTimeout(function () { setLabel('<span class="spinner" aria-hidden="true"></span>Taking longer than usual. Keep this page open…'); }, 8000));

      var controller = "AbortController" in window ? new AbortController() : null;
      timers.push(setTimeout(function () { if (controller) controller.abort(); }, 25000));

      fetch(endpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
        signal: controller ? controller.signal : undefined,
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (json) {
            if (!res.ok || String(json.success) !== "true") throw new Error(json.message || "Request failed (" + res.status + ")");
          });
        })
        .then(function () {
          stopTimers();
          submitBtn.setAttribute("data-state", "success");
          submitBtn.removeAttribute("aria-busy");
          setLabel(icon("i-check") + "Sent");
          setTimeout(function () { showSuccess(data); }, reduceMotion ? 0 : 700);
        })
        .catch(function () { stopTimers(); resetButton(); showFailure(data); });
    });
    function stopTimers() { timers.forEach(clearTimeout); timers = []; }
    function resetButton() {
      sending = false;
      submitBtn.disabled = false;
      submitBtn.removeAttribute("aria-busy");
      submitBtn.removeAttribute("data-state");
      setLabel(btnLabel);
    }
    function showSuccess(data) {
      var first = String(data.name || "").trim().split(/\s+/)[0];
      $("[data-success-title]", success).textContent = first ? "Thanks, " + first + "!" : "Thanks!";
      var emailSpot = $("[data-success-email]", success);
      if (emailSpot) emailSpot.textContent = data.email || "your email";
      clearDraft();
      resetButton();
      form.hidden = true;
      success.hidden = false;
      success.focus({ preventScroll: true });
      scrollToEl(success.closest(".form-card"));
    }
    function showFailure(data) {
      var b = CFG.business;
      alertBox.innerHTML =
        icon("i-alert") +
        '<div class="form-alert__body">' +
          "<strong>Your request didn’t go through.</strong>" +
          "<span>Your details are still here. Try again, or reach DJ Meech directly at <a href=\"" + escapeHTML(b.phoneHref) + '">' + escapeHTML(b.phoneDisplay) + "</a>.</span>" +
          '<div class="btn-row"><button type="button" class="btn btn--ghost btn--sm btn--icon-start" data-retry>' + icon("i-retry") + 'Try again</button><a class="btn btn--ghost btn--sm" href="' + escapeHTML(mailtoFallback(data, opts.mailSubject)) + '">Email these details instead</a></div>' +
        "</div>";
      alertBox.hidden = false;
      $("[data-retry]", alertBox).addEventListener("click", function () { form.requestSubmit(); });
      alertBox.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }

    var resetBtn = document.querySelector('[data-reset-form="' + form.id + '"]');
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        resetForm();
        success.hidden = true;
        form.hidden = false;
        var first = form.querySelector("input:not([type=hidden]):not([tabindex='-1'])");
        if (first) first.focus();
      });
    }

    /* restore a saved draft */
    var draft = storage.get(draftKey);
    if (draft && draft.values && hasContent(draft.values)) {
      restore(form, draft.values);
      lastSaved = new Date(draft.at);
      renderDraftStatus();
      refresh();
      if (opts.afterRestore) opts.afterRestore();
      $$('input[type="date"]', form).forEach(function (el) { el.dispatchEvent(new Event("change")); });
      toast("We restored your unfinished " + opts.noun + ".", { action: { label: "Start over", onClick: function () { resetForm(); clearDraft(); } } });
    }

    return { saveDraft: saveDraft };
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
    pkgSel.add(new Option("Custom event package", "Custom Event Package"));
    pkgSel.add(new Option("Not sure yet", "Not sure yet"));
    $("#bk-date").min = todayISO();
    typeSel.setAttribute("data-required-msg", "Choose the type of event.");
    pkgSel.setAttribute("data-required-msg", "Choose a package, or pick “Not sure yet”.");
    $("#bk-equipment-field [role=radiogroup]").setAttribute("data-required-msg", "Choose the option that fits your equipment needs.");

    var chip = $("#bk-estimate-chip");
    var chipText = $("#bk-estimate-text");
    var chipWrap = $("#bk-estimate-wrap");
    var hidden = { pkg: $("#bk-est-package"), hours: $("#bk-est-hours"), total: $("#bk-est-total"), cats: $("#bk-custom-cats") };

    var renderChip = function () {
      if (!hidden.pkg.value) { chip.hidden = true; return; }
      var hours = Number(hidden.hours.value) || 0;
      var text = hidden.pkg.value + (hours ? " + " + hours + (hours === 1 ? " extra hour" : " extra hours") : "") + " = " + hidden.total.value;
      chipText.textContent = text;
      chipWrap.title = "Estimate attached: " + text; // full text kept when truncated
      chip.hidden = false;
    };
    var clearEstimate = function () { hidden.pkg.value = hidden.hours.value = hidden.total.value = ""; renderChip(); };
    $("#bk-estimate-remove").addEventListener("click", function () {
      var before = { pkg: hidden.pkg.value, hours: hidden.hours.value, total: hidden.total.value };
      clearEstimate();
      pkgSel.focus();
      toast("Estimate removed from your request.", { action: { label: "Undo", onClick: function () { hidden.pkg.value = before.pkg; hidden.hours.value = before.hours; hidden.total.value = before.total; pkgSel.value = before.pkg; renderChip(); } } });
    });
    pkgSel.addEventListener("change", function () { if (hidden.pkg.value && pkgSel.value !== hidden.pkg.value) clearEstimate(); });

    function validateIfShown(input) { if (fieldWrap(input).classList.contains("is-invalid")) validateField(input); }
    var ctl = initForm(form, {
      successId: "booking-success",
      mailSubject: "DJ booking request",
      noun: "booking request",
      afterReset: function () { clearEstimate(); hidden.cats.value = ""; },
      afterRestore: renderChip,
    });
    var touch = function () { if (ctl) ctl.saveDraft(); };

    var api = {
      presetPackage: function (id) {
        var p = pkgById(id);
        if (!p) return;
        pkgSel.value = p.name;
        if (p.eventType && !typeSel.value) typeSel.value = p.eventType;
        if (hidden.pkg.value && hidden.pkg.value !== p.name) clearEstimate();
        validateIfShown(pkgSel); validateIfShown(typeSel); touch();
      },
      presetEventType: function (t) { if (CFG.eventTypes.indexOf(t) !== -1) { typeSel.value = t; validateIfShown(typeSel); touch(); } },
      attachEstimate: function (p, hours, total) {
        api.presetPackage(p.id);
        hidden.pkg.value = p.name;
        hidden.hours.value = String(hours);
        hidden.total.value = money(total);
        renderChip();
        touch();
      },
      attachCustom: function (cats) {
        pkgSel.value = "Custom Event Package";
        clearEstimate();
        hidden.cats.value = cats.join(", ");
        var map = { "Weddings": "Wedding", "Corporate Events": "Corporate Event", "Community Events": "Community Event", "Large Private Events": "Large Private Event" };
        var firstType = cats.map(function (c) { return map[c]; }).filter(Boolean)[0];
        if (firstType) typeSel.value = firstType;
        var details = $("#bk-details");
        if (cats.length && !details.value.trim()) details.value = "I’m interested in a custom package for: " + cats.join(", ") + ".\n\n";
        validateIfShown(pkgSel); validateIfShown(typeSel); touch();
      },
    };
    var params = new URLSearchParams(location.search);
    if (params.get("package")) api.presetPackage(params.get("package"));
    return api;
  }

  function goToBooking() {
    scrollToEl($("#book"));
    var name = $("#bk-name");
    setTimeout(function () { if (name && !name.value) name.focus({ preventScroll: true }); }, reduceMotion ? 0 : 650);
  }

  function initEstimator(booking) {
    var form = $("#estimator-form");
    if (!form || !packages.length) { if (form) form.closest("section").hidden = true; return; }
    var picks = $("#estimator-packages");
    var range = $("#estimator-hours");
    var opts = CFG.extraHour.options.slice().sort(function (a, b) { return a - b; });
    var rate = CFG.extraHour.price;
    var defaultPkg = packages.find(function (p) { return p.badge; }) || packages[0];

    picks.innerHTML = packages.map(function (p) {
      var id = "est-pkg-" + p.id;
      return '<div class="seg"><input type="radio" name="estPackage" id="' + id + '" value="' + escapeHTML(p.id) + '"' + (p === defaultPkg ? " checked" : "") + ">" +
        '<label for="' + id + '">' + icon("i-check", "tick") + '<span>' + escapeHTML(p.name.replace(/^The /, "")) + '</span><span class="amt">' + money(p.price) + "</span></label></div>";
    }).join("");
    range.max = String(opts.length - 1);
    range.value = "0";
    $("#estimator-ticks").innerHTML = opts.map(function (h) { return "<span>" + (h === 0 ? "0" : "+" + h + " hr") + "</span>"; }).join("");

    var state = function () {
      var checked = form.querySelector('input[name="estPackage"]:checked');
      var p = pkgById(checked ? checked.value : defaultPkg.id) || defaultPkg;
      var hours = opts[Number(range.value)] || 0;
      return { p: p, hours: hours, total: p.price + hours * rate };
    };
    var render = function () {
      var s = state();
      $("#estimator-total").textContent = money(s.total);
      range.style.setProperty("--fill", (opts.length > 1 ? (Number(range.value) / (opts.length - 1)) * 100 : 0) + "%");
      var hoursLabel = s.hours + (s.hours === 1 ? " hour" : " hours");
      range.setAttribute("aria-valuetext", hoursLabel + ", plus " + money(s.hours * rate));
      $("#estimator-hours-value").innerHTML = "<strong>" + hoursLabel + "</strong> of extra DJ time: +" + money(s.hours * rate);
      $("#estimator-lines").innerHTML =
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
      toast("Estimate added to your booking request: " + money(s.total) + ".");
      goToBooking();
    });
    render();
  }

  function initCustom(booking) {
    var form = $("#custom-form");
    if (!form) return;
    $("#custom-categories").innerHTML = CFG.customCategories.map(function (c, i) {
      var id = "custom-cat-" + i;
      return '<div class="chip"><input type="checkbox" id="' + id + '" name="customCategory" value="' + escapeHTML(c) + '"><label for="' + id + '">' + icon("i-plus", "i-plus") + icon("i-check", "i-check") + escapeHTML(c) + "</label></div>";
    }).join("");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var cats = $$('input[name="customCategory"]:checked', form).map(function (i) { return i.value; });
      if (booking) booking.attachCustom(cats);
      goToBooking();
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
      goToBooking();
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
    if (!rentals.length) picker.innerHTML = '<p class="hint">Equipment is being updated. Describe what you need in the details below.</p>';
    else picker.innerHTML = rentals.map(function (r) {
      var cid = "rt-item-" + r.id, qid = "rt-qty-" + r.id;
      return (
        '<div class="equip-row" data-id="' + escapeHTML(r.id) + '">' +
          '<label class="equip-check" for="' + cid + '"><input type="checkbox" id="' + cid + '" value="' + escapeHTML(r.id) + '">' +
            '<span><span class="nm">' + escapeHTML(r.name) + '</span><span class="pr">From ' + money(r.price) + "/" + escapeHTML(r.unit) + "</span></span></label>" +
          '<div class="stepper">' +
            '<button type="button" data-step="-1" aria-label="Decrease ' + escapeHTML(r.name) + ' quantity" disabled>−</button>' +
            '<input type="number" id="' + qid + '" min="1" max="' + MAX_QTY + '" value="1" inputmode="numeric" autocomplete="off" aria-label="' + escapeHTML(r.name) + ' quantity" disabled>' +
            '<button type="button" data-step="1" aria-label="Increase ' + escapeHTML(r.name) + ' quantity" disabled>+</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");

    var start = $("#rt-start"), ret = $("#rt-return");
    var today = todayISO();
    start.min = today;
    ret.min = today;
    ret.setAttribute("data-min-msg", "Pick a return date on or after the start date.");
    $("#rt-handoff-field [role=radiogroup]").setAttribute("data-required-msg", "Choose pickup or delivery.");
    start.addEventListener("change", function () {
      ret.min = start.value && start.value >= today ? start.value : today;
      if (ret.value) validateField(ret);
      update();
    });
    ret.addEventListener("change", update);

    var totalEl = $("#rt-estimate-total"), linesEl = $("#rt-estimate-lines"), emptyEl = $("#rt-estimate-empty");
    var summaryEquip = $("#rt-equipment-summary"), summaryEst = $("#rt-estimate-summary");

    var clampQty = function (input) {
      var n = Math.round(Number(input.value));
      if (!isFinite(n) || n < 1) n = 1;
      if (n > MAX_QTY) n = MAX_QTY;
      input.value = String(n);
      return n;
    };
    var syncRow = function (row) {
      var cb = row.querySelector('input[type="checkbox"]'), qty = row.querySelector('input[type="number"]');
      row.classList.toggle("is-on", cb.checked);
      qty.disabled = !cb.checked;
      var n = clampQty(qty);
      row.querySelector('[data-step="-1"]').disabled = !cb.checked || n <= 1;
      row.querySelector('[data-step="1"]').disabled = !cb.checked || n >= MAX_QTY;
    };
    var selected = function () {
      return $$(".equip-row", picker).filter(function (row) { return row.querySelector('input[type="checkbox"]').checked; })
        .map(function (row) { return { item: rentalById(row.getAttribute("data-id")), qty: clampQty(row.querySelector('input[type="number"]')) }; });
    };
    var rentalDays = function () {
      var s = parseISODate(start.value), r = parseISODate(ret.value);
      if (!s || !r || r < s) return null;
      return Math.max(1, Math.round((r - s) / 86400000));
    };

    function update() {
      $$(".equip-row", picker).forEach(syncRow);
      var sel = selected();
      var days = rentalDays();
      var delivery = form.querySelector('input[name="Pickup or Delivery"]:checked');
      var wantsDelivery = delivery && delivery.value !== "Pickup";
      summaryEquip.value = sel.map(function (s) { return s.item.name + " × " + s.qty; }).join("; ");
      if (!sel.length) {
        emptyEl.hidden = false;
        linesEl.innerHTML = "";
        totalEl.textContent = "$0";
        summaryEst.value = "";
        return;
      }
      emptyEl.hidden = true;
      var d = days || 1;
      var html = sel.map(function (s) {
        return "<li><span>" + escapeHTML(s.item.name) + " × " + s.qty + (days ? " × " + d + (d === 1 ? " day" : " days") : "") + "</span><span>" + money(s.item.price * s.qty * d) + "</span></li>";
      }).join("");
      var total = sel.reduce(function (sum, s) { return sum + s.item.price * s.qty; }, 0) * d;
      if (wantsDelivery) { html += "<li><span>Delivery and setup (starting at)</span><span>" + money(CFG.delivery.price) + "</span></li>"; total += CFG.delivery.price; }
      if (!days) html += "<li><span>Add your rental dates to estimate the full rental period. Showing 1 day.</span><span></span></li>";
      linesEl.innerHTML = html;
      totalEl.textContent = money(total);
      summaryEst.value = money(total) + " (" + (days ? d + (d === 1 ? " day" : " days") : "1 day, dates not set") + (wantsDelivery ? ", incl. delivery from " + money(CFG.delivery.price) : "") + ")";
    }

    var validateEquipment = function () {
      var field = $("#rt-equipment-field"), err = $("#rt-equipment-error");
      if (!rentals.length) return null;
      if (!selected().length) {
        field.classList.add("is-invalid");
        err.innerHTML = icon("i-alert") + "<span>Tick at least one item you’d like to rent.</span>";
        return picker.querySelector('input[type="checkbox"]');
      }
      field.classList.remove("is-invalid");
      err.innerHTML = "";
      return null;
    };

    picker.addEventListener("change", function (e) {
      if (e.target.type === "checkbox") syncRow(e.target.closest(".equip-row"));
      update();
      if (form.hasAttribute("data-submitted")) validateEquipment();
    });
    // quantities are clamped on "change" (blur/enter), not while still typing
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
      form.dispatchEvent(new Event("change"));
    });
    $$('input[name="Pickup or Delivery"]', form).forEach(function (r) { r.addEventListener("change", update); });

    initForm(form, {
      successId: "rental-success",
      mailSubject: "Equipment rental inquiry",
      noun: "rental inquiry",
      validateExtra: validateEquipment,
      refresh: update,
      beforeValidate: function () { ret.min = start.value && start.value >= today ? start.value : today; update(); },
      afterReset: function () { ret.min = today; $("#rt-equipment-field").classList.remove("is-invalid"); $("#rt-equipment-error").innerHTML = ""; },
    });

    var preset = function (id) {
      var row = picker.querySelector('.equip-row[data-id="' + id + '"]');
      if (!row) return null;
      row.querySelector('input[type="checkbox"]').checked = true;
      syncRow(row);
      update();
      if (form.hasAttribute("data-submitted")) validateEquipment();
      return row.querySelector('input[type="checkbox"]');
    };
    document.addEventListener("click", function (e) {
      var a = e.target.closest("[data-preset-rental]");
      if (!a) return;
      e.preventDefault();
      var cb = preset(a.getAttribute("data-preset-rental"));
      scrollToEl($("#rent"));
      setTimeout(function () { if (cb) cb.focus({ preventScroll: true }); }, reduceMotion ? 0 : 650);
    });
    var params = new URLSearchParams(location.search);
    if (params.get("item")) preset(params.get("item"));
    update();
  }

  /* ------------------------------------------------------------------
     Scroll reveal (fade and rise, 50ms stagger). Content is visible
     without it, and below-the-fold items only.
     ------------------------------------------------------------------ */
  function initReveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    var targets = $$("[data-reveal]");
    $$("[data-reveal-group]").forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        if (child.classList.contains("loading-status")) return;
        child.style.setProperty("--reveal-delay", Math.min(i, 8) * 50 + "ms");
        targets.push(child);
      });
    });
    var vh = window.innerHeight;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) { entry.target.classList.add("is-revealed"); io.unobserve(entry.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    targets.forEach(function (el) {
      if (el.getBoundingClientRect().top > vh * 0.92) { el.classList.add("reveal-pending"); io.observe(el); }
    });
    window.addEventListener("hashchange", function () { $$(".reveal-pending:not(.is-revealed)").forEach(function (el) { el.classList.add("is-revealed"); }); });
  }

  /* ------------------------------------------------------------------
     Mobile action bar, within thumb reach
     ------------------------------------------------------------------ */
  function initCallBar() {
    var bar = $("#call-bar");
    if (!bar) return;
    document.body.classList.add("has-call-bar");
    var zones = new Set();
    var update = function () {
      var show = window.scrollY > window.innerHeight * 0.6 && zones.size === 0;
      bar.classList.toggle("is-visible", show);
      bar.setAttribute("aria-hidden", String(!show));
      $$("a", bar).forEach(function (a) { a.tabIndex = show ? 0 : -1; });
    };
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting) zones.add(entry.target); else zones.delete(entry.target); });
        update();
      });
      $$("#book, #rent, #contact, .site-footer").forEach(function (z) { io.observe(z); });
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
  enhancePasswords();
  initReveal();
  initCallBar();

  window.DJM = { toast: toast, enhancePasswords: enhancePasswords, relativeFromNow: relativeFromNow };

  if (location.hash.length > 1) {
    var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) setTimeout(function () { target.scrollIntoView({ block: "start" }); }, 60);
  }
})();
