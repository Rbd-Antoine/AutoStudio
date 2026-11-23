# Direction artistique — page d'accueil « Le studio »

## Références retenues (6)

Mobbin demande un compte (exclu par la mission) : références trouvées par recherche web.

1. **Polestar 5** (Red Dot Best of the Best 2026) : un récit au scroll, très peu d'éléments à
   l'écran, la voiture et une phrase. Retenu : la retenue, le silence entre les chapitres.
2. **basement.studio, « Bunker Scene »** : un lieu sombre unique, atmosphérique, où la lumière
   raconte. Retenu : le lieu comme personnage, l'obscurité qui laisse la place à la lumière.
3. **Shader.se** (scroll-driven, WebGPU) : une seule progression pilote toutes les scènes, les
   scènes hors plage ne sont pas calculées. Retenu : la progression unique 0→1, le coût maîtrisé.
4. **Studio375, bande dessinée interactive** : une caméra qui dérive de case en case dans un
   canvas fixe. Retenu : des arrêts de caméra nets, une dérive douce entre eux.
5. **Rivian** (Site of the Day) : photographie chaude et réelle plutôt que du rendu froid.
   Retenu : la vraie photo comme matière première.
6. **Pages produit Apple (méthode des points de passage)** : des positions clés à 0, 0,25,
   0,5… interpolées. Retenu : la caméra définie par 5 arrêts et une interpolation lissée.

**Fusion** : le lieu-personnage de basement.studio (un ancien garage dans le noir, que la
lumière révèle) avec la retenue de Polestar (une voiture, une phrase, du vide). La lumière est
l'acteur : elle s'allume, elle balaie, elle change le décor ; la voiture, elle, ne bouge jamais.

## Palette

Fond sombre, un seul accent, aucun dégradé violet.

| Rôle | Valeur | Usage |
|---|---|---|
| Nuit (fond) | `#0C0D0F` | fond de page, scène |
| Béton | `#1A1C1F` | surfaces (cartes tarifs, FAQ) |
| Acier | `#2A2D31` | filets, bordures |
| Craie | `#ECE8E1` | texte principal (blanc chaud, jamais #FFF pur) |
| Cendre | `#9A968E` | texte secondaire |
| **Tungstène** (accent unique) | `#F2A93B` | une seule chose à la fois : le CTA, l'arrêt actif, un repère |

Le tungstène est la couleur des lampes de studio et des vieux garages ; il dialogue avec le bleu
froid des néons des vrais rendus au lieu de le copier. Le bleu de marque de l'application reste
dans l'application.

## Typographies (next/font)

- **Display : Big Shoulders Display** (700-800, très condensée, née de la signalétique
  industrielle de Chicago) : titres de chapitre en grand, en capitales, chasse serrée. Elle a
  le caractère d'un atelier, et sa condensation laisse la place à la voiture.
- **Texte : IBM Plex Sans** (400, 500, 600) : lisible, technique sans être froide, chiffres
  tabulaires pour les prix. Les repères de chapitre (« 02 / LE STUDIO ») en Plex Sans 500,
  capitales espacées.

## Espacements et grille

- Échelle de 4 px : 4, 8, 12, 16, 24, 32, 48, 72, 120.
- Marges latérales : 16 px sous 640 px, 32 px jusqu'à 1024 px, 64 px au-delà.
- Texte de chapitre : colonne de 34 rem au plus, ancrée en bas à gauche de la scène
  (en bas, pleine largeur, sur mobile) ; jamais centrée sur la voiture.
- Titres : `clamp(2.75rem, 7vw, 6.5rem)`, interlignage 0,9.

## Animation

- **Une seule valeur** de progression (0→1) sur toute la page ; caméra, lumière, décor et
  textes en sont des fonctions pures. Aucune animation ne tourne seule, sauf la poussière dans
  les faisceaux et le grain (très lents, coupés en `prefers-reduced-motion`).
- Courbe d'arrêt : chaque chapitre a un palier (la caméra s'y pose) puis une transition
  lissée (`smoothstep`) : on s'arrête pour lire, on glisse pour changer de lieu.
- La caméra ne fait que trois gestes : avancer/reculer (échelle), glisser (translation),
  monter/descendre. Pas de rotation, pas de secousse.
- Lumières : allumage une par une, avec une montée rapide et un léger rebond d'intensité
  (comme un tube qui s'amorce), jamais un fondu linéaire mou.
- Durées d'interface (survol, clic) : 160-240 ms, `cubic-bezier(.2,.7,.2,1)`.
- `prefers-reduced-motion` : aucune caméra, aucune poussière ; une image fixe par chapitre.

## Interdits (look « IA générique »)

- Inter partout, ou toute police par défaut non choisie.
- Dégradés violets, bleus-violets, textes en dégradé (`text-gradient`).
- Cartes bento identiques en grille, ombres portées molles partout.
- Emojis, icônes décoratives en pastille ronde colorée, étincelles « ✨ IA ».
- Badges « Nouveau », « Propulsé par l'IA », compteurs et logos clients inventés, avis inventés.
- Glassmorphism flou sur tout, halos colorés flottants en arrière-plan.
- Centrage systématique de tout le texte ; titres en casse phrase génériques
  (« Boostez vos ventes »).
- Plus d'un accent de couleur à l'écran.
