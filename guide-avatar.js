/* =========================================================================
   antep — Guide-avatar (Web Component, rendu placeholder SVG)
   -------------------------------------------------------------------------
   Couche 1 « orchestration » du guide-avatar, INDÉPENDANTE de Rive :
     • lit le manifeste injecté (<script id="guide-manifest">) ;
     • affiche un visage SVG « vivant » (yeux qui suivent le pointeur,
       clignement, respiration) monté en position fixed ;
     • bouton d'activation (déverrouillage audio par geste utilisateur) ;
     • au survol prolongé (dwell) d'une zone : joue l'audio + lip-sync des
       visèmes (Azure 0..21 réduits à des paramètres de bouche) + émotion ;
     • i18n FR/EN via document.documentElement.lang (observé en direct) ;
     • interruption (nouvelle zone), repli tactile (tap), a11y, reduced-motion ;
     • dégrade en silence si le manifeste, l'audio ou les visèmes manquent.

   Le rendu SVG est un PLACEHOLDER : toute cette logique est réutilisable telle
   quelle quand on branchera le vrai personnage Rive (.riv). Il suffira de
   remplacer la couche `Face` (rendu) en gardant les mêmes entrées :
     setEyes(x,y) · setMouth(open,wide,round) · setEmotion(name) · blink() …

   Intégration : <script src="guide-avatar.js" defer><\/script> — le composant
   s'auto-monte si un manifeste est présent. Aucune dépendance externe.
   ========================================================================= */
