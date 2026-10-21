// Default credit cost of every AI feature the app charges for. Rows are created from this list
// on first use (see ensureDefaultAiFeatures in ./pricing) and by `prisma db seed`, so a fresh
// database works without a manual admin step; an admin can still change the costs afterwards.
// Kept free of imports so prisma/seed.ts can use it without pulling in the app's db client.
export const DEFAULT_AI_FEATURES: ReadonlyArray<{ key: string; label: string; creditCost: number }> = [
  { key: 'imageGeneration', label: 'Image generation', creditCost: 1 },
  { key: 'imageRetouch', label: 'Image retouch', creditCost: 1 },
  // 1 credit per format generated (Reel/Story/Landscape/Square are 4 separate Shotstack calls).
  { key: 'marketingVideo', label: 'Marketing video kit', creditCost: 1 },
]
