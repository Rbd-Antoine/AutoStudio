# Rapport — page d'accueil « Le studio » (branche `feature/site-3d`)

Mission autonome du 21/11/2026. Aucun blocage d'arrêt : rien n'a demandé de sortir du périmètre
(pas de paiement, de compte, de secret, de base de données, de production ni de `main`). La branche
est poussée sur `Rbd-Antoine/AutoStudio` ; rien n'est fusionné dans `main`.

**En une phrase** : l'accueil est désormais une seule scène, une vraie photo de client puis son vrai
rendu AutoStudio, que le scroll parcourt en 5 chapitres. Le site est complet et fonctionne de bout
en bout, mais il plafonne à **5/10 en moyenne** selon les juges, loin des 8/10 visés. Les deux causes
principales : l'absence de modèle 3D libre utilisable, et la règle que je me suis imposée de ne
jamais embellir la voiture (voir « Décisions importantes »).

## Mise à jour du 23/11/2026 (2) : votre fond, votre logo, site fini pour la présentation

- **Produit (éditeur)** : 5e choix « Votre propre fond » (photo de showroom ou d'atelier importée,
  mémorisée sur l'appareil, envoyée à Gemini comme fond de référence) et carte « Votre logo » (logo du
  kit de marque, coin au choix, apposé par le serveur avec sharp, jamais redessiné par l'IA). Route
  `background-swap` : `backgroundSlug: 'custom'` + `customBackground`, `logo: { corner }` ; logo lu
  dans le kit de marque, absent → 400 avant tout débit ; échec du logo → rendu remboursé.
  `src/lib/logo-overlay.server.ts`. En dev sans Blob, le logo du kit est gardé en data URI.
- **Testé de bout en bout** dans le vrai éditeur (`docs/site-3d/pipeline/demo/e2e-custom-background.mjs`) :
  logo enregistré, photo + fond + logo, rendu en 18 s. Retouche réelle testée aussi.
- **Site** : bloc « Votre showroom. Votre marque. » sous le comparateur ; page Fonctionnalités refaite
  dans le look sombre avec 4 vraies illustrations (elle n'avait que des cases vides) ; logo CarGlow
  remplacé partout (logo et icônes) ; accent bleu remplacé par l'ambre de l'accueil sur tout le site et
  l'application ; menus corrigés (ancres de l'ancienne accueil) ; FAQ et guide utilisateur à jour.
- Hors périmètre de la mission initiale, sur demande explicite de Benoit (23/11) : `src/app/api/background-swap`,
  `src/app/api/brand-kit`, `src/app/app/editor`, `tailwind.config.ts`, `globals.css`, icônes.
- Dépense Gemini cumulée estimée : **1,15 € sur 3 €**.

## Mise à jour du 23/11/2026 : chapitre 3 en comparateur avant/après

Retour de Benoit : l'intégration de la photo dans les fonds ne fonctionnait pas parfaitement (la
caméra zoomait sur la voiture et un dégradé mangeait le décor : la voiture paraissait collée).
Inspiration spyne.ai : le chapitre « Les fonds » est désormais un **comparateur** (`_studio/Comparator.tsx`),
avec la photo et son rendu entiers dans un cadre, un curseur à faire glisser (souris, toucher, clavier,
rôle `slider`), le choix entre 4 décors et 4 voitures, et un balayage du curseur à la première apparition.
La scène 3D reste pour les chapitres 1, 2, 4 et 5 et s'éteint derrière le comparateur.
16 vrais rendus (`public/compare/`, `compare_assets.py`), dont 7 nouveaux. Chaque rendu est refusé si la
voiture a bougé (l'échelle doit valoir exactement 0,5) : aucun refus. Dépense cumulée estimée : **1,00 € sur 3 €**.

## Mise à jour du 22/11/2026 : vrais rendus Gemini et guides SEO

Budget donné : 3 € de clé Gemini. **Dépense estimée : 0,65 €** (13 appels, tous réussis, registre
`docs/site-3d/pipeline/gemini-ledger.json`, estimation prudente à 0,05 € l'image).

- **Chapitre 3 en vrais rendus.** `docs/site-3d/pipeline/render.ts` appelle Gemini comme le produit
  (même prompt `buildBackgroundSwapPrompt`, même modèle `gemini-nano-banana-2.1`, 2K) et refuse tout
  appel au-delà de 2,90 €. La voiture-01 a été rendue sur les 4 fonds de l'éditeur. Mesure : chaque
  rendu est exactement la photo à l'échelle 2, décalée d'environ 2 px, donc **la voiture reste au même
  pixel d'un décor à l'autre**. Les quatre décors de l'accueil sont maintenant de vrais rendus
  (`prepare_v2.py`), plus aucune illustration composée. Deux tirages (pièce vide a, parking b) avaient
  déplacé la voiture : écartés.
- **Comparaison de modèles** : `gemini-3.1-flash-image` (1K) donne un rendu très proche mais deux fois
  moins défini ; NB2.1 reste le bon choix, comme sur Florelis.
- **16 guides SEO** (`content/guides/`, `/guides`), sur le modèle de Florelis : une requête réelle
  de l'autocomplétion Google par guide (photographier une voiture pour la vendre, meilleur angle,
  intérieur, nettoyage, éclairage, smartphone, fond blanc, fond noir, studio, concession, changer le
  fond, enlever l'arrière-plan, logiciel, IA, nombre de photos, photo d'annonce). 550 à 930 mots,
  FAQ (JSON-LD FAQPage), Article et fil d'Ariane, maillage vers les 10 articles du blog sans les
  doublonner. **6 publiés** (17 au 22/11), **10 programmés** deux à trois par semaine jusqu'au
  16/12 : un guide apparaît à sa date sans déploiement (ISR d'une heure), et un lien vers un guide
  pas encore publié s'affiche en texte simple. Aucun chiffre de plateforme inventé (« vérifiez la
  limite actuelle »).
- **Images des guides** (`guide_images.py`) : photos d'origine ou vrais rendus des voitures 01 à 04,
  dont 6 nouveaux rendus. Les images « avant / après » coupent l'image au milieu : la voiture
  traverse la ligne sans bouger. Chaque légende dit ce qui est photo et ce qui est rendu.
- **Interface** : les guides prennent le look sombre de l'accueil (barre `StudioBar`, corps
  `GuideBody`, pied de page sombre), lien « Guides » dans l'en-tête de l'accueil et le pied de page
  (édition française seulement, les guides n'existent qu'en français), `/guides` et les guides
  publiés dans le sitemap.
- Vérifié : `tsc`, `lint`, `build` (219 pages), captures 1440 et 390 px sans erreur console.
- Hors périmètre initial, assumé pour les guides : `src/lib/guides.ts`, `src/lib/blog.ts`
  (validation des liens partagée) et `src/app/sitemap.ts`.

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

1. ~~Produire le même véhicule sur les 4 décors avec AutoStudio lui-même~~ : **fait le 22/11**
   (voir plus haut). Reste à faire juger de nouveau les chapitres 2 et 3 sur cette matière.
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
