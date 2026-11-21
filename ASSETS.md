# Assets de la page d'accueil « Le studio »

Aucun modèle 3D, HDRI ni texture tiers n'est utilisé : la scène est en 2.5D, faite à partir
d'images déjà présentes dans le dépôt (voir JOURNAL.md, « Décision structurante »).

| Asset | Source | Licence | Utilisé pour |
|---|---|---|---|
| `public/showcase/voitures/voiture-01/before.webp` | Photo client déjà présente dans le dépôt | Celle des exemples du site existant (à confirmer par le propriétaire) | Chapitre 1 (parking), détourage de la voiture |
| `public/showcase/voitures/voiture-01/after.webp` | Vrai rendu AutoStudio de cette photo | Produit par AutoStudio | Chapitre 2 (studio), décor « Garage néon » |
| `public/background/*.jpg` (hangar, parking souterrain, pièce vide) | Fonds de l'éditeur déjà présents dans le dépôt. Les noms de fichiers ont le format des identifiants **Freepik** (`…_23-2150528603`, `…_93675-134900`, `…_120871-2683`) | **À vérifier par le propriétaire** : la licence gratuite Freepik exige une attribution, la licence Premium non. Ces images servent déjà à l'éditeur ; la page d'accueil les montre en plus | Chapitre 3 (trois décors en illustration) |
| `public/site-3d/*` | Dérivés des images ci-dessus par `docs/site-3d/pipeline/prepare_assets.py` (alignement, détourage, logo de calandre effacé, fonds ajustés au cadre, ombre calculée) | Celle des images sources | Toute la scène |
| Big Shoulders (next/font/google) | Google Fonts, Patric King / Chicago Design Studio | SIL Open Font License 1.1 | Titres |
| IBM Plex Sans (next/font/google) | Google Fonts, IBM | SIL Open Font License 1.1 | Texte |

Écartés (voir JOURNAL.md) :

- Khronos glTF Sample Assets, `CarConcept` (CC-BY 4.0, Eric Chadwick / Darmstadt Graphics Group,
  d'après un modèle CC0 de « Unity Fan ») : silhouette reconnaissable d'une marque réelle et logos
  Khronos sur le modèle. Non téléchargé dans le dépôt.
- Poly Haven (CC0) : aucune voiture visible dans le catalogue de modèles.

Aucun crédit CC-BY n'est donc nécessaire dans le footer pour l'instant.
