# Rapport — page d'accueil « Le studio » (branche `feature/site-3d`)

Mission autonome du 21/11/2026. Aucun blocage d'arrêt : rien n'a demandé de sortir du périmètre
(pas de paiement, de compte, de secret, de base de données, de production ni de `main`). La branche
est poussée sur `Rbd-Antoine/AutoStudio` ; rien n'est fusionné dans `main`.

**En une phrase** : l'accueil est désormais une seule scène, une vraie photo de client puis son vrai
rendu AutoStudio, que le scroll parcourt en 5 chapitres. Le site est complet et fonctionne de bout
en bout, mais il plafonne à **5/10 en moyenne** selon les juges, loin des 8/10 visés. Les deux causes
principales : l'absence de modèle 3D libre utilisable, et la règle que je me suis imposée de ne
jamais embellir la voiture (voir « Décisions importantes »).

## Ce qui a été fait

- **Scène unique** (`src/app/[locale]/(marketing)/_studio/`) : une progression 0 → 1 calculée sur
  le scroll pilote caméra, lumière, décor et lisibilité (`scene.ts`, fonction pure). Le rendu est fait
  par un compositeur WebGL 1 écrit à la main (`StudioCanvas.tsx`, environ 10 Ko, sans three.js),
  chargé en `dynamic` avec `ssr: false`, avec des images fixes affichées d'abord.
- **5 chapitres** :
  1. **Avant** : la vraie photo du client sur un parking gris.
  2. **Le studio** : la photo s'éteint, le vrai rendu apparaît dans le noir et ses lampes, repérées
     automatiquement, s'allument une à une. La photo et le rendu sont alignés au pixel près sur la
     voiture (similitude, 382 points concordants), donc la voiture ne bouge pas.
  3. **Les fonds** : les 4 décors de l'éditeur, changés au clic avec un balayage de lumière.
     « Garage néon » est le vrai rendu ; les trois autres sont des illustrations, ce que la page dit.
  4. **Tarifs** : les données réelles de `PricingConfig`, présentées sur la scène assombrie.
  5. **Contact** : la FAQ existante, puis « Essayer gratuitement » vers `/signup`.