(function () {
  "use strict";

  // --- Réglages ------------------------------------------------------------
  var DWELL_MS = 450;          // survol minimal avant de déclencher la narration
  var EYE_MAX = 3.2;           // amplitude max du déplacement des pupilles (px SVG)
  var LERP = 0.22;             // vitesse d'interpolation (0..1) vers les cibles
  var REDUCED = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NO_HOVER = window.matchMedia &&
    window.matchMedia("(hover: none)").matches;

  // --- Visèmes Azure (0..21) -> paramètres de bouche {open,wide,round} -----
  // Placeholder phonétiquement approximatif : suffisant pour un lip-sync lisible.
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

  // --- Émotion antep -> expression {brow, eye, smile, tilt} ----------------
  // brow: hauteur des sourcils (+ = levés) ; eye: ouverture ; smile: courbe
  // des commissures (+ = sourire) ; tilt: inclinaison de tête (deg).
  var EMOTION = {
    neutre:       { brow: 0.00, eye: 1.00, smile: 0.12, tilt: 0 },
    fier:         { brow: 0.15, eye: 1.00, smile: 0.30, tilt: 0 },
    joueur:       { brow: 0.25, eye: 1.05, smile: 0.55, tilt: -4 },
    curieux:      { brow: 0.45, eye: 1.05, smile: 0.18, tilt: 6 },
    enthousiaste: { brow: 0.35, eye: 1.15, smile: 0.62, tilt: -2 }
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // =======================================================================
  // Face — rendu SVG placeholder. Seule couche à remplacer pour passer à Rive.
  // =======================================================================
  function Face(root) {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    svg.setAttribute("part", "face");
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

    // Cibles animées (interpolées dans le rAF de l'orchestrateur).
    this.tEyeX = 0; this.tEyeY = 0; this.cEyeX = 0; this.cEyeY = 0;
    this.tOpen = 0; this.tWide = 0.35; this.tRound = 0.2;
    this.cOpen = 0; this.cWide = 0.35; this.cRound = 0.2;
    this.emo = EMOTION.neutre;
    this.blinkK = 1;            // 1 = ouvert, 0 = fermé
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

    // Yeux : pupilles décalées vers le pointeur + clignement (scale Y).
    var dx = this.cEyeX * EYE_MAX, dy = this.cEyeY * EYE_MAX;
    this.pupL.setAttribute("cx", 44 + dx); this.pupL.setAttribute("cy", 56 + dy);
    this.pupR.setAttribute("cx", 76 + dx); this.pupR.setAttribute("cy", 56 + dy);
    var sy = Math.max(0.06, this.blinkK) * e.eye;
    this.eyeL.setAttribute("transform", "translate(44 56) scale(1 " + sy + ") translate(-44 -56)");
    this.eyeR.setAttribute("transform", "translate(76 56) scale(1 " + sy + ") translate(-76 -56)");

    // Sourcils : hauteur selon l'émotion.
    var by = -e.brow * 6;
    this.browL.setAttribute("transform", "translate(0 " + by + ")");
    this.browR.setAttribute("transform", "translate(0 " + by + ")");

    // Bouche : lentille paramétrée (open/wide) + sourire (émotion).
    var cx = 60, cy = 84;
    var W = 20 * (0.5 + 0.5 * this.cWide) * (1 - 0.35 * this.cRound);
    var H = 20 * this.cOpen + 1.5;
    var smile = e.smile * 7;
    var xL = cx - W, xR = cx + W, yC = cy - smile;
    var d = "M " + xL + " " + yC +
            " Q " + cx + " " + (cy - H / 2 - smile) + " " + xR + " " + yC +
            " Q " + cx + " " + (cy + H / 2) + " " + xL + " " + yC + " Z";
    this.mouth.setAttribute("d", d);

    // Tête : inclinaison émotionnelle + respiration.
    this.head.setAttribute("transform",
      "translate(60 62) rotate(" + e.tilt + ") scale(" + breathe + ") translate(-60 -62)");
  };
  Face.prototype.blink = function () {
    if (REDUCED) return;
    var self = this, t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var k = (ts - t0) / 140;                 // ~140 ms
      self.blinkK = k < 0.5 ? 1 - k * 2 : (k - 0.5) * 2;
      if (k < 1) requestAnimationFrame(step); else self.blinkK = 1;
    }
    requestAnimationFrame(step);
  };

  // =======================================================================
  // Avatar — orchestration (montage, activation, dwell, audio, lip-sync…).
  // =======================================================================
  function Avatar(manifest) {
    this.zones = manifest.zones || [];
    this.byKey = {};
    var i;
    for (i = 0; i < this.zones.length; i++) this.byKey[this.zones[i].key] = this.zones[i];
    this.active = false;
    this.muted = false;
    this.dwellTimer = null;
    this.current = null;        // clé de zone en cours de lecture
    this.visemes = null;        // piste de visèmes chargée
    this.visIdx = 0;
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.lang = (document.documentElement.lang || "fr").slice(0, 2) === "en" ? "en" : "fr";
    this._buildDom();
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
    this.wrap = wrap;
    this.card = wrap.querySelector(".card");
    this.btnActivate = wrap.querySelector(".activate");
    this.faceSlot = wrap.querySelector(".face-slot");
    this.controls = wrap.querySelector(".controls");
    this.btnMute = wrap.querySelector(".mute");
    this.btnClose = wrap.querySelector(".close");
    document.body.appendChild(host);
  };

  Avatar.prototype._wire = function () {
    var self = this;

    // Activation : geste utilisateur -> déverrouille l'audio + salutation.
    this.btnActivate.addEventListener("click", function () { self.activate(); });
    this.btnMute.addEventListener("click", function () { self.toggleMute(); });
    this.btnClose.addEventListener("click", function () { self.hide(); });

    // Langue : suit document.documentElement.lang (bascule FR/EN du site).
    var mo = new MutationObserver(function () {
      self.lang = (document.documentElement.lang || "fr").slice(0, 2) === "en" ? "en" : "fr";
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

    // Pointeur -> direction du regard (centré sur la carte).
    if (!NO_HOVER) {
      window.addEventListener("pointermove", function (e) {
        var r = self.card.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var nx = clamp((e.clientX - cx) / (window.innerWidth * 0.5), -1, 1);
        var ny = clamp((e.clientY - cy) / (window.innerHeight * 0.5), -1, 1);
        if (self.face) self.face.setEyes(nx, ny);
      }, { passive: true });
    }

    // Zones : survol prolongé (dwell) -> narration ; sortie -> annule le dwell.
    // Repli tactile : tap sur la zone (hors lien/bouton) -> narration.
    this.zones.forEach(function (z) {
      var el = document.querySelector(z.selector);
      if (!el) return;
      if (!NO_HOVER) {
        el.addEventListener("pointerenter", function () { self._dwell(z.key); });
        el.addEventListener("pointerleave", function () { self._cancelDwell(); });
      } else {
        el.addEventListener("click", function (ev) {
          var t = ev.target;
          if (t.closest && t.closest("a,button,input,textarea,select,label")) return;
          if (self.active) self.playZone(z.key);
        }, { passive: true });
      }
    });
  };

  Avatar.prototype._dwell = function (key) {
    var self = this;
    if (!this.active) return;
    this._cancelDwell();
    this.dwellTimer = setTimeout(function () { self.playZone(key); }, DWELL_MS);
  };
  Avatar.prototype._cancelDwell = function () {
    if (this.dwellTimer) { clearTimeout(this.dwellTimer); this.dwellTimer = null; }
  };

  Avatar.prototype.activate = function () {
    if (this.active) return;
    this.active = true;
    this.btnActivate.classList.add("hidden");
    this.faceSlot.classList.remove("hidden");
    this.controls.classList.remove("hidden");
    this.face = new Face(this.faceSlot);
    // Clignement périodique (idle).
    if (!REDUCED) {
      var self = this;
      (function blinkLoop() {
        var wait = 2600 + Math.random() * 3200;
        setTimeout(function () { if (self.face) self.face.blink(); blinkLoop(); }, wait);
      })();
    }
    // Salutation : joue la zone d'accueil (geste -> déverrouille l'audio).
    var greet = this.byKey.hero ? "hero" : (this.zones[0] && this.zones[0].key);
    if (greet) this.playZone(greet);
  };

  Avatar.prototype.playZone = function (key) {
    var z = this.byKey[key];
    if (!z || !this.active) return;
    var n = z.narrations && (z.narrations[this.lang] || z.narrations.fr || z.narrations.en);
    if (!n || !n.audioUrl) return;
    this.current = key;
    if (this.face) this.face.setEmotion(z.emotion);

    // Interruption d'une éventuelle lecture en cours.
    try { this.audio.pause(); } catch (e) {}
    this.visemes = null; this.visIdx = 0;
    var self = this;

    // Charge la piste de visèmes (best-effort ; sans elle, on joue sans lip-sync).
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
      if (self.current === key) { self.current = null; if (self.face) self.face.setMouth(0, 0.35, 0.2); }
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

  // Boucle de rendu : lip-sync (si audio en cours) + respiration + interpolation.
  Avatar.prototype._loop = function () {
    var self = this, t0 = performance.now();
    function frame(ts) {
      if (self.face) {
        // Lip-sync : cherche le visème courant selon audio.currentTime.
        if (self.current && !self.audio.paused && self.visemes) {
          var ms = self.audio.currentTime * 1000, tr = self.visemes;
          while (self.visIdx < tr.length - 1 && tr[self.visIdx + 1].t <= ms) self.visIdx++;
          while (self.visIdx > 0 && tr[self.visIdx].t > ms) self.visIdx--;
          var v = VISEME[tr[self.visIdx].id] || VISEME[0];
          self.face.setMouth(v[0], v[1], v[2]);
        } else if (self.current && !self.audio.paused && !self.visemes) {
          // Pas de piste : bouche « qui parle » pseudo-aléatoire pendant l'audio.
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
  // Auto-montage : lit le manifeste injecté et instancie l'avatar.
  // =======================================================================
  function boot() {
    var el = document.getElementById("guide-manifest");
    if (!el) return;                     // pas de manifeste -> pas d'avatar
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
