/* =========================================================================
   antep — Guide-avatar (Web Component, rendu placeholder SVG)
   -------------------------------------------------------------------------
   Couche 1 « orchestration » du guide-avatar, INDÉPENDANTE de Rive.

   Modèle d'interaction :
     • Auto (dès l'activation), CHAQUE section une seule fois :
         - scroll-into-view : section qui arrive au centre de l'écran
           (IntersectionObserver) — actif sur TOUS les supports ;
         - desktop (souris)  : le survol prolongé (dwell) complète en plus.
     • Garde-fou : dès que TOUTES les zones ont été lancées (même interrompues),
       le mode auto s'éteint (desktop ET mobile). Plus aucune narration spontanée.
     • Porte-voix : un petit bouton SVG (mégaphone) injecté à côté du `.sec-tag`
       de chaque section, TOUJOURS actif, pour (ré)écouter à la demande.

   Autres : lip-sync des visèmes (Azure 0..21), émotion par zone, i18n FR/EN
   (document.documentElement.lang observé), interruption, a11y, reduced-motion,
   audio jamais préchargé (fetch au déclenchement). Dégrade en silence si le
   manifeste / l'audio / les visèmes manquent.

   Le rendu SVG est un PLACEHOLDER : cette logique est réutilisable telle quelle
   quand on branchera le vrai personnage Rive (.riv) — il suffira de remplacer la
   couche `Face` en gardant setEyes / setMouth / setEmotion / blink.

   Intégration : <script src="guide-avatar.js" defer><\/script> (auto-montage).
   ========================================================================= */