- **Textes** : tout passe par next-intl, dans un espace neuf `studio`, en français et en anglais
  (`/en` sert l'anglais). `de`, `es` et `pt` reprennent le français, comme le reste du site sur ces
  adresses. Aucun avis, chiffre ni logo de client n'a été inventé.
- **Images** : préparées par `docs/site-3d/pipeline/prepare_assets.py` (alignement, détourage,
  logo de calandre effacé, fonds ajustés au cadre, ombre de contact calculée, images fixes,
  variantes mobiles). L'ensemble `public/site-3d` pèse 1,9 Mo.
- **Ancienne accueil** conservée dans `_legacy/HomeLegacy.tsx`. Pour revenir en arrière, une ligne
  suffit dans `page.tsx` (la procédure est écrite en tête du fichier).
- **Navigation et pied de page** : la navigation globale s'efface sur l'accueil, qui a son propre
  en-tête. Le pied de page y prend une variante sombre, avec le mot-symbole AutoStudio.
- **Documents** : `DESIGN.md` (direction, palette, typographies, interdits), `ASSETS.md`
  (provenance et licences), `JOURNAL.md` (toutes les décisions et tous les tours notés).

## Notes finales par chapitre

Le dernier passage a été fait par 5 juges neufs, sans mémoire des tours précédents, sur les
captures finales en 1440 px (`docs/site-3d/final/`). La note de boucle est la dernière obtenue
pendant la phase 3.

| Chapitre | Notes de boucle (tours successifs) | Note finale | Plafond principal |
|---|---|---|---|
| 1 Avant | 6 · 6 · 5 · 6 · 7 | **6/10** | Logo effacé visible en tache, photo de téléphone en 1200 px agrandie |
| 2 Le studio | 3 · 4 · 4,5 · 6 · 6 · 6 | **6/10** | Effet de montage entre la voiture et le décor du rendu (non retouchée par principe), ombre au sol faible |
| 3 Les fonds | 4 · 4 | **5/10** | Fonds de l'éditeur à perspective frontale contre une voiture vue de trois quarts, ombre et lumière qui ne raccordent pas |
| 4 Tarifs | 3 · 4 | **4/10** | Colonnes jugées génériques, scène derrière trop peu lisible |
| 5 Contact | 3 · 3 | **4/10** | Le « plan large » demandé est impossible : l'image s'arrête à ses bords |

## Performance, mobile, accessibilité

Mesuré sur le build de production avec Lighthouse 12.2.1 en mobile simulé
(`docs/site-3d/lighthouse/mobile.json`) :

| Mesure | Résultat | Objectif |
|---|---|---|
| Performance | **82** (60 avant optimisation) | ≥ 80, atteint |
| Accessibilité | 98 | |
| Bonnes pratiques | 96 | |
| Total Blocking Time | 193 ms (1 190 avant) | |
| CLS | 0 | |
| LCP | **4,2 s** | < 2,5 s, **non atteint** |

- **Pourquoi le LCP n'est pas atteint** (mesuré avec `docs/site-3d/lcp.mjs`) : l'élément LCP d'une
  première visite est le paragraphe du **bandeau cookies**, rendu côté client après l'hydratation.
  Le titre de la page s'affiche à 1,7 s. Pour un visiteur qui a déjà répondu au bandeau, le LCP est
  le titre, à 0,4 s.
- **Mouvement réduit, sans WebGL, économie de données** : une image fixe par chapitre, aucune
  caméra. **Mobile** : textures légères, DPR plafonné à 1,5, image en haut et texte en bas.
- **Console** : aucune erreur de la page. En local avec `next start`, le script Vercel Speed
  Insights renvoie 404 ; il n'existe que sur Vercel et c'était déjà le cas avant la mission.
- `npm run build`, `npm run lint` (0 erreur, 0 avertissement) et `npx tsc --noEmit` passent.
- `/pricing`, `/signup`, `/signin`, `/contact`, le blog et les pages légales répondent comme avant.
  `/app` redirige vers la connexion sans session, comme sur `main`.

## Décisions importantes

1. **2.5D au lieu de vraie 3D.** Aucun modèle de voiture libre ne convenait. Poly Haven (CC0) n'a
   pas de voiture. Le `CarConcept` de Khronos (CC-BY) a la silhouette d'un Tesla Roadster et porte
   des logos. Sketchfab exige un compte. J'ai donc appliqué la solution prévue par la mission : les
   vrais rendus en couches. C'est aussi la preuve la plus honnête de la promesse.
2. **Pas de three.js.** Une photo n'a rien à modéliser : un shader plein écran suffit, et économise
   environ 150 Ko compressés.
3. **Contrainte d'honnêteté.** La voiture n'est jamais rééclairée ni embellie sur la page, alors que
   les juges le demandaient tour après tour. Sinon la page montrerait un résultat que le produit ne
   livre pas. Seul le décor est étalonné. J'ai aussi corrigé un fondu qui assombrissait l'arrière de
   la voiture, parce qu'il la modifiait sur la page.
4. **Illustrations annoncées.** Pour 3 des 4 décors, la page dit qu'il s'agit d'une illustration :
   aucune vraie voiture n'existe sur ces fonds dans le dépôt, et en produire coûterait des appels
   Gemini, interdits par la mission.
5. **Mobbin non utilisé** (il exige un compte). Les références viennent de la recherche web.
6. **Branche partie de `main`**, pas de la branche socle encore en revue. La skill « dream-loop »
   n'existe pas dans cette session : la boucle a été reproduite à la main, avec des cibles écrites et
   des juges neufs.

## Ce qui reste imparfait

- **Notes de 4 à 6/10 au lieu de 8.** Les juges voient surtout un montage. La voiture vient d'une
  photo de téléphone en 1200 × 900, et les fonds de l'éditeur font 740 px de large, avec une autre
  perspective.
- **Logo de calandre** : effacé par retouche, il se voit en tache sombre au centre de la grille.
- **Logo du site** : le fichier `public/logo-autostudio.png` contient encore le logo **CarGlow**.
  La navigation et le pied de page des autres pages l'affichent ; il est hors du périmètre de cette
  mission et à remplacer.
- **Licence des fonds** : les fichiers de `public/background/` portent des identifiants Freepik.
  Leur licence est à vérifier (voir `ASSETS.md`).
- **LCP en première visite**, à cause du bandeau cookies (voir plus haut).
- **Commits signés « Benoit Ribeaud »** sur le dépôt d'Antoine : Vercel peut bloquer l'aperçu tant
  que l'auteur n'est pas membre de l'équipe Vercel.

## Les 5 prochaines améliorations recommandées

1. **Produire le même véhicule sur les 4 décors avec AutoStudio lui-même**, en 2K, à partir d'une
   photo plus nette et sans logo. Cela supprime les illustrations du chapitre 3 et fournit une
   matière nette. C'est le plus gros gain. Il faut un budget Gemini, de l'ordre de 0,20 € pour 4
   rendus, plus quelques essais.
2. **Afficher le bandeau cookies dès le rendu serveur.** Le consentement est dans un cookie, que le
   serveur peut lire. Le LCP passerait sous 2 s en première visite.
3. **Remplacer `logo-autostudio.png`** (actuellement le logo CarGlow) dans tout le site.
4. **Fond du chapitre Tarifs** : une vraie matière (béton photographié ou rendu) plutôt que le
   plafond assombri, et des colonnes moins génériques.
5. **Vraie 3D plus tard** : faire modéliser une voiture générique (commande d'un modèle CC0 ou sous
   licence achetée) et un garage en 3D, pour le recul de caméra que demandent les chapitres 4 et 5.
   Sans 3D, il est impossible.

## Fichiers

- Code : `src/app/[locale]/(marketing)/page.tsx`, `_studio/*`, `_legacy/HomeLegacy.tsx`,
  `_components/TrackedLink.tsx` (prop `style`), `src/components/Nav.tsx`, `src/components/Footer.tsx`,
  `messages/*.json`, `eslint.config.mjs` (exclusion des fichiers générés), `package.json`
  (Playwright en dépendance de développement).
- Images : `public/site-3d/`. Outils : `docs/site-3d/pipeline/prepare_assets.py`, `capture.mjs`,
  `sequence.mjs`, `lcp.mjs`. Captures finales : `docs/site-3d/final/` (1440 et 390 px, chaque
  chapitre et chaque décor). Cibles : `docs/site-3d/targets/targets.md`.
