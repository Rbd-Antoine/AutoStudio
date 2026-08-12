export const CAR_BACKGROUNDS = [
  {
    slug: 'garage-neon',
    name: 'Garage néon',
    desc: 'Hangar industriel, structure métallique et éclairage néon',
    image: '/background/fond-futuriste-hangar-garage-salle-exposition-atelier-fond-industriel-sous-sol-neons-pour-design-futuriste-fond-industriel-neons-pour-votre-produit-rendu-3d_120871-2683.jpg',
  },
  {
    slug: 'hangar-industriel',
    name: 'Hangar industriel',
    desc: 'Sol en béton poli, structure apparente, ambiance atelier',
    image: '/background/cb187f9b69244990a901aa51287240a3.jpeg',
  },
  {
    slug: 'parking-souterrain',
    name: 'Parking souterrain',
    desc: 'Parking couvert de centre commercial, éclairage artificiel',
    image: '/background/parking-souterrain-dans-centre-commercial_93675-134900.jpg',
  },
  {
    slug: 'piece-vide',
    name: 'Pièce vide moderne',
    desc: 'Intérieur épuré et minimaliste, lumière douce',
    image: '/background/chambre-moderne-vide_23-2150528603.jpg',
  },
] as const

export type CarBackground = (typeof CAR_BACKGROUNDS)[number]
