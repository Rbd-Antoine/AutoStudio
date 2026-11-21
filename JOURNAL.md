# Journal — site vitrine 3D (branche feature/site-3d)

Mission autonome du 21/11/2026. Chaque décision, problème et tour de boucle est noté ici.

## Phase 0 — lecture du repo, base qui marche

- Branche `feature/site-3d` créée depuis `origin/main` (fa5792f), **pas** depuis
  `feat/socle-florelis` (reprise des correctifs Florelis, encore en revue) : le site vitrine
  reste indépendant et fusionnable à part. Conséquence : `/en`, `/de`, `/es`, `/pt` existent
  encore sur cette base (sur la branche socle, ils redirigent vers le français).
- `npm install` puis `npm run build` sur la base : **build OK** avant toute modification.
- Site vitrine : `src/app/[locale]/(marketing)/page.tsx` (566 lignes, tout en français codé en
  dur), composants dans `_components/`. `PricingSection` lit `PricingConfig` en base
  (`revalidate = 60`), `FAQSection` est un composant client avec 6 questions en dur.
- `messages/fr.json` : seulement `nav` et `footer`. `messages/en.json` contient un ancien
  espace `home` avec des chiffres inventés (« 312+ dealerships ») : **non réutilisé**. Les
  nouveaux textes vont dans un espace neuf, `studio`.
- Décors : `src/lib/carBackgrounds.ts` (4 fonds, images dans `public/background/`). Vrais rendus
  dans `public/` : 4 voitures, chacune avant/après sur **un seul** décor
  (`showcase/voitures/voiture-0X`), `styles/<décor>.jpg` (un rendu réel par décor, 4 voitures
  différentes), `scroll-car-*.jpeg`. Aucune voiture n'existe sur les 4 décors.

## Décision structurante — 2.5D plutôt que vraie 3D

- Recherche d'un modèle de voiture libre :
  - Poly Haven (CC0) : 522 modèles, aucune voiture visible (seulement `covered_car`, une
    voiture bâchée).
  - Khronos glTF Sample Assets, `CarConcept` (CC-BY 4.0, Eric Chadwick / DGG, 1,9 Mo en
    Draco + KTX2) : techniquement idéal, mais sa silhouette est celle d'un Tesla Roadster (le
    modèle source est un sosie) et elle porte les logos Khronos et 3D Commerce. **Refusé**
    (règle « aucune silhouette reconnaissable d'une marque réelle »).
  - Sketchfab et autres : téléchargement derrière un compte, exclu par la mission.
- Donc, comme prévu par la mission : **approche 2.5D avec les vrais rendus d'AutoStudio**, en
  couches, profondeur et lumière animée. C'est aussi la démonstration la plus honnête de la
  promesse : les pixels de la voiture sont ceux de la vraie photo du client, seul le décor change.
- Voiture retenue : le SUV blanc de `voiture-01` (avant sur parking gris, après en garage néon,
  qui est aussi le rendu réel du décor « Garage néon »). Son logo de calandre est effacé
  (retouche locale) pour respecter « aucun logo ». La silhouette reste celle d'un SUV courant :
  c'est un vrai rendu client, ce que la mission autorise explicitement pour la 2.5D.
- Mobbin : demande un compte, exclu par la mission. Références cherchées par recherche web
  (voir DESIGN.md).

## Phase 1 — références et direction

Voir DESIGN.md.

## Phase 2 — support de chaque élément, première version complète

| Élément | Support retenu | Pourquoi |
|---|---|---|
| La voiture | Vraie photo du client (`voiture-01`), détourée, en couche | Aucun modèle libre propre ; c'est aussi la preuve du produit : ses pixels ne changent jamais |
| Le parking (chap. 1) | Vraie photo d'origine, alignée sur le rendu | Le « avant » réel |
| Le studio (chap. 2) | Vrai rendu AutoStudio (garage néon), éclairé par shader | Les lampes du rendu (repérées automatiquement) s'allument une par une |
| Les 4 fonds (chap. 3) | Garage néon = vrai rendu ; les 3 autres = fonds de l'éditeur ajustés au cadre (ligne sol/mur derrière la voiture), voiture posée dessus avec ombre | Dit sur la page : « rendu réel » / « illustration » |
| Ombre de contact | Carte d'ombre calculée : empreinte entre les 4 roues + taches sous les pneus + halo | La voiture ne flotte jamais |
| Caméra, lumière, décor | Un seul fragment shader WebGL 1 (`_studio/StudioCanvas.tsx`), sans three.js | Une photo n'a rien à modéliser : un quad plein écran suffit, ~10 Ko au lieu de ~150 Ko gzip pour three + fiber |
| Chargement, reduced-motion, sans WebGL | Images fixes par chapitre (`public/site-3d/still-*.webp`) | Le texte s'affiche avant la 3D ; le canvas (dynamic, ssr:false) apparaît en fondu par-dessus |
| Tarifs, FAQ | DOM par-dessus la scène assombrie | Données réelles de `PricingConfig` ; textes next-intl |

- Préparation des images : `docs/site-3d/pipeline/prepare_assets.py` (alignement par similitude : la
  voiture du rendu est la même à 87 px près vers le bas, 382 points concordants ; détourage par
  différence photo/rendu + GrabCut + corrections manuelles du sol sous la caisse ; logo de calandre
  effacé ; fonds remplis derrière la voiture pour la parallaxe). Total `public/site-3d` : 1,9 Mo,
  variantes `-sm` pour mobile.
- Ancienne page d'accueil déplacée dans `_legacy/HomeLegacy.tsx` (retour en une ligne, noté dans
  le fichier). La navigation globale s'efface sur l'accueil (la scène a son en-tête), le footer y
  prend une variante sombre sans bandeau CTA.
