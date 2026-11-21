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
