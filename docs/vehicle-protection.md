# Protection du véhicule

Après un changement de fond, AutoStudio peut remettre la voiture **exactement comme sur la
photo du concessionnaire** : Gemini redessine chaque pixel, et même quand on lui demande de ne
pas toucher au véhicule, un logo, les branches d'une jante, la calandre ou la plaque peuvent
changer. Le service remplace la voiture du rendu par celle de la photo, et garde du rendu le
nouveau décor, le sol, les ombres et les reflets.

Les modèles de vision tournent dans un service GPU séparé (`services/vehicle-protection/`, sur
Modal) : ils sont bien trop gros pour une fonction Vercel. Repris du service qui protège la
maison sur Florelis, adapté aux voitures.

## Ce qui est protégé, et ce qui ne l'est pas

- **Protégé** : le véhicule vendu, carrosserie, jantes, phares, logos, plaque.
- **Jamais protégé** : le décor, le sol, les ombres, les reflets au sol, et **les autres
  voitures** de la photo (le parc derrière) : seul le véhicule principal est gardé, le plus grand
  et le plus central.
- **Vitres** : laissées au rendu, pour que le nouveau décor se voie à travers. `KEEP_GLASS=1`
  sur Modal les restaure aussi (l'ancien décor reste alors visible derrière le verre).
- **Bords** : le masque est rentré de 2 px, pour ne pas recoller un liseré de l'ancien décor
  autour de la carrosserie.
- **Consignes qui touchent la voiture** (masquer la plaque, jantes, couleur, logo, rayures…) :
  la protection s'efface pour ce rendu, sinon elle annulerait la demande. Voir
  `requestTargetsVehicle` dans `src/lib/vehicle-protection.server.ts`. La liste penche du côté de
  l'arrêt : un rendu non protégé, c'est le comportement d'aujourd'hui ; une demande annulée, c'est
  un crédit perdu.

## Quand il tourne

Chaque changement de fond, quand `VEHICLE_PROTECTION_URL` est défini. Le conteneur GPU est
réveillé (`/warmup`) au début du rendu, pendant que Gemini dessine. L'appel reçoit ce qui reste
du budget de la route, 90 s au plus, et il est sauté sous 15 s : la route garde toujours le temps
d'enregistrer le rendu ou de rembourser.

Chaque issue est enregistrée dans `Photo.generationInput.vehicleProtection` : `protected: true`
avec les diagnostics du service, ou `protected: false` avec `skipped` (`not_configured`,
`request_targets_vehicle`, `no_time`, `framing`, `provider`, `invalid_result`) et la raison. Tout
refus ou échec garde le rendu tel que dessiné.

## Contrat HTTP, version 2

```http
POST /segment
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{ "imageBase64": "<photo du concessionnaire>", "generatedImageBase64": "<rendu>", "mimeType": "image/jpeg" }
```

Réponse avec le rendu : le rendu avec la voiture restaurée, **dans le cadre et la résolution du
rendu** :

```json
{
  "version": 2,
  "imageBase64": "<PNG, même taille que le rendu>",
  "protectedMaskBase64": "<PNG du masque réellement utilisé, cadre du rendu>",
  "diagnostics": {
    "vehicleDetections": [{ "label": "a car", "score": 0.82 }],
    "mainVehicle": 0,
    "glassDetections": [{ "label": "a car window", "score": 0.51 }],
    "vehicleCoverage": 0.31,
    "alignment": { "inliers": 280, "medianResidualPx": 0.8, "cornerShift": 0.012, "scope": "vehicle" },
    "protectedCoverage": 0.27, "inferenceMs": 2100
  }
}
```

Sans le rendu (mode banc d'essai), seul `protectedMaskBase64` est renvoyé, dans le cadre de la
photo. Un refus volontaire est un HTTP 422 avec la raison dans `detail` : aucun véhicule trouvé,
voiture déplacée ou redimensionnée par le rendu, voiture absente du rendu.

## Comment la restauration marche (`services/vehicle-protection/compose.py`)

1. Grounding DINO trouve les véhicules ; `pick_main_vehicle` garde celui qui est vendu ; SAM 2.1
   en donne le masque au pixel ; les vitres en sont retirées et le bord rentré (`vehicle_mask`).
2. Une similitude (déplacement, rotation, échelle) de la photo vers le rendu est ajustée sur les
   points de la voiture. Un petit décalage (jusqu'à 4 % de la diagonale) est **corrigé** ; une
   voiture déplacée ou un autre point de vue est refusé. (Pas une homographie comme pour une
   maison : sur une voiture, elle dérivait de 3 à 9 px aux coins dans les tests.)
3. La colorimétrie de la photo est rapprochée de celle du rendu sur la voiture, avec des gains et
   décalages bornés : la nouvelle lumière s'applique, la couleur de la peinture ne change pas.
4. Le bord du masque est adouci (environ 0,25 % de la diagonale) et les deux images sont mêlées.

Les étapes 1 (choix et masque), 2, 3 et 4 sont testées sans GPU :
`python -m pytest services/vehicle-protection/tests -q`.

## Avant de l'activer pour les clients

À faire sur de vraies photos de concessionnaires (au moins 20, de face, de trois quarts, de
profil, avec et sans autres voitures derrière, citadine, SUV, utilitaire blanc) :

- le véhicule restauré entier, rétroviseurs et antenne compris ;
- aucun morceau de l'ancien décor collé (bords, passages de roue, sous la voiture) ;
- le nouveau décor visible à travers les vitres, sans « trou » ;
- pas de marche de couleur entre la voiture et la scène ;
- part de rendus refusés pour « voiture déplacée » (`framing`) : si elle est forte, regarder si
  Gemini recadre la voiture et durcir le prompt plutôt que la tolérance.

Ce banc coûte des rendus Gemini (environ 0,05 € l'image) et du GPU Modal : fixer un budget avant.