- Polices : `Big_Shoulders` (variable, axe de taille optique : c'est la version Display aux grandes
  tailles ; `Big_Shoulders_Display` n'existe plus sous ce nom dans next/font) et `IBM_Plex_Sans`.
- Problèmes rencontrés et corrigés :
  1. Shader « context lost » : en développement React monte l'effet deux fois et le nettoyage
     appelait `loseContext()` ; on libère maintenant les ressources sans tuer le contexte.
  2. Rendu limité à l'ombre : créer une texture la liait sur l'unité active, écrasant la
     précédente ; création sur une unité de travail dédiée.
  3. Cadrage trop serré (voiture sous le texte et le rail) : la caméra cadre maintenant chaque
     plan dans la zone libre à droite de la colonne de texte.
  4. Stries en bas de l'image : fondu de bord recalé pour ne jamais montrer les pixels de bord étirés.
- Un ancien serveur Next resté vivant tenait le port 3000 (TaskStop ne tue pas les petits-enfants) :
  arrêt de tous les processus `node … AutoStudio … next` avant chaque relance.

## Phase 3 — boucle d'amélioration par chapitre

La skill « dream-loop » citée par la mission n'existe pas dans cette session : la boucle est
reproduite à la main. Cible = description écrite de la vue finie idéale de chaque chapitre
(`docs/site-3d/targets/targets.md`, aucune génération d'image disponible) ; juge = un sous-agent
neuf à chaque tour, sans mémoire, qui note composition /3, lumière /3, matériaux /3, détails /1.

**Contrainte d'honnêteté décidée au tour 2 du chapitre 2** : le juge demandait de « rééclairer »
la voiture (reflets bleus des néons sur la carrosserie). Refusé : la voiture affichée est la sortie
réelle d'AutoStudio ; l'embellir sur la page montrerait un résultat que le produit ne livre pas.
Seul le décor est étalonné (contraste, jaunes calmés) ; la voiture n'est jamais retouchée. Les
juges suivants reçoivent cette contrainte. La note « lumière » du chapitre 2 en est plafonnée.

### Chapitre 2 — Le studio

| Tour | Note | Ce qui a changé avant le tour | Principaux reproches |
|---|---|---|---|
| 1 | 3/10 | Première version (voiture de la photo collée sur le rendu rempli) | Rectangle visible (bords flous, bande noire), voiture collée, rail sur la voiture, bandes jaunes concurrentes, badge de dev |
| 2 | 4/10 | Voiture et ombres du vrai rendu, bords prolongés en miroir, reflet au sol, étalonnage du décor, rail sans libellés, badge masqué | Voiture « éclairée différemment » (refusé, voir ci-dessus), joints du sol en losange (couture du miroir), gauche pas assez sombre, plafonniers brûlés, rail illisible |
| 3 | … | Plus de miroir en bas (fondu avant le bord), ombre de contact renforcée, voile gauche dense, voile haut, jaunes désaturés, voiture recentrée dans sa zone, titre plus compact | |

### Chapitre 1 — Avant

| Tour | Note | Ce qui a changé avant le tour | Principaux reproches |
|---|---|---|---|
| 1 | 6/10 | Photo d'origine entière (plus de remplissage visible autour de la voiture) | « Ligne fantôme » en bas (couture du miroir), rail sur la zone chargée, voile gauche trop court, navigation peu lisible sur le ciel |
| 2 | … | Mêmes corrections communes que le chapitre 2 (bas sans miroir, voiles, rail) | |
