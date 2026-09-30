# Mohaboxe

Application de suivi du challenge de Moha (5 octobre 2026 → 4 janvier 2027) : musculation, boxe, alimentation et statistiques.

## Mise en ligne sur GitHub Pages

1. Créer un dépôt public nommé `mohaboxe` sur GitHub.
2. Y déposer **tout le contenu de ce dossier** (index.html à la racine, avec le dossier `icons`).
3. Dans le dépôt : **Settings → Pages → Source : Deploy from a branch → `main` / `(root)`**.
4. Après une minute, l'appli est disponible sur `https://<pseudo>.github.io/mohaboxe/`.
5. Sur Android, l'ouvrir dans Chrome puis **⋮ → Installer l'application**.

Le HTTPS de GitHub Pages est indispensable pour l'appareil photo (scan des codes-barres).

## Mise à jour

Remplacer les fichiers sur GitHub. En cas de changement important, incrémenter `CACHE` dans `sw.js` (`mohaboxe-v2`, etc.).

## Fichiers

- `data.js` : le programme (séances, exercices, boxe, cibles caloriques, aliments, anecdotes, barème de points). C'est ici qu'on ajuste le contenu.
- `app.js` : la logique de l'application.
- `style.css`, `index.html`, `manifest.json`, `sw.js`, `icons/` : interface et installation.

Les données sont stockées sur le téléphone : penser à utiliser **Stats → Exporter** régulièrement.