(function () {
  "use strict";

  // --- Réglages ------------------------------------------------------------
  var DWELL_MS = 450;          // survol minimal (desktop) avant narration
  var SCROLL_MS = 450;         // stabilisation du scroll (mobile) avant narration
  var EYE_MAX = 3.2;
  var LERP = 0.22;
  var REDUCED = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NO_HOVER = window.matchMedia &&
    window.matchMedia("(hover: none)").matches;

  // --- Visèmes Azure (0..21) -> {open,wide,round} --------------------------
  var VISEME = {
    0:  [0.00, 0.35, 0.20], 1:  [0.50, 0.50, 0.10], 2:  [0.90, 0.40, 0.10],
    3:  [0.70, 0.25, 0.60], 4:  [0.42, 0.55, 0.20], 5:  [0.32, 0.45, 0.30],
    6:  [0.22, 0.90, 0.00], 7:  [0.30, 0.12, 0.90], 8:  [0.60, 0.22, 0.80],
    9:  [0.72, 0.32, 0.50], 10: [0.62, 0.32, 0.55], 11: [0.72, 0.50, 0.20],
    12: [0.40, 0.42, 0.20], 13: [0.32, 0.42, 0.42], 14: [0.42, 0.52, 0.12],
    15: [0.12, 0.72, 0.00], 16: [0.24, 0.32, 0.60], 17: [0.22, 0.52, 0.12],
    18: [0.12, 0.62, 0.10], 19: [0.26, 0.52, 0.12], 20: [0.36, 0.46, 0.20],
    21: [0.00, 0.42, 0.20]
  };

  // --- Émotion antep -> {brow, eye, smile, tilt} ---------------------------
  var EMOTION = {
    neutre:       { brow: 0.00, eye: 1.00, smile: 0.12, tilt: 0 },
    fier:         { brow: 0.15, eye: 1.00, smile: 0.30, tilt: 0 },
    joueur:       { brow: 0.25, eye: 1.05, smile: 0.55, tilt: -4 },
    curieux:      { brow: 0.45, eye: 1.05, smile: 0.18, tilt: 6 },
    enthousiaste: { brow: 0.35, eye: 1.15, smile: 0.62, tilt: -2 }
  };

  // Mégaphone (icône « porte-voix », style Lucide).
  var MEGAPHONE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" style="width:100%;height:100%">' +
    '<path d="m3 11 18-5v12L3 14v-3z"/>' +
    '<path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // =======================================================================
  // Face — rendu SVG placeholder (seule couche à remplacer pour Rive).
  // =======================================================================
  function Face(root) {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    svg.setAttribute("aria-hidden", "true");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.innerHTML =
      '<defs>' +
      '  <radialGradient id="skin" cx="50%" cy="42%" r="65%">' +
      '    <stop offset="0%" stop-color="#2a2450"/>' +
      '    <stop offset="100%" stop-color="#141033"/>' +
      '  </radialGradient>' +
      '  <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">' +
      '    <stop offset="0%" stop-color="#ff8a3d"/>' +
      '    <stop offset="100%" stop-color="#ff4d8d"/>' +
      '  </linearGradient>' +
      '</defs>' +
      '<g id="head">' +
      '  <circle cx="60" cy="60" r="52" fill="url(#skin)" stroke="url(#ring)" stroke-width="3"/>' +
      '  <g id="browL" stroke="#ff8a3d" stroke-width="3.2" stroke-linecap="round">' +
      '    <line x1="34" y1="44" x2="50" y2="42"/></g>' +
      '  <g id="browR" stroke="#ff8a3d" stroke-width="3.2" stroke-linecap="round">' +
      '    <line x1="70" y1="42" x2="86" y2="44"/></g>' +
      '  <g id="eyeL"><ellipse cx="44" cy="56" rx="9" ry="10" fill="#f4f1ff"/>' +
      '    <circle id="pupL" cx="44" cy="56" r="4.4" fill="#141033"/></g>' +
      '  <g id="eyeR"><ellipse cx="76" cy="56" rx="9" ry="10" fill="#f4f1ff"/>' +
      '    <circle id="pupR" cx="76" cy="56" r="4.4" fill="#141033"/></g>' +
      '  <path id="mouth" fill="#2a0f2e" stroke="#ff4d8d" stroke-width="2" stroke-linejoin="round"/>' +
      '</g>';
    root.appendChild(svg);

    this.head = svg.querySelector("#head");
    this.pupL = svg.querySelector("#pupL");
    this.pupR = svg.querySelector("#pupR");
    this.eyeL = svg.querySelector("#eyeL");
    this.eyeR = svg.querySelector("#eyeR");
    this.browL = svg.querySelector("#browL");
    this.browR = svg.querySelector("#browR");
    this.mouth = svg.querySelector("#mouth");

    this.tEyeX = 0; this.tEyeY = 0; this.cEyeX = 0; this.cEyeY = 0;
    this.tOpen = 0; this.tWide = 0.35; this.tRound = 0.2;
    this.cOpen = 0; this.cWide = 0.35; this.cRound = 0.2;
    this.emo = EMOTION.neutre;
    this.blinkK = 1;
  }
  Face.prototype.setEyes = function (x, y) { this.tEyeX = x; this.tEyeY = y; };
  Face.prototype.setMouth = function (o, w, r) { this.tOpen = o; this.tWide = w; this.tRound = r; };
  Face.prototype.setEmotion = function (name) { this.emo = EMOTION[name] || EMOTION.neutre; };
  Face.prototype.render = function (breathe) {
    var t = REDUCED ? 1 : LERP;
    this.cEyeX = lerp(this.cEyeX, this.tEyeX, t);
    this.cEyeY = lerp(this.cEyeY, this.tEyeY, t);
    this.cOpen = lerp(this.cOpen, this.tOpen, t);
    this.cWide = lerp(this.cWide, this.tWide, t);
    this.cRound = lerp(this.cRound, this.tRound, t);
    var e = this.emo;

    var dx = this.cEyeX * EYE_MAX, dy = this.cEyeY * EYE_MAX;
    this.pupL.setAttribute("cx", 44 + dx); this.pupL.setAttribute("cy", 56 + dy);
    this.pupR.setAttribute("cx", 76 + dx); this.pupR.setAttribute("cy", 56 + dy);
    var sy = Math.max(0.06, this.blinkK) * e.eye;
    this.eyeL.setAttribute("transform", "translate(44 56) scale(1 " + sy + ") translate(-44 -56)");
    this.eyeR.setAttribute("transform", "translate(76 56) scale(1 " + sy + ") translate(-76 -56)");

    var by = -e.brow * 6;
    this.browL.setAttribute("transform", "translate(0 " + by + ")");
    this.browR.setAttribute("transform", "translate(0 " + by + ")");

    var cx = 60, cy = 84;
    var W = 20 * (0.5 + 0.5 * this.cWide) * (1 - 0.35 * this.cRound);
    var H = 20 * this.cOpen + 1.5;
    var smile = e.smile * 7;
    var xL = cx - W, xR = cx + W, yC = cy - smile;
    var d = "M " + xL + " " + yC +
            " Q " + cx + " " + (cy - H / 2 - smile) + " " + xR + " " + yC +
            " Q " + cx + " " + (cy + H / 2) + " " + xL + " " + yC + " Z";
    this.mouth.setAttribute("d", d);

    this.head.setAttribute("transform",
      "translate(60 62) rotate(" + e.tilt + ") scale(" + breathe + ") translate(-60 -62)");
  };
  Face.prototype.blink = function () {
    if (REDUCED) return;
    var self = this, t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var k = (ts - t0) / 140;
      self.blinkK = k < 0.5 ? 1 - k * 2 : (k - 0.5) * 2;
      if (k < 1) requestAnimationFrame(step); else self.blinkK = 1;
    }
    requestAnimationFrame(step);
  };

  // =======================================================================
  // Avatar — orchestration.
  // =======================================================================
  function Avatar(manifest) {
    this.zones = manifest.zones || [];
    this.byKey = {};
    var i;
    for (i = 0; i < this.zones.length; i++) this.byKey[this.zones[i].key] = this.zones[i];
    this.active = false;
    this.muted = false;
    this.dwellTimer = null;
    this.scrollTimer = null;
    this.cand = null;
    this.current = null;
    this.visemes = null;
    this.visIdx = 0;
    this.played = {};            // clés déjà lancées (garde-fou)
    this.playedCount = 0;
    this.autoOff = false;        // mode auto éteint une fois tout lancé
    this.sayBtns = {};           // key -> bouton porte-voix
    this.audio = new Audio();
    this.audio.preload = "none"; // jamais de préchargement (données mobiles)
    this.lang = (document.documentElement.lang || "fr").slice(0, 2) === "en" ? "en" : "fr";
    this._buildDom();
    this._injectMegaphones();
    this._wire();
    this._loop();
  }

  Avatar.prototype._buildDom = function () {
    var host = document.createElement("div");
    host.setAttribute("data-antep-guide", "");
    var sh = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var css =
      ":host{all:initial}" +
      ".wrap{position:fixed;right:20px;bottom:20px;z-index:2147483000;" +
      "font-family:Poppins,system-ui,sans-serif}" +
      ".card{width:132px;height:132px;border-radius:50%;background:#070622;" +
      "box-shadow:0 10px 30px rgba(0,0,0,.45);position:relative;cursor:pointer;" +
      "transition:transform .2s}" +
      ".card:hover{transform:translateY(-3px)}" +
      ".activate{position:absolute;inset:0;display:flex;align-items:center;" +
      "justify-content:center;flex-direction:column;gap:6px;border-radius:50%;" +
      "border:2px solid transparent;background:" +
      "linear-gradient(#070622,#070622) padding-box," +
      "linear-gradient(135deg,#ff8a3d,#ff4d8d) border-box;color:#f4f1ff;" +
      "font-size:11px;text-align:center;padding:0 10px;cursor:pointer;" +
      "animation:pulse 2.4s ease-in-out infinite}" +
      "@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,77,141,.5)}" +
      "50%{box-shadow:0 0 0 10px rgba(255,77,141,0)}}" +
      ".activate svg{width:22px;height:22px;fill:#ff8a3d}" +
      ".controls{position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);" +
      "display:flex;gap:6px}" +
      ".controls button{all:unset;width:26px;height:26px;border-radius:50%;" +
      "background:#1a1440;color:#f4f1ff;display:flex;align-items:center;" +
      "justify-content:center;cursor:pointer;font-size:13px;" +
      "box-shadow:0 2px 8px rgba(0,0,0,.4)}" +
      ".controls button:focus-visible{outline:2px solid #ff8a3d}" +
      ".hidden{display:none}" +
      "@media (max-width:640px){.wrap{right:12px;bottom:12px}" +
      ".card{width:90px;height:90px}.activate{font-size:9px;gap:3px}" +
      ".activate svg{width:18px;height:18px}.controls button{width:24px;height:24px}}" +
      "@media (prefers-reduced-motion: reduce){.activate{animation:none}}";
    var style = document.createElement("style");
    style.textContent = css;
    sh.appendChild(style);

    var wrap = document.createElement("div");
    wrap.className = "wrap";
    wrap.innerHTML =
      '<div class="card" part="card">' +
      '  <button class="activate" type="button" aria-label="Activer le guide vocal">' +
      '    <svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>' +
      '    <span>Activer le guide</span>' +
      '  </button>' +
      '  <div class="face-slot hidden"></div>' +
      '  <div class="controls hidden">' +
      '    <button class="mute" type="button" aria-label="Couper le son" title="Couper le son">♪</button>' +
      '    <button class="close" type="button" aria-label="Masquer le guide" title="Masquer le guide">×</button>' +
      '  </div>' +
      '</div>';
    sh.appendChild(wrap);

    this.host = host;
    this.card = wrap.querySelector(".card");
    this.btnActivate = wrap.querySelector(".activate");
    this.faceSlot = wrap.querySelector(".face-slot");
    this.controls = wrap.querySelector(".controls");
    this.btnMute = wrap.querySelector(".mute");
    this.btnClose = wrap.querySelector(".close");
    document.body.appendChild(host);
  };

  // Injecte un bouton « porte-voix » à côté du .sec-tag de chaque section.
  Avatar.prototype._injectMegaphones = function () {
    var self = this;
    var st = document.createElement("style");
    st.textContent =
      ".antep-guide-say{display:inline-flex;align-items:center;justify-content:center;" +
      "vertical-align:middle;margin-left:8px;width:1.4em;height:1.4em;padding:2px;" +
      "border:0;background:transparent;color:#ff8a3d;cursor:pointer;border-radius:6px;" +
      "line-height:0;transition:transform .15s,color .15s}" +
      ".antep-guide-say:hover{transform:scale(1.18)}" +
      ".antep-guide-say:focus-visible{outline:2px solid #ff8a3d;outline-offset:2px}" +
      ".antep-guide-say.playing{color:#ff4d8d}";
    document.head.appendChild(st);

    this.zones.forEach(function (z) {
      var sec = document.querySelector(z.selector);
      if (!sec) return;
      var tag = sec.querySelector(".sec-tag");
      if (!tag) return;                 // pas d'ancre (ex. #top) -> pas de bouton
      var b = document.createElement("button");
      b.type = "button";
      b.className = "antep-guide-say";
      b.setAttribute("aria-label", "Écouter la présentation de cette section");
      b.title = "Écouter";
      b.innerHTML = MEGAPHONE;
      b.addEventListener("click", function () {
        self._ensureActive();
        self.playZone(z.key);           // manuel : joue toujours
      });
      if (tag.parentNode) tag.parentNode.insertBefore(b, tag.nextSibling);
      self.sayBtns[z.key] = b;
    });
  };

  Avatar.prototype._wire = function () {
    var self = this;

    this.btnActivate.addEventListener("click", function () { self.activate(); });
    this.btnMute.addEventListener("click", function () { self.toggleMute(); });
    this.btnClose.addEventListener("click", function () { self.hide(); });

    // Langue : suit document.documentElement.lang.
    var mo = new MutationObserver(function () {
      self.lang = (document.documentElement.lang || "fr").slice(0, 2) === "en" ? "en" : "fr";
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

    if (!NO_HOVER) {
      // Desktop (souris) : le regard suit le pointeur + survol prolongé (dwell)
      // comme déclencheur SUPPLÉMENTAIRE. Le scroll-into-view ci-dessous reste
      // actif partout ; le garde-fou « une fois par section » évite les doublons.
      window.addEventListener("pointermove", function (e) {
        var r = self.card.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var nx = clamp((e.clientX - cx) / (window.innerWidth * 0.5), -1, 1);
        var ny = clamp((e.clientY - cy) / (window.innerHeight * 0.5), -1, 1);
        if (self.face) self.face.setEyes(nx, ny);
      }, { passive: true });

      this.zones.forEach(function (z) {
        var el = document.querySelector(z.selector);
        if (!el) return;
        el.addEventListener("pointerenter", function () { self._dwell(z.key); });
        el.addEventListener("pointerleave", function () { self._cancelDwell(); });
      });
    }

    // Scroll-into-view : auto quand une section arrive au centre de l'écran.
    // Actif sur TOUS les supports (desktop inclus) — sur tactile c'est le seul
    // déclencheur ; sur desktop il complète le survol.
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) self._scrollCandidate(en.target.getAttribute("data-guide-key"));
        });
      }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
      this.zones.forEach(function (z) {
        var el = document.querySelector(z.selector);
        if (el) { el.setAttribute("data-guide-key", z.key); io.observe(el); }
      });
    }
  };

  // Auto desktop (survol).
  Avatar.prototype._dwell = function (key) {
    var self = this;
    if (!this.active || this.autoOff || this.played[key]) return;
    this._cancelDwell();
    this.dwellTimer = setTimeout(function () {
      if (!self.autoOff && !self.played[key]) self.playZone(key);   // re-check (anti-doublon)
    }, DWELL_MS);
  };
  Avatar.prototype._cancelDwell = function () {
    if (this.dwellTimer) { clearTimeout(this.dwellTimer); this.dwellTimer = null; }
  };

  // Auto mobile (scroll-into-view, stabilisé).
  Avatar.prototype._scrollCandidate = function (key) {
    var self = this;
    this.cand = key;
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(function () {
      if (self.cand === key && self.active && !self.autoOff && !self.played[key]) self.playZone(key);
    }, SCROLL_MS);
  };

  // Monte le visage sans jouer la salutation (utilisé par le porte-voix).
  Avatar.prototype._ensureActive = function () {
    if (this.active) return;
    this.active = true;
    this.btnActivate.classList.add("hidden");
    this.faceSlot.classList.remove("hidden");
    this.controls.classList.remove("hidden");
    this.face = new Face(this.faceSlot);
    if (!REDUCED) {
      var self = this;
      (function blinkLoop() {
        var wait = 2600 + Math.random() * 3200;
        setTimeout(function () { if (self.face) self.face.blink(); blinkLoop(); }, wait);
      })();
    }
  };

  // Activation par le gros bouton : monte + salutation (zone d'accueil).
  Avatar.prototype.activate = function () {
    if (this.active) return;
    this._ensureActive();
    var greet = this.byKey.hero ? "hero" : (this.zones[0] && this.zones[0].key);
    if (greet) this.playZone(greet);
  };

  Avatar.prototype._markPlayed = function (key) {
    if (!this.played[key]) {
      this.played[key] = 1;
      this.playedCount++;
      if (this.playedCount >= this.zones.length) this.autoOff = true;   // garde-fou
    }
  };

  Avatar.prototype.playZone = function (key) {
    var z = this.byKey[key];
    if (!z || !this.active) return;
    var n = z.narrations && (z.narrations[this.lang] || z.narrations.fr || z.narrations.en);
    if (!n || !n.audioUrl) return;
    this._markPlayed(key);
    this.current = key;
    if (this.face) this.face.setEmotion(z.emotion);

    // État visuel du porte-voix (celui en cours seulement).
    var k;
    for (k in this.sayBtns) if (this.sayBtns[k]) this.sayBtns[k].classList.remove("playing");
    if (this.sayBtns[key]) this.sayBtns[key].classList.add("playing");

    try { this.audio.pause(); } catch (e) {}   // interruption
    this.visemes = null; this.visIdx = 0;
    var self = this;

    if (n.visemeUrl) {
      fetch(n.visemeUrl, { mode: "cors" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (track) {
          if (self.current === key && Array.isArray(track)) self.visemes = track;
        })
        .catch(function () {});
    }

    this.audio.src = n.audioUrl;
    this.audio.muted = this.muted;
    this.audio.onended = function () {
      if (self.current === key) {
        self.current = null;
        if (self.face) self.face.setMouth(0, 0.35, 0.2);
      }
      if (self.sayBtns[key]) self.sayBtns[key].classList.remove("playing");
    };
    var p = this.audio.play();
    if (p && p.catch) p.catch(function () {/* autoplay bloqué : ignore */});
  };

  Avatar.prototype.toggleMute = function () {
    this.muted = !this.muted;
    this.audio.muted = this.muted;
    this.btnMute.textContent = this.muted ? "✕" : "♪";
    this.btnMute.setAttribute("aria-label", this.muted ? "Réactiver le son" : "Couper le son");
  };

  Avatar.prototype.hide = function () {
    try { this.audio.pause(); } catch (e) {}
    this._cancelDwell();
    if (this.host && this.host.parentNode) this.host.parentNode.removeChild(this.host);
  };

  Avatar.prototype._loop = function () {
    var self = this, t0 = performance.now();
    function frame(ts) {
      if (self.face) {
        if (self.current && !self.audio.paused && self.visemes) {
          var ms = self.audio.currentTime * 1000, tr = self.visemes;
          while (self.visIdx < tr.length - 1 && tr[self.visIdx + 1].t <= ms) self.visIdx++;
          while (self.visIdx > 0 && tr[self.visIdx].t > ms) self.visIdx--;
          var v = VISEME[tr[self.visIdx].id] || VISEME[0];
          self.face.setMouth(v[0], v[1], v[2]);
        } else if (self.current && !self.audio.paused && !self.visemes) {
          var a = 0.25 + 0.35 * Math.abs(Math.sin(ts / 90));
          self.face.setMouth(a, 0.45, 0.2);
        } else if (!self.current) {
          self.face.setMouth(0, 0.35, 0.2);
        }
        var breathe = REDUCED ? 1 : 1 + Math.sin((ts - t0) / 1400) * 0.012;
        self.face.render(breathe);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  // =======================================================================
  // Auto-montage.
  // =======================================================================
  function boot() {
    var el = document.getElementById("guide-manifest");
    if (!el) return;
    var manifest;
    try { manifest = JSON.parse(el.textContent); } catch (e) { return; }
    if (!manifest || !manifest.zones || !manifest.zones.length) return;
    // eslint-disable-next-line no-new
    new Avatar(manifest);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
