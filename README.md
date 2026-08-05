# antep — Site portfolio d'Audrey Ntep

Portfolio statique bilingue **FR / EN**, aux couleurs de la marque **antep** (thème sombre : navy, teal, rose, orange).

## Structure

```
antep_website/
├── index.html              # Structure et contenu de la page
├── styles.css              # Styles (thème, mise en page, responsive) — commentés
├── script.js               # Interactions : bascule FR/EN, menu, filtres, animations — commenté
├── logo.png                # Logo AN (nav + favicon)
├── guide-avatar.js         # Widget avatar-guide (Web Component, rendu SVG placeholder)
├── build-guide.mjs         # Injection build-time du manifeste du guide dans index.html
├── robots.txt              # Directives crawlers (indexation bloquée)
├── package.json            # Outils de qualité + build:guide (dev uniquement, aucun runtime)
├── .htmlhintrc / .htmlvalidate.json / .stylelintrc.json / eslint.config.mjs
├── lighthouserc.json       # Config de l'audit Lighthouse
└── .github/workflows/ci.yml
```

Le site lui-même n'a **aucune dépendance runtime** : `package.json` ne sert qu'aux outils de qualité en local et en CI.

## Développement

Servir le dossier localement :

```bash
python -m http.server 8000   # puis http://localhost:8000
```

Lancer les vérifications de qualité (nécessite Node.js) :

```bash
npm install        # installe les outils de lint
npm run lint       # HTML (htmlhint + html-validate) + CSS (stylelint) + JS (eslint)
```

## Intégration continue (GitHub Actions)

Le workflow `.github/workflows/ci.yml` s'exécute à chaque `push` et `pull request` sur `main` :

| Job | Rôle |
|-----|------|
| **lint** | Validation + lint HTML / CSS / JS (`npm ci` puis `npm run lint`) |
| **links** | Détection des liens morts (lychee ; LinkedIn et Malt exclus car bloquent les bots) |
| **lighthouse** | Audit performance / accessibilité / bonnes pratiques (SEO ignoré à cause du noindex) |

Les seuils Lighthouse sont en mode `warn` (informatif, ne bloque pas). Pour les rendre bloquants, passer les assertions de `lighthouserc.json` de `warn` à `error`.

## Guide-avatar

Le site embarque un **avatar-guide** vocal : un petit personnage animé (en bas à
droite) qui présente chaque section, avec synchronisation labiale et émotions. Les
contenus (zones + narrations + audio) sont gérés côté **API guide** (repo séparé
`antep-guide-api`) et publiés via un **manifeste** injecté dans `index.html` **au
build** — le site reste 100 % statique et fonctionne même si l'API est éteinte.

**Deux fichiers, deux rôles :**

- `build-guide.mjs` — récupère `GET /api/guide/manifest` et l'injecte entre les
  marqueurs `<!-- GUIDE:MANIFEST:START/END -->` sous forme d'un
  `<script id="guide-manifest" type="application/json">`. Sûr (JSON échappé),
  robuste (si l'API est injoignable, `index.html` est laissé inchangé) et idempotent.

  ```bash
  GUIDE_API_BASE=https://antep-guide-api-production.up.railway.app npm run build:guide
  ```

  > On pointe sur l'URL d'origine Railway (et non `guide-api.antep.fr`) pour
  > contourner le challenge anti-bot Cloudflare au moment du build.

- `guide-avatar.js` — le **widget** (Web Component autonome, sans dépendance). Il
  s'auto-monte si un manifeste est présent et lit `JSON.parse(...)`. Comportement :

  - **activation** par bouton (déverrouille l'audio par geste utilisateur) ;
  - **déclenchement** : `scroll-into-view` (la section arrive au centre de l'écran)
    sur tous supports, + survol prolongé en bonus desktop ; chaque section **une
    seule fois**, puis le mode auto s'éteint (garde-fou) ;
  - **lip-sync** des visèmes Azure, **émotion** par zone, **i18n FR/EN** (suit
    `document.documentElement.lang`), **interruption** ;
  - **casques d'écoute** injectés à droite de chaque `.sec-tag` pour (ré)écouter à
    la demande ;
  - **contrôles** muet / masquer (le `×` coupe aussi la narration auto) ;
  - **accessibilité** : cible tactile ≥ 24 px, `aria-label` par section,
    focus-visible, `prefers-reduced-motion` ; **perf** : rAF seulement après
    activation, audio jamais préchargé ;
  - **pilotable depuis l'admin** : si le manifeste porte `avatarEnabled: false`
    (réglage backend), l'avatar et la narration auto disparaissent — mais les
    casques restent. Défaut : avatar affiché.

Le rendu du visage est un **placeholder SVG** ; il sera remplacé par un vrai
personnage Rive (`.riv`) sans toucher à la logique. Intégration : une seule ligne
dans `index.html` — `<script src="guide-avatar.js" defer></script>` avant `</body>`.

## Déploiement

Site 100 % statique : déployable tel quel sur **Vercel**, **Netlify**, **GitHub Pages** ou tout hébergeur statique. Il suffit de servir le dossier.

> **Rafraîchir le guide** : après une modif de zone (ou un changement du réglage
> `avatarEnabled`) dans l'admin, relancer `npm run build:guide` puis redéployer —
> c'est ce qui re-cuit le manifeste dans `index.html`.

> ⚠️ **Indexation désactivée** : `robots.txt` (Disallow: /) et la balise `<meta name="robots" content="noindex, nofollow">` empêchent le référencement. À retirer le jour où le site doit être visible sur Google (le job SEO de Lighthouse est aussi désactivé pour cette raison).

## Note sur la police

La pile de polices privilégie **Google Sans** (non distribuée publiquement — visible uniquement si installée localement) avec un repli sur **Poppins** (servie via Google Fonts) pour les visiteurs.

## Stack mise en avant

Python · TypeScript · Solidity · FastAPI · Docker · IA (RAG, Computer Vision, agents) · Web3 (EVM, ICP, XRPL)
