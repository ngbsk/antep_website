/* =========================================================================
   antep — Injection build-time du manifeste du guide-avatar
   -------------------------------------------------------------------------
   Récupère le manifeste public de l'API guide (zones publiées + narrations)
   et l'injecte DANS index.html entre les marqueurs, sous la forme d'un
   <script type="application/json" id="guide-manifest">. Le site reste 100 %
   statique : aucune requête à l'API au runtime, le manifeste est cuit dans le
   HTML au moment du build.

   Le widget avatar lira ensuite :
     JSON.parse(document.getElementById('guide-manifest').textContent)

   Usage :
     GUIDE_API_BASE=https://guide-api.antep.fr node build-guide.mjs
     (défaut : https://guide-api.antep.fr ; cible index.html à la racine)

   Robustesse : si l'API est injoignable, index.html est laissé INCHANGÉ
   (le dernier manifeste injecté est conservé) et le build ne casse pas.
   ========================================================================= */

import { readFile, writeFile } from "node:fs/promises";

const API_BASE = (process.env.GUIDE_API_BASE || "https://guide-api.antep.fr").replace(/\/+$/, "");
const FILE = process.env.GUIDE_HTML || "index.html";
const START = "<!-- GUIDE:MANIFEST:START -->";
const END = "<!-- GUIDE:MANIFEST:END -->";
const TIMEOUT_MS = Number(process.env.GUIDE_TIMEOUT_MS || 10000);

// Échappe le JSON pour un usage sûr dans un <script type="application/json">
// lu via JSON.parse(textContent) : il suffit de neutraliser « < » (pour
// empêcher un « </script> » présent dans une narration de fermer la balise) ;
// « > » et « & » sont neutralisés par prudence. Les chars restent décodés par
// JSON.parse.
function escapeForHtml(json) {
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchManifest() {
  const url = `${API_BASE}/api/guide/manifest`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        // UA de navigateur : sans lui, Cloudflare bloque les requetes
        // automatisees (erreur 1010) avant meme d'atteindre l'API.
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const html = await readFile(FILE, "utf8");
if (!html.includes(START) || !html.includes(END)) {
  console.error(`[guide] marqueurs absents de ${FILE} : ajoute\n  ${START}\n  ${END}\navant le <script src="script.js">.`);
  process.exit(1);
}

let manifest;
try {
  manifest = await fetchManifest();
  const n = Array.isArray(manifest.zones) ? manifest.zones.length : 0;
  console.log(`[guide] manifeste recupere depuis ${API_BASE} : ${n} zone(s), version ${manifest.version}.`);
} catch (e) {
  console.warn(`[guide] API injoignable (${e.message}) — ${FILE} laisse inchange (dernier manifeste conserve).`);
  process.exit(0);
}

const payload = escapeForHtml(JSON.stringify(manifest));
const block = `${START}\n<script id="guide-manifest" type="application/json">${payload}</script>\n${END}`;
const re = new RegExp(`${reEscape(START)}[\\s\\S]*?${reEscape(END)}`);
const out = html.replace(re, block);

if (out === html) {
  console.log(`[guide] aucun changement (manifeste identique).`);
} else {
  await writeFile(FILE, out, "utf8");
  console.log(`[guide] manifeste injecte dans ${FILE}.`);
}
