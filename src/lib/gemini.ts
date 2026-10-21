import { buildRetouchPrompt, buildBackgroundSwapPrompt } from './carPrompts'

export interface StyledImage {
  base64: string
  mimeType: string
}

interface ImageInput {
  mimeType: string
  data: string
}

async function callGeminiImage(apiKey: string, prompt: string, images: ImageInput[]): Promise<StyledImage> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent`,
    {
      method: 'POST',
      // The key goes in a header, not the URL, so it never ends up in logged request URLs.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            ...images.map(img => ({ inline_data: { mime_type: img.mimeType, data: img.data } })),
          ],
        }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      }),
    },
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API ${response.status}: ${errText}`)
  }

  const data = await response.json()
  const parts = (data?.candidates?.[0]?.content?.parts ?? []) as Array<{
    text?: string
    inlineData?: { data: string; mimeType: string }
  }>
  const imgPart = parts.find(p => p.inlineData?.data)

  if (!imgPart?.inlineData) throw new Error('Gemini n\'a renvoyé aucune image')

  return {
    base64: imgPart.inlineData.data,
    mimeType: imgPart.inlineData.mimeType ?? 'image/png',
  }
}

export async function retouchImage(
  apiKey: string,
  imageData: string,
  mimeType: string,
  instruction: string,
): Promise<StyledImage> {
  return callGeminiImage(apiKey, buildRetouchPrompt(instruction), [{ mimeType, data: imageData }])
}

// Sends the car photo alongside an actual reference background photo (rather than a text
// description) so the model matches that specific scene instead of a generic style category.
export async function swapBackground(
  apiKey: string,
  carImageData: string,
  carMimeType: string,
  backgroundImageData: string,
  backgroundMimeType: string,
  characteristics?: string,
): Promise<StyledImage> {
  return callGeminiImage(apiKey, buildBackgroundSwapPrompt(characteristics), [
    { mimeType: carMimeType, data: carImageData },
    { mimeType: backgroundMimeType, data: backgroundImageData },
  ])
}

// Plain text completion (no image in/out) — used for the Marketing Kit's social-post caption.
export async function generateText(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API ${response.status}: ${errText}`)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined
  if (!text) throw new Error('Gemini n\'a renvoyé aucun texte')
  return text.trim()
}
