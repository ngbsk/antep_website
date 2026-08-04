# antep — Site portfolio d'Audrey Ntep

Portfolio statique bilingue **FR / EN**, aux couleurs de la marque **antep** (thème sombre : navy, teal, rose, orange).

## Structure

```
antep_website/
├── index.html              # Structure et contenu de la page
├── styles.css              # Styles (thème, mise en page, responsive) — commentés
├── script.js               # Interactions : bascule FR/EN, menu, filtres, animations — commenté
├── logo.png                # Logo AN (nav + favicon)
├── robots.txt              # Directives crawlers (indexation bloquée)
├── build-guide.mjs         # Injection build-time du manifeste du guide-avatar
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

## Guide-avatar — injection build-time du manifeste

Le site embarque (à terme) un avatar-guide qui narre le contenu. Les zones et
narrations sont gérées côté **API guide** (repo séparé `antep-guide-api`) ; leur
**manifeste public** est injecté dans `index.html` **au build**, pas appelé au
runtime — le site reste 100 % statique et fonctionne même si l'API est éteinte.

`build-guide.mjs` récupère `GET /api/guide/manifest` et écrit le résultat entre
les marqueurs `<!-- GUIDE:MANIFEST:START/END -->` sous la forme d'un
`<script id="guide-manifest" type="application/json">`. Le widget avatar le lira
via `JSON.parse(document.getElementById('guide-manifest').textContent)`.

```bash
GUIDE_API_BASE=https://guide-api.antep.fr npm run build:guide
```

- **Sûr** : le JSON est échappé (`<`, `>`, `&`) — un `</script>` dans une
  narration ne peut pas casser la page.
- **Robuste** : si l'API est injoignable, `index.html` est **laissé inchangé**
  (le dernier manifeste injecté est conservé) et le build ne casse pas.
- **Idempotent** : relancer remplace le bloc, sans le dupliquer.

Intégration au déploiement : exécuter `npm run build:guide` **avant** de publier.
Sur Vercel, en *Build Command* (`npm run build:guide`) avec la variable
d'environnement `GUIDE_API_BASE`. En CI/GitHub Pages, ajouter une étape avant le
déploiement. Éditer une zone dans l'admin puis relancer le build (ou le
redéploiement) suffit à rafraîchir le manifeste servi.

## Déploiement

Site 100 % statique : déployable tel quel sur **Vercel**, **Netlify**, **GitHub Pages** ou tout hébergeur statique. Il suffit de servir le dossier.

> ⚠️ **Indexation désactivée** : `robots.txt` (Disallow: /) et la balise `<meta name="robots" content="noindex, nofollow">` empêchent le référencement. À retirer le jour où le site doit être visible sur Google (le job SEO de Lighthouse est aussi désactivé pour cette raison).

## Note sur la police

La pile de polices privilégie **Google Sans** (non distribuée publiquement — visible uniquement si installée localement) avec un repli sur **Poppins** (servie via Google Fonts) pour les visiteurs.

## Stack mise en avant

Python · TypeScript · Solidity · FastAPI · Docker · IA (RAG, Computer Vision, agents) · Web3 (EVM, ICP, XRPL)
