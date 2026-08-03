# antep — Site portfolio d'Audrey Ntep

Portfolio statique bilingue **FR / EN**, aux couleurs de la marque **antep** (thème sombre : navy, teal, rose, orange).

## Structure

```
antep_website/
├── index.html     # Structure et contenu de la page
├── styles.css     # Styles (thème, mise en page, responsive) — commentés
├── script.js      # Interactions : bascule FR/EN, menu, filtres, animations — commenté
├── logo.png       # Logo AN (nav + favicon)
├── robots.txt     # Directives crawlers (indexation bloquée)
└── README.md
```

## Développement

Aucune étape de build ni dépendance. Ouvrir `index.html` dans un navigateur, ou servir le dossier :

```bash
python -m http.server 8000   # puis http://localhost:8000
```

## Déploiement

Site 100 % statique : déployable tel quel sur **Vercel**, **Netlify**, **GitHub Pages** ou tout hébergeur statique. Il suffit de servir le dossier.

> ⚠️ **Indexation désactivée** : `robots.txt` (Disallow: /) et la balise `<meta name="robots" content="noindex, nofollow">` empêchent le référencement par les moteurs de recherche. À retirer le jour où le site doit être visible sur Google.

## Note sur la police

La pile de polices privilégie **Google Sans** (non distribuée publiquement — visible uniquement si installée localement) avec un repli sur **Poppins** (servie via Google Fonts) pour les visiteurs.

## Stack mise en avant

Python · TypeScript · Solidity · FastAPI · Docker · IA (RAG, Computer Vision, agents) · Web3 (EVM, ICP, XRPL)
