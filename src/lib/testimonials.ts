// Shared between the homepage TestimonialsSection and the (auth) layout's sidebar card so
// both pull from a single source instead of hardcoding the same quote independently in two
// places. Placeholder quotes pending real dealer testimonials — replace with permissioned
// quotes as they come in.
export const TESTIMONIALS = [
  { quote: "J'ai remplacé mes photos prises sur le parking par des rendus studio en une minute. Le nombre de clics sur mes annonces a doublé le premier mois.", name: 'Thomas B.', role: 'Responsable commercial', location: 'Lyon, 69', stars: 5 },
  { quote: "Toute mon équipe photographie au smartphone maintenant. CarGlow génère l'arrière-plan et masque la plaque automatiquement. On a divisé par dix le temps de mise en ligne.", name: 'Sophie L.', role: 'Directrice de concession', location: 'Aix-en-Provence, 13', stars: 5 },
  { quote: "Mes annonces ressemblaient à tout le monde. Avec des photos studio cohérentes sur tout le stock, la concession a l'air trois fois plus premium.", name: 'Marc D.', role: 'Gérant de concession', location: 'Bordeaux, 33', stars: 5 },
] as const
