'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Upload, Loader2, Download, ArrowLeft, Sparkles,
  PenLine, Wand2, RefreshCw, Palette, Send, AlertTriangle, X, Clapperboard, Check, Star, Plus,
  ImagePlus, BadgeCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CAR_BACKGROUNDS } from '@/lib/carBackgrounds'
import { downloadUrlAsFile } from '@/lib/download-file'
import { MarketingKitModal } from '@/components/app/MarketingKitModal'
import { VerifyEmailModal } from '@/components/app/VerifyEmailModal'
import { announceCredits } from '@/lib/credits-events'

const MAX_PHOTOS = 5
const MAX_FILE_SIZE = 20 * 1024 * 1024 // matches the "jusqu'à 20 Mo" copy on the dropzone
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']

// A real bug: `file.type` for .heic/.heif is empty on a lot of Windows/Chromium setups (no
// registered MIME mapping), which made this reject valid HEIC uploads outright — exactly the
// format iPhones capture in by default. Falls back to the extension when the browser can't or
// won't report a type, rather than trusting `file.type` alone.
function validateImageFile(f: File): string | null {
  const hasAcceptedType = ACCEPTED_TYPES.includes(f.type) || f.type.startsWith('image/')
  const hasAcceptedExtension = ACCEPTED_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
  if (!hasAcceptedType && !hasAcceptedExtension) {
    return 'Ce fichier n\'est pas une image. Formats acceptés : JPG, PNG, HEIC.'
  }
  if (f.size > MAX_FILE_SIZE) {
    return `Cette photo pèse ${(f.size / (1024 * 1024)).toFixed(1)} Mo, la limite est de 20 Mo.`
  }
  return null
}

interface GenState {
  status: 'idle' | 'loading' | 'done' | 'error'
  error?: string
}

interface CreditError {
  available: number
  required: number
}

interface Version {
  id: string
  url: string
  kind: 'generate' | 'retouch'
  processingMs?: number
}

function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Real bug (a user's upload failed with a raw "Request Entity Too Large" — Vercel hard-caps
// serverless function request bodies at 4.5 Mo, and a phone photo sent at full resolution
// blows well past that once base64-encoded, which inflates size by ~33%). Downscaling here
// means the 20 Mo the dropzone advertises is honest — the actual upload the AI receives stays
// small regardless of the source photo's resolution, since a background swap doesn't benefit
// from more than ~2000px on the long edge anyway.
const MAX_UPLOAD_DIMENSION = 2000
const UPLOAD_JPEG_QUALITY = 0.85

async function prepareImageForUpload(file: File): Promise<{ base64: string; mimeType: string }> {
  try {
    const dataUrl = await readFileAsDataUrl(file)
    const img = new window.Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode failed'))
      img.src = dataUrl
    })

    const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
    const width  = Math.round(img.naturalWidth * scale)
    const height = Math.round(img.naturalHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas context')
    ctx.drawImage(img, 0, 0, width, height)

    const resizedDataUrl = canvas.toDataURL('image/jpeg', UPLOAD_JPEG_QUALITY)
    return { base64: resizedDataUrl.split(',')[1], mimeType: 'image/jpeg' }
  } catch {
    // HEIC in particular can't be decoded into a canvas by every browser (Safari can, Chrome
    // generally can't) — fall back to sending the original file untouched rather than fail the
    // whole generation over a resize step that's a nice-to-have, not a requirement.
    const dataUrl = await readFileAsDataUrl(file)
    return { base64: dataUrl.split(',')[1], mimeType: file.type || 'image/jpeg' }
  }
}

function splitDataUrl(dataUrl: string): { base64: string; mimeType: string } {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
  if (!match) throw new Error('Format image invalide')
  return { mimeType: match[1], base64: match[2] }
}

// The dealer's own background (showroom, workshop) is kept on this device so it is there at the
// next visit. A downscaled JPEG data URI fits easily in localStorage; if the browser refuses
// (private window, full storage) the background simply lasts for the session.
const CUSTOM_BG_KEY = 'autostudio-custom-background'
const LOGO_PREF_KEY = 'autostudio-logo-on-renders'
type BackgroundChoice = typeof CAR_BACKGROUNDS[number]['slug'] | 'custom'
type LogoCorner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
const LOGO_CORNERS: { id: LogoCorner; label: string }[] = [
  { id: 'top-left', label: 'En haut à gauche' },
  { id: 'top-right', label: 'En haut à droite' },
  { id: 'bottom-left', label: 'En bas à gauche' },
  { id: 'bottom-right', label: 'En bas à droite' },
]

function focusAndScroll(ref: React.RefObject<HTMLElement | null>) {
  ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  if (ref.current instanceof HTMLInputElement || ref.current instanceof HTMLTextAreaElement) {
    window.setTimeout(() => ref.current?.focus(), 300)
  }
}

export default function EditorClient() {
  const [files, setFiles]                    = useState<File[]>([])
  const [previews, setPreviews]              = useState<string[]>([])
  const [backgroundSlug, setBackgroundSlug]  = useState<BackgroundChoice>(CAR_BACKGROUNDS[0].slug)
  const [customBg, setCustomBg]              = useState<string | null>(null)
  const [customBgError, setCustomBgError]    = useState<string | null>(null)
  const customBgInputRef                     = useRef<HTMLInputElement>(null)
  const [brandLogo, setBrandLogo]            = useState<string | null | undefined>(undefined)
  const [logoOn, setLogoOn]                  = useState(false)
  const [logoCorner, setLogoCorner]          = useState<LogoCorner>('bottom-right')
  const [characteristics, setCharacteristics] = useState('')
  const [gen, setGen]                        = useState<GenState>({ status: 'idle' })
  const [partialError, setPartialError]      = useState<string | null>(null)
  const [uploadError, setUploadError]        = useState<string | null>(null)
  const [isDragging, setIsDragging]          = useState(false)
  const dragCounter                          = useRef(0)
  const fileInputRef                         = useRef<HTMLInputElement>(null)

  const [versions, setVersions]     = useState<Version[]>([])
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [retouchText, setRetouchText]     = useState('')
  const [retouchStatus, setRetouchStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [retouchError, setRetouchError]   = useState<string | undefined>()
  const [creditError, setCreditError]     = useState<CreditError | null>(null)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [showMarketingKit, setShowMarketingKit] = useState(false)
  // Starts true (badge hidden) to avoid a server/client mismatch flash — localStorage doesn't
  // exist during SSR, so we can only know the real answer after mount.
  const [marketingKitSeen, setMarketingKitSeen] = useState(true)
  const uploadSectionRef  = useRef<HTMLDivElement>(null)
  const styleSectionRef   = useRef<HTMLDivElement>(null)
  const characteristicsRef = useRef<HTMLTextAreaElement>(null)
  const retouchInputRef    = useRef<HTMLInputElement>(null)

  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [credits, setCredits]         = useState<number | null>(null)
  const [feedbackCreditGranted, setFeedbackCreditGranted] = useState(false)
  const [featureCosts, setFeatureCosts] = useState<Record<string, number>>({})

  useEffect(() => {
    fetch('/api/pricing')
      .then(r => r.json())
      .then(d => {
        const costs: Record<string, number> = {}
        for (const f of d.features ?? []) costs[f.key] = f.creditCost
        setFeatureCosts(costs)
      })
      .catch(() => {})
  }, [])

  const refreshCredits = useCallback(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(d => {
        setCredits((d.monthlyCredits ?? 0) + (d.bonusCredits ?? 0))
        if (typeof d.creditsRemaining === 'number') announceCredits(d.creditsRemaining)
        setFeedbackCreditGranted(!!d.feedbackCreditGranted)
        if (d.workspaceId) setWorkspaceId(d.workspaceId)
      })
      .catch(() => {})
  }, [])

  useEffect(() => { refreshCredits() }, [refreshCredits])

  // The dealer's saved background and logo preferences, and the brand kit's logo.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_BG_KEY)
      if (saved?.startsWith('data:image/')) setCustomBg(saved)
      const pref = JSON.parse(localStorage.getItem(LOGO_PREF_KEY) ?? 'null') as { on?: boolean; corner?: LogoCorner } | null
      if (pref?.corner && LOGO_CORNERS.some(c => c.id === pref.corner)) setLogoCorner(pref.corner)
      if (pref?.on) setLogoOn(true)
    } catch { /* storage unavailable: defaults */ }
    fetch('/api/brand-kit/default')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setBrandLogo(d?.logoUrl ?? null))
      .catch(() => setBrandLogo(null))
  }, [])

  const saveLogoPref = useCallback((on: boolean, corner: LogoCorner) => {
    setLogoOn(on)
    setLogoCorner(corner)
    try { localStorage.setItem(LOGO_PREF_KEY, JSON.stringify({ on, corner })) } catch { /* session only */ }
  }, [])

  const pickCustomBackground = useCallback(async (file: File) => {
    const error = validateImageFile(file)
    if (error) { setCustomBgError(error); return }
    setCustomBgError(null)
    const prepared = await prepareImageForUpload(file)
    const dataUrl = `data:${prepared.mimeType};base64,${prepared.base64}`
    setCustomBg(dataUrl)
    setBackgroundSlug('custom')
    try { localStorage.setItem(CUSTOM_BG_KEY, dataUrl) } catch { /* too big or blocked: session only */ }
  }, [])
  useEffect(() => { setMarketingKitSeen(localStorage.getItem('autostudio-marketing-kit-seen') === '1') }, [])

  const selected = selectedIdx !== null ? versions[selectedIdx] : null

  const addFiles = useCallback((incoming: File[]) => {
    setFiles(prev => {
      const room = MAX_PHOTOS - prev.length
      if (room <= 0) {
        setUploadError(`Vous pouvez importer jusqu'à ${MAX_PHOTOS} photos.`)
        return prev
      }
      const accepted: File[] = []
      for (const f of incoming) {
        if (accepted.length >= room) break
        const error = validateImageFile(f)
        if (error) { setUploadError(error); continue }
        accepted.push(f)
      }
      if (accepted.length === 0) return prev
      setUploadError(null)
      setPreviews(p => [...p, ...accepted.map(f => URL.createObjectURL(f))])
      setGen({ status: 'idle' })
      return [...prev, ...accepted]
    })
  }, [])

  const removeFile = useCallback((idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
    setPreviews(prev => {
      URL.revokeObjectURL(prev[idx])
      return prev.filter((_, i) => i !== idx)
    })
  }, [])

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    if (dropped.length) addFiles(dropped)
  }, [addFiles])

  // Counter-based (not a single boolean) because dragging over a child element fires
  // dragleave on the parent before dragenter on the child — a naive enter/leave toggle would
  // flicker the highlight off while the pointer is still inside the dropzone.
  const onDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounter.current += 1
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    if (files.length === 0) {
      setGen({ status: 'error', error: 'Ajoutez au moins une photo de votre véhicule avant de générer.' })
      focusAndScroll(uploadSectionRef)
      return
    }
    if (!workspaceId) {
      setGen({ status: 'error', error: 'Session non chargée — rechargez la page et réessayez.' })
      return
    }
    if (backgroundSlug === 'custom' && !customBg) {
      setGen({ status: 'error', error: 'Importez la photo de votre fond, ou choisissez un des décors proposés.' })
      focusAndScroll(styleSectionRef)
      return
    }
    const withLogo = logoOn && !!brandLogo
    setGen({ status: 'loading' })
    setPartialError(null)
    try {
      const prepared = await Promise.all(files.map(prepareImageForUpload))
      type SwapResult = { photoId?: string; enhancedUrl?: string; processingMs?: number; error?: string; code?: string; available?: number; required?: number }

      // One request per photo, in parallel: several photos in a single body blow past Vercel's
      // 4.5 Mo request limit. Each request's outcome is folded into one result per photo, in
      // upload order, so a single failure doesn't discard the renders that did succeed.
      const results = await Promise.all(prepared.map(async (p): Promise<SwapResult> => {
        try {
          const res = await fetch('/api/background-swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              images: [{ base64: p.base64, mimeType: p.mimeType }],
              backgroundSlug,
              characteristics: characteristics.trim() || undefined,
              workspaceId,
              ...(backgroundSlug === 'custom' && customBg ? { customBackground: splitDataUrl(customBg) } : {}),
              ...(withLogo ? { logo: { corner: logoCorner } } : {}),
            }),
          })
          // A non-JSON body means the request never reached our route handler at all (e.g. the
          // platform itself rejecting an oversized payload with a plain-text "Request Entity Too
          // Large") — surface something a user can act on instead of the raw parse exception.
          const data = await res.json().catch(() => null)
          if (!data) {
            return { error: res.status === 413
              ? 'Cette photo est trop volumineuse. Essayez une version compressée.'
              : 'Le serveur a renvoyé une réponse inattendue. Réessayez.' }
          }
          if (res.status === 402 || data.error === 'insufficient_credits') {
            return { error: 'Crédits insuffisants', code: 'insufficient_credits', available: data.available, required: data.required }
          }
          if (data.error === 'email_not_verified') return { error: data.message, code: 'email_not_verified' }
          if (data.error === 'no_logo') return { error: data.message }
          if (!res.ok) return { error: data.error ?? 'Erreur inconnue' }
          return (data.results as SwapResult[])[0] ?? { error: 'La génération a échoué.' }
        } catch {
          return { error: 'Connexion au serveur impossible. Réessayez.' }
        }
      }))

      const successes = results.filter(r => r.enhancedUrl)
      const failures = results.filter(r => r.error)
      const outOfCredits = results.find(r => r.code === 'insufficient_credits')
      const needsVerification = results.some(r => r.code === 'email_not_verified')

      if (successes.length === 0) {
        if (outOfCredits) {
          setGen({ status: 'idle' })
          setCreditError({ available: outOfCredits.available ?? 0, required: outOfCredits.required ?? 0 })
          refreshCredits()
          return
        }
        if (needsVerification) {
          setGen({ status: 'idle' })
          setShowVerifyModal(true)
          return
        }
        throw new Error(failures[0]?.error ?? 'La génération a échoué.')
      }

      setVersions(prev => {
        const startIdx = prev.length
        setSelectedIdx(startIdx)
        return [...prev, ...successes.map(r => ({ id: r.photoId!, url: r.enhancedUrl!, kind: 'generate' as const, processingMs: r.processingMs }))]
      })
      setGen({ status: 'done' })
      if (failures.length > 0) {
        const reason = outOfCredits ? ' : crédits insuffisants' : needsVerification ? ' : vérifiez votre adresse e-mail' : ''
        setPartialError(`${failures.length} photo${failures.length > 1 ? 's' : ''} sur ${files.length} n'${failures.length > 1 ? 'ont' : 'a'} pas pu être traitée${failures.length > 1 ? 's' : ''}${reason}.`)
      }
      refreshCredits()
    } catch (err) {
      setGen({ status: 'error', error: err instanceof Error ? err.message : 'Erreur inconnue' })
    }
  }, [files, workspaceId, backgroundSlug, characteristics, refreshCredits, customBg, logoOn, brandLogo, logoCorner])

  const handleRetouch = useCallback(async () => {
    if (!retouchText.trim() || !selected) return
    if (!workspaceId) {
      setRetouchError('Session non chargée — rechargez la page et réessayez.')
      setRetouchStatus('error')
      return
    }
    setRetouchStatus('loading')
    setRetouchError(undefined)
    try {
      // selected.url is a real hosted Blob URL in the normal case (that's the whole point of
      // the Blob migration) — only genuinely-old data: URIs (from before that migration, or a
      // storage-outage fallback) need the base64 split. Sending the URL and letting the server
      // fetch it keeps this request tiny regardless of the image's size, same reasoning as the
      // upload-side fix.
      const payload = selected.url.startsWith('data:')
        ? (() => { const { base64, mimeType } = splitDataUrl(selected.url); return { imageData: base64, mimeType } })()
        : { imageUrl: selected.url }
      const res = await fetch('/api/retouch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          instruction: retouchText.trim(),
          workspaceId,
          styleSlug: backgroundSlug,
        }),
      })
      const data = await res.json().catch(() => {
        throw new Error(res.status === 413
          ? 'Ce rendu est trop volumineux pour être retouché.'
          : 'Le serveur a renvoyé une réponse inattendue. Réessayez.')
      })
      if (!res.ok) {
        if (res.status === 402 || data.error === 'insufficient_credits') {
          setRetouchStatus('idle')
          setCreditError({ available: data.available ?? 0, required: data.required ?? 0 })
          return
        }
        if (data.error === 'email_not_verified') {
          setRetouchStatus('idle')
          setShowVerifyModal(true)
          return
        }
        throw new Error(data.error ?? 'Erreur inconnue')
      }
      setVersions(prev => {
        const next = [...prev, { id: data.photoId, url: data.enhancedUrl, kind: 'retouch' as const, processingMs: data.processingMs }]
        setSelectedIdx(next.length - 1)
        return next
      })
      setRetouchText('')
      setRetouchStatus('idle')
      refreshCredits()
    } catch (err) {
      setRetouchError(err instanceof Error ? err.message : 'Erreur inconnue')
      setRetouchStatus('error')
    }
  }, [retouchText, selected, workspaceId, backgroundSlug, refreshCredits])

  const handleDownload = async () => {
    const url = selected?.url
    if (!url) return
    await downloadUrlAsFile(url, `autostudio-${backgroundSlug}-${Date.now()}.png`)
  }

  // Deliberately does NOT require `files` — the button always stays clickable so a click with
  // no photo yet still reaches handleGenerate(), which shows a clear "add a photo" message and
  // scrolls to the upload zone, instead of silently doing nothing (a real bug report: a user
  // clicked a disabled-looking button repeatedly and assumed the site was broken).
  const canGenerate = gen.status !== 'loading'
  const canRetouch  = !!selected && retouchStatus !== 'loading'

  return (
    <div className="min-h-screen bg-offwhite text-charcoal">
      {/* Topbar */}
      <header className="sticky top-0 z-10 flex items-center justify-between h-16 sm:h-20 px-3 sm:px-5 border-b border-accent-100 bg-white/95 backdrop-blur-xl">
        <Link href="/app" className="flex items-center gap-2 text-charcoal/45 hover:text-charcoal text-sm transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Tableau de bord</span>
        </Link>
        <Link href="/" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-autostudio.png" alt="AutoStudio" className="h-8 sm:h-14 w-auto object-contain" />
        </Link>
        {/* Turns into a standing "recharge" prompt at 0 rather than a passive "0 crédits" —
            this is a permanent, always-visible reminder regardless of where the zero-credit
            moment was actually triggered (generate, video, retouch, kit marketing). */}
        <Link
          href={credits === 0 ? '/app/billing?upgrade=1' : '/app/billing'}
          className={cn(
            'shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-semibold transition-colors',
            credits === 0
              ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 animate-pulse'
              : 'bg-accent-50 border-accent-200 text-accent-700 hover:bg-accent-100',
          )}
        >
          {credits === null ? '…' : credits === 0 ? "S'abonner" : `${credits.toLocaleString('fr-FR')} crédit${credits === 1 ? '' : 's'}`}
        </Link>
      </header>

      {/* Step tracker — the layout below already follows this exact order (see the order-*
          comment further down); this just makes that implicit sequence visible so a first-time
          user knows what's coming before they start, and where they are once they have. */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-5 pt-5 sm:pt-6">
        <ol className="flex items-center justify-center gap-2 sm:gap-3">
          {([
            { n: 1, label: 'Photos', done: files.length > 0 },
            { n: 2, label: 'Fond', done: files.length > 0 },
            { n: 3, label: 'Résultat', done: versions.length > 0 },
          ] as const).map((step, i) => (
            <li key={step.n} className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors',
                  step.done ? 'bg-accent-500 text-white' : 'bg-accent-100 text-accent-500 border border-accent-200',
                )}>
                  {step.done ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : step.n}
                </span>
                <span className={cn('text-xs font-medium transition-colors', step.done ? 'text-charcoal/70' : 'text-charcoal/40')}>
                  {step.label}
                </span>
              </div>
              {i < 2 && <div className={cn('w-6 sm:w-12 h-px transition-colors', step.done ? 'bg-accent-400' : 'bg-accent-200')} />}
            </li>
          ))}
        </ol>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-5 py-6 sm:py-8 grid lg:grid-cols-[1fr_380px] gap-6 lg:gap-8 items-start">

        {/* Left: upload + result — `contents` on mobile lets children join the outer grid's
            order flow; becomes a real flex column again from lg+ (see order-* on each child) */}
        <div className="contents lg:flex lg:flex-col lg:gap-6">

          {/* Upload zone — up to MAX_PHOTOS photos of the same vehicle */}
          <div
            ref={uploadSectionRef}
            className={cn(
              'order-1 lg:order-none relative rounded-3xl border-2 border-dashed transition-all',
              isDragging
                ? 'border-accent-500 bg-accent-100 scale-[1.01]'
                : files.length > 0
                  ? 'border-accent-200'
                  : 'border-accent-200 bg-accent-50/40 hover:border-accent-400 hover:bg-accent-50 cursor-pointer',
            )}
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onClick={() => files.length === 0 && fileInputRef.current?.click()}
          >
            {files.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20 px-8">
                <div className="w-16 h-16 rounded-2xl bg-accent-100 border border-accent-200 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-accent-400" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-charcoal/55 mb-1">
                    {isDragging ? 'Lâchez vos photos ici' : 'Déposez vos photos de véhicule'}
                  </p>
                  <p className="text-sm text-charcoal/35">Jusqu&apos;à {MAX_PHOTOS} photos · JPG, PNG, HEIC · jusqu&apos;à 20 Mo chacune</p>
                </div>
                <button
                  className="px-5 py-2.5 rounded-xl bg-white border border-accent-200 text-sm font-medium text-charcoal/55 hover:text-charcoal hover:border-accent-400 transition-all"
                  onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                >
                  Choisir des fichiers
                </button>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-3 sm:grid-cols-5 gap-2">
                {previews.map((src, i) => (
                  <div key={src} className="relative aspect-square rounded-xl overflow-hidden border border-accent-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={e => { e.stopPropagation(); removeFile(i) }}
                      aria-label="Retirer cette photo"
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-charcoal/70 hover:bg-charcoal/90 text-white flex items-center justify-center transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {files.length < MAX_PHOTOS && (
                  <button
                    onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                    className="aspect-square rounded-xl border-2 border-dashed border-accent-200 hover:border-accent-400 hover:bg-accent-50 flex flex-col items-center justify-center gap-1 text-accent-400 hover:text-accent-500 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-[11px] font-medium">Ajouter</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Shown right where the scroll-to-upload-zone behaviour above actually lands the
              user, instead of only in the generic error box further down the page which they'd
              have to keep scrolling to find. */}
          {(uploadError || (files.length === 0 && gen.status === 'error')) && (
            <p className="order-1 lg:order-none -mt-3 text-sm text-rose-600 text-center">
              {uploadError ?? gen.error}
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={e => {
              const picked = Array.from(e.target.files ?? [])
              if (picked.length) addFiles(picked)
              e.target.value = ''
            }}
          />

          {/* Result */}
          {selected && (
            <div className="order-2 lg:order-none rounded-3xl border border-accent-200 bg-white overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-accent-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent-500" />
                  <span className="font-semibold text-sm text-accent-700">
                    {selected.kind === 'retouch' ? 'Retouche appliquée' : 'Rendu généré'}
                  </span>
                  {selected.processingMs && (
                    <span className="text-xs text-charcoal/30 ml-1">
                      {(selected.processingMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selected.kind === 'generate' && (
                    <button
                      onClick={() => {
                        setShowMarketingKit(true)
                        localStorage.setItem('autostudio-marketing-kit-seen', '1')
                        setMarketingKitSeen(true)
                      }}
                      className="relative flex items-center gap-1.5 px-4 py-2 rounded-xl border border-accent-200 text-accent-700 hover:bg-accent-50 text-xs font-semibold transition-all"
                    >
                      {/* Fades away for good once clicked once — a badge that never goes away
                          stops meaning "new" and just becomes decoration nobody trusts. */}
                      {!marketingKitSeen && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                      )}
                      <Clapperboard className="w-3.5 h-3.5" />
                      Kit marketing
                    </button>
                  )}
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-500 hover:bg-accent-600 text-white text-xs font-semibold transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Télécharger
                  </button>
                </div>
              </div>

              {/* Quick actions — horizontal scroll strip on mobile, vertical rail from sm+ */}
              <div className="flex sm:hidden gap-2 overflow-x-auto px-3 py-2.5 border-b border-accent-100">
                {[
                  { label: 'Fond',      icon: Palette,    onClick: () => focusAndScroll(styleSectionRef),        disabled: false },
                  { label: 'Prompt',    icon: PenLine,    onClick: () => focusAndScroll(characteristicsRef),     disabled: false },
                  { label: 'Régénérer', icon: RefreshCw,  onClick: () => { if (canGenerate) handleGenerate() },  disabled: !canGenerate },
                  { label: 'Retoucher', icon: Wand2,      onClick: () => focusAndScroll(retouchInputRef),        disabled: false },
                ].map(action => (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap shrink-0 border transition-colors',
                      action.disabled
                        ? 'text-charcoal/20 border-accent-100 cursor-not-allowed'
                        : 'text-charcoal/60 border-accent-200 hover:text-accent-700 hover:bg-accent-50',
                    )}
                  >
                    <action.icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                    {action.label}
                  </button>
                ))}
              </div>

              <div className="flex">
                {/* Quick actions rail (desktop) */}
                <div className="hidden sm:flex flex-col shrink-0 w-36 border-r border-accent-100 py-2">
                  {[
                    { label: 'Changer le fond',    icon: Palette,    onClick: () => focusAndScroll(styleSectionRef),        disabled: false },
                    { label: 'Modifier le prompt', icon: PenLine,   onClick: () => focusAndScroll(characteristicsRef),     disabled: false },
                    { label: 'Regénérer',          icon: RefreshCw, onClick: () => { if (canGenerate) handleGenerate() },  disabled: !canGenerate },
                    { label: 'Retoucher',          icon: Wand2,     onClick: () => focusAndScroll(retouchInputRef),        disabled: false },
                  ].map(action => (
                    <button
                      key={action.label}
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className={cn(
                        'flex items-center gap-2 px-4 py-3 text-left text-[13px] font-medium border-b border-accent-50 last:border-b-0 transition-colors',
                        action.disabled ? 'text-charcoal/20 cursor-not-allowed' : 'text-charcoal/60 hover:text-accent-700 hover:bg-accent-50',
                      )}
                    >
                      <action.icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                      {action.label}
                    </button>
                  ))}
                </div>

                {/* Main result + version thumbnails */}
                <div className="flex-1 flex flex-col sm:flex-row min-w-0">
                  <div className="flex-1 min-w-0 bg-offwhite flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={selected.id}
                      src={selected.url}
                      alt="Véhicule généré"
                      className="w-full object-contain"
                      style={{ maxHeight: 520 }}
                    />
                  </div>

                  {versions.length > 1 && (
                    <div className="w-full sm:w-24 shrink-0 border-t sm:border-t-0 sm:border-l border-accent-100 overflow-x-auto sm:overflow-x-visible sm:overflow-y-auto py-2 sm:py-3 px-2 flex flex-row sm:flex-col gap-2" style={{ maxHeight: 520 }}>
                      {versions.map((v, i) => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedIdx(i)}
                          className={cn(
                            'w-20 sm:w-auto shrink-0 rounded-xl overflow-hidden border-2 transition-all text-left',
                            i === selectedIdx ? 'border-accent-500 ring-2 ring-accent-200' : 'border-transparent hover:border-accent-200',
                          )}
                        >
                          {v.url.startsWith('data:') ? (
                            // Older versions still have a base64 data: URI (pre-fal.ai-storage
                            // migration) — next/image can't optimize those.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.url} alt="" className="w-full aspect-[4/3] object-cover" />
                          ) : (
                            <div className="relative w-full aspect-[4/3]">
                              <Image src={v.url} alt="" fill sizes="96px" className="object-cover" />
                            </div>
                          )}
                          <p className="text-[10px] text-center text-charcoal/45 py-1 truncate px-1">Version {i + 1}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Retouch bar */}
              <div className="border-t border-accent-100 px-4 pt-3 pb-0 flex items-center justify-between">
                <span className="text-[11px] text-charcoal/35">
                  Retouche — Coûte {featureCosts.imageRetouch ?? 1} crédit{(featureCosts.imageRetouch ?? 1) === 1 ? '' : 's'}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center gap-2 bg-charcoal/60">
                <input
                  ref={retouchInputRef}
                  type="text"
                  value={retouchText}
                  onChange={e => setRetouchText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && canRetouch && retouchText.trim()) handleRetouch() }}
                  placeholder="Ex : atténuer les reflets sur le pare-brise, éclaircir légèrement la carrosserie…"
                  className="flex-1 min-w-0 bg-white border border-accent-200 rounded-xl px-4 py-2.5 text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100 transition-all"
                />
                <button
                  onClick={handleRetouch}
                  disabled={!canRetouch || !retouchText.trim()}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0',
                    canRetouch && retouchText.trim()
                      ? 'bg-glow-500 hover:bg-glow-400 text-white cursor-pointer'
                      : 'bg-accent-100 text-accent-300 cursor-not-allowed',
                  )}
                >
                  {retouchStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Appliquer
                </button>
              </div>
              {retouchStatus === 'error' && retouchError && (
                <div className="px-4 pb-3 -mt-1">
                  <p className="text-xs text-rose-600">{retouchError}</p>
                </div>
              )}
            </div>
          )}

          {/* Characteristics */}
          <div className="order-8 lg:order-none rounded-2xl border border-accent-100 bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-accent-100 flex items-center gap-2">
              <PenLine className="w-4 h-4 text-accent-500" strokeWidth={1.75} />
              <div>
                <h2 className="font-display font-semibold text-[15px] text-charcoal">Caractéristiques</h2>
                <p className="text-xs text-charcoal/40 mt-0.5">Précisez votre projet — optionnel</p>
              </div>
            </div>
            <div className="p-4">
              <textarea
                ref={characteristicsRef}
                value={characteristics}
                onChange={e => setCharacteristics(e.target.value)}
                placeholder="Ex : garder un léger reflet sur la carrosserie, cadrage serré sur l'avant du véhicule…"
                rows={4}
                className="w-full bg-offwhite border border-accent-200 rounded-xl px-4 py-3 text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100 resize-none transition-all"
              />
              <p className="text-xs text-charcoal/30 mt-2">
                Ces précisions seront transmises à l&apos;IA pour personnaliser le rendu.
              </p>
            </div>
          </div>

          {/* Tips */}
          <div className="order-9 lg:order-none rounded-2xl border border-accent-100 bg-offwhite p-5">
            <p className="text-[11px] font-semibold text-charcoal/35 uppercase tracking-widest mb-3">
              Conseils photo
            </p>
            <ul className="flex flex-col gap-2.5 text-xs text-charcoal/50 leading-relaxed">
              <li className="flex items-start gap-2">
                <span>📸</span>
                <span>Photographiez le véhicule de 3/4 avant, avec la carrosserie entière visible</span>
              </li>
              <li className="flex items-start gap-2">
                <span>☀️</span>
                <span>La lumière naturelle du jour donne les meilleurs résultats</span>
              </li>
              <li className="flex items-start gap-2">
                <span>🚗</span>
                <span>Évitez les reflets et ombres portées trop marquées sur la carrosserie</span>
              </li>
            </ul>
          </div>

          {/* The "no photo yet" case is already shown right next to the upload zone above
              (that's where handleGenerate scrolls to) — only render this one for errors that
              happen once files exist, e.g. an API failure, so the message isn't duplicated. */}
          {gen.status === 'error' && files.length > 0 && (
            <div className="order-10 lg:order-none rounded-2xl bg-rose-50 border border-rose-200 px-5 py-4 text-sm text-rose-700">
              {gen.error}
            </div>
          )}
          {partialError && (
            <div className="order-10 lg:order-none rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-700">
              {partialError}
            </div>
          )}
        </div>

        {/* Right: background + generate */}
        <div className="contents lg:flex lg:flex-col lg:gap-4">

          {/* Background picker */}
          <div ref={styleSectionRef} className="order-5 lg:order-none rounded-2xl border border-accent-100 bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-accent-100">
              <h2 className="font-display font-semibold text-[15px] text-charcoal">Fond sélectionné</h2>
              <p className="text-xs text-charcoal/40 mt-0.5">Choisissez le décor pour vos photos</p>
            </div>
            <div className="p-3 flex flex-col gap-1">
              {CAR_BACKGROUNDS.map(bg => (
                <button
                  key={bg.slug}
                  onClick={() => setBackgroundSlug(bg.slug)}
                  aria-pressed={backgroundSlug === bg.slug}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
                    backgroundSlug === bg.slug
                      ? 'bg-accent-50 border border-accent-300'
                      : 'border border-transparent hover:bg-charcoal/[0.06] hover:border-accent-100',
                  )}
                >
                  <Image src={bg.image} alt="" width={44} height={44} className="w-11 h-11 rounded-lg object-cover shrink-0" />
                  <div>
                    <p className={cn(
                      'text-sm font-semibold',
                      backgroundSlug === bg.slug ? 'text-accent-700' : 'text-charcoal/75',
                    )}>
                      {bg.name}
                    </p>
                    <p className="text-xs text-charcoal/40">{bg.desc}</p>
                  </div>
                </button>
              ))}

              {/* The dealer's own background: a photo of the showroom, the workshop, the forecourt. */}
              <button
                onClick={() => (customBg ? setBackgroundSlug('custom') : customBgInputRef.current?.click())}
                aria-pressed={backgroundSlug === 'custom'}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
                  backgroundSlug === 'custom'
                    ? 'bg-accent-50 border border-accent-300'
                    : 'border border-dashed border-accent-200 hover:bg-charcoal/[0.06] hover:border-accent-300',
                )}
              >
                {customBg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={customBg} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                ) : (
                  <span className="w-11 h-11 rounded-lg bg-accent-50 border border-accent-200 flex items-center justify-center shrink-0">
                    <ImagePlus className="w-5 h-5 text-accent-500" strokeWidth={1.75} />
                  </span>
                )}
                <div>
                  <p className={cn('text-sm font-semibold', backgroundSlug === 'custom' ? 'text-accent-700' : 'text-charcoal/75')}>
                    Votre propre fond
                  </p>
                  <p className="text-xs text-charcoal/40">
                    {customBg ? 'Votre photo, mémorisée sur cet appareil' : 'Importez une photo de votre showroom ou de votre atelier'}
                  </p>
                </div>
              </button>
              {customBg && (
                <button
                  onClick={() => customBgInputRef.current?.click()}
                  className="self-start ml-4 mt-0.5 text-xs font-medium text-accent-600 hover:text-accent-700 underline underline-offset-2"
                >
                  Remplacer la photo du fond
                </button>
              )}
              {customBgError && <p className="ml-4 text-xs text-rose-600">{customBgError}</p>}
              <input
                ref={customBgInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="hidden"
                onChange={e => {
                  const picked = e.target.files?.[0]
                  if (picked) void pickCustomBackground(picked)
                  e.target.value = ''
                }}
              />
            </div>
            {backgroundSlug === 'custom' && (
              <p className="px-5 pb-4 -mt-1 text-xs leading-relaxed text-charcoal/45">
                Conseil : une photo prise de face ou de trois quarts, sans voiture au centre, avec un sol bien visible. L&apos;IA y place votre véhicule avec la lumière et les ombres du lieu.
              </p>
            )}
          </div>

          {/* The dealer's logo, placed on the render by the server exactly as uploaded. */}
          <div className="order-5 lg:order-none rounded-2xl border border-accent-100 bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-accent-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold text-[15px] text-charcoal">Votre logo</h2>
                <p className="text-xs text-charcoal/40 mt-0.5">Apposé sur chaque rendu, sans être redessiné</p>
              </div>
              {brandLogo && (
                <button
                  role="switch"
                  aria-checked={logoOn}
                  aria-label="Ajouter mon logo sur les rendus"
                  onClick={() => saveLogoPref(!logoOn, logoCorner)}
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-colors shrink-0',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
                    logoOn ? 'bg-accent-500' : 'bg-charcoal/15',
                  )}
                >
                  <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', logoOn && 'translate-x-5')} />
                </button>
              )}
            </div>
            <div className="p-4">
              {brandLogo === undefined ? (
                <p className="text-xs text-charcoal/35">Chargement…</p>
              ) : brandLogo === null ? (
                <div className="flex items-start gap-3">
                  <BadgeCheck className="w-5 h-5 text-accent-400 shrink-0 mt-0.5" strokeWidth={1.75} />
                  <p className="text-xs leading-relaxed text-charcoal/50">
                    Ajoutez votre logo une fois dans le{' '}
                    <Link href="/app/brand-kit" className="font-semibold text-accent-600 hover:text-accent-700 underline underline-offset-2">kit de marque</Link>
                    {' '}: il pourra ensuite figurer sur tous vos rendus.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  {/* A miniature of the render frame: pick the corner where the logo goes. */}
                  <div className={cn('relative w-28 aspect-[4/3] rounded-lg border bg-offwhite shrink-0 transition-opacity', logoOn ? 'border-accent-200' : 'border-accent-100 opacity-50')}>
                    {LOGO_CORNERS.map(c => {
                      const active = logoOn && logoCorner === c.id
                      return (
                        <button
                          key={c.id}
                          aria-label={c.label}
                          aria-pressed={logoCorner === c.id}
                          onClick={() => saveLogoPref(true, c.id)}
                          className={cn(
                            'absolute w-9 h-6 rounded-md flex items-center justify-center transition-all',
                            c.id.startsWith('top') ? 'top-1.5' : 'bottom-1.5',
                            c.id.endsWith('left') ? 'left-1.5' : 'right-1.5',
                            active ? 'bg-white ring-2 ring-accent-500 shadow-sm' : 'hover:bg-white/80',
                          )}
                        >
                          {active ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={brandLogo} alt="" className="max-w-[30px] max-h-[18px] object-contain" />
                          ) : (
                            <span className="w-4 h-1.5 rounded-full bg-charcoal/15" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs leading-relaxed text-charcoal/50">
                    {logoOn
                      ? `Logo ${LOGO_CORNERS.find(c => c.id === logoCorner)?.label.toLowerCase()}. Cliquez un autre coin pour le déplacer.`
                      : 'Activez pour placer votre logo sur les prochains rendus.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Generate */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={cn(
              'order-6 lg:order-none w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-sm transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2',
              canGenerate
                ? 'bg-accent-500 hover:bg-accent-600 text-white shadow-sm hover:shadow-md cursor-pointer'
                : 'bg-accent-100 text-accent-300 cursor-not-allowed border border-accent-200',
            )}
          >
            {gen.status === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Génération en cours…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {files.length > 1 ? `Générer mes ${files.length} rendus` : 'Générer mon rendu'}
                {featureCosts.imageGeneration != null ? ` · ${featureCosts.imageGeneration} crédit${featureCosts.imageGeneration === 1 ? '' : 's'}/photo` : ''}
              </>
            )}
          </button>

          {gen.status === 'loading' && (
            <p className="order-7 lg:order-none text-xs text-center text-charcoal/35 leading-relaxed">
              L&apos;IA remplace l&apos;arrière-plan de vos photos, la voiture reste inchangée.<br />
              Comptez 30 à 90 secondes selon le nombre de photos.
            </p>
          )}

          {files.length === 0 && gen.status !== 'loading' && (
            <p className="order-7 lg:order-none text-xs text-center text-charcoal/30">
              Téléchargez d&apos;abord une ou plusieurs photos de votre véhicule
            </p>
          )}
        </div>
      </div>

      {/* Blocking popup — the guaranteed-visible warning that a render is in progress and the
          user needs to wait, regardless of whether a previous result already fills the main
          content area (a first-ever generation has nothing else on screen to signal this). */}
      {gen.status === 'loading' && <GeneratingModal />}

      {creditError && (
        <InsufficientCreditsModal
          available={creditError.available}
          required={creditError.required}
          workspaceId={workspaceId ?? undefined}
          feedbackCreditGranted={feedbackCreditGranted}
          onClose={() => setCreditError(null)}
          onCreditGranted={refreshCredits}
        />
      )}

      {showVerifyModal && <VerifyEmailModal onClose={() => setShowVerifyModal(false)} />}

      {showMarketingKit && selected && (
        <MarketingKitModal photoId={selected.id} onClose={() => setShowMarketingKit(false)} />
      )}
    </div>
  )
}

// No close button and the backdrop doesn't dismiss it — unlike InsufficientCreditsModal below,
// there is nothing to cancel here: the fetch keeps running either way, so offering a "close"
// affordance would just let the user believe they stopped something they didn't. It disappears
// on its own the moment gen.status leaves 'loading', which is the real signal, not a timer.
function GeneratingModal() {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-charcoal/40 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl w-full max-w-sm p-7 pointer-events-auto shadow-card text-center">
          <Loader2 className="w-9 h-9 mx-auto text-accent-500 animate-spin mb-4" />
          <h3 className="font-display font-semibold text-lg text-charcoal mb-2">
            Génération du rendu en cours
          </h3>
          <p className="text-sm text-charcoal/50">
            Merci de patienter, ne fermez pas cette page.
            <br />
            Comptez 30 à 90 secondes.
          </p>
        </div>
      </div>
    </>
  )
}

// Auto-redirects to the subscription plans after a few seconds instead of waiting for the user
// to notice and click a link — a FREE user at 0 credits gets more value from subscribing to
// Essentiel than from a one-time credit-pack top-up, so ?upgrade=1 scrolls straight to the
// plans grid rather than opening the top-up modal. Still cancelable ("Rester ici") rather than
// forced, and the countdown is visible rather than a surprise jump.
const CREDIT_MODAL_REDIRECT_SECONDS = 5

const MIN_FEEDBACK_LENGTH = 15

function InsufficientCreditsModal({
  available, required, workspaceId, feedbackCreditGranted, onClose, onCreditGranted,
}: {
  available: number
  required: number
  workspaceId?: string
  feedbackCreditGranted: boolean
  onClose: () => void
  onCreditGranted: () => void
}) {
  const router = useRouter()
  const [secondsLeft, setSecondsLeft] = useState(CREDIT_MODAL_REDIRECT_SECONDS)
  const [autoRedirect, setAutoRedirect] = useState(true)
  const isFullyOut = available === 0

  // Lets a workspace that's fully out earn 1 non-expiring credit for a short, honest piece
  // of feedback — a cheap way to both soften the wall and hear from the users likeliest to
  // churn silently instead of subscribing. One-time only (server-enforced via
  // feedbackCreditGrantedAt), so this can't be farmed by resubmitting each cycle.
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  useEffect(() => {
    if (!autoRedirect) return
    if (secondsLeft <= 0) {
      router.push('/app/billing?upgrade=1')
      return
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [autoRedirect, secondsLeft, router])

  const openFeedback = () => {
    setAutoRedirect(false) // don't let the countdown yank them away mid-typing
    setFeedbackOpen(true)
  }

  const submitFeedback = async () => {
    if (!workspaceId || message.trim().length < MIN_FEEDBACK_LENGTH) return
    setFeedbackStatus('sending')
    setFeedbackError(null)
    try {
      const res = await fetch('/api/feedback/credit-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, message: message.trim(), rating: rating ?? undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedbackError(data.message ?? 'Erreur inconnue')
        setFeedbackStatus('error')
        return
      }
      setFeedbackStatus('done')
      onCreditGranted()
    } catch {
      setFeedbackError('Erreur inconnue')
      setFeedbackStatus('error')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-charcoal/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white border border-rose-100 rounded-2xl w-full max-w-sm p-6 pointer-events-auto shadow-card text-center relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded hover:bg-accent-50 text-charcoal/40"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>

          {feedbackStatus === 'done' ? (
            <>
              <div className="w-12 h-12 mx-auto rounded-full bg-accent-50 border border-accent-200 flex items-center justify-center mb-4">
                <Check className="w-6 h-6 text-accent-600" strokeWidth={2} />
              </div>
              <h3 className="font-display font-semibold text-lg text-charcoal mb-2">Merci pour votre avis !</h3>
              <p className="text-sm text-charcoal/50 mb-6">1 crédit gratuit vient d&apos;être ajouté à votre compte.</p>
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-accent-500 hover:bg-accent-600 text-white px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                Continuer
              </button>
            </>
          ) : (
            <>
              <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-rose-500" strokeWidth={1.75} />
              </div>
              <h3 className="font-display font-semibold text-lg text-charcoal mb-2">
                {isFullyOut ? 'Vous avez utilisé tous vos crédits' : 'Crédits insuffisants pour cette action'}
              </h3>
              <p className="text-sm text-charcoal/50 mb-6">
                {isFullyOut
                  ? 'Abonnez-vous pour continuer à générer des rendus et convaincre vos prochains clients.'
                  : <>Il vous faut {required} crédit{required === 1 ? '' : 's'} pour cette action, il vous en reste {available}.</>}
              </p>

              {!feedbackOpen ? (
                <div className="flex flex-col gap-2">
                  <Link
                    href="/app/billing?upgrade=1"
                    className="rounded-xl bg-accent-500 hover:bg-accent-600 text-white px-4 py-2.5 text-sm font-semibold transition-colors"
                  >
                    Passer à l&apos;abonnement Essentiel
                  </Link>
                  {isFullyOut && workspaceId && !feedbackCreditGranted && (
                    <button
                      onClick={openFeedback}
                      className="text-sm text-accent-600 hover:text-accent-700 font-medium py-1"
                    >
                      Ou laissez un avis honnête pour 1 crédit gratuit
                    </button>
                  )}
                  {autoRedirect ? (
                    <button onClick={() => setAutoRedirect(false)} className="text-sm text-charcoal/40 hover:text-charcoal/60 py-1">
                      Rester ici <span className="tabular-nums">· redirection dans {secondsLeft}s</span>
                    </button>
                  ) : (
                    <button onClick={onClose} className="text-sm text-charcoal/40 hover:text-charcoal/60 py-1">
                      Fermer
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3 text-left">
                  <div className="flex items-center justify-center gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
                        className="p-0.5"
                      >
                        <Star
                          className={cn('w-6 h-6 transition-colors', rating != null && n <= rating ? 'fill-amber-400 text-amber-400' : 'text-charcoal/20')}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Qu'est-ce qui vous plaît, ou vous freine, avec AutoStudio ?"
                    className="w-full rounded-lg border border-accent-200 px-3 py-2 text-sm focus:outline-none focus:border-accent-400 resize-none"
                  />
                  <p className="text-[11px] text-charcoal/35">
                    {message.trim().length}/{MIN_FEEDBACK_LENGTH} caractères minimum
                  </p>
                  {feedbackError && <p className="text-xs text-rose-500">{feedbackError}</p>}
                  <button
                    onClick={submitFeedback}
                    disabled={feedbackStatus === 'sending' || message.trim().length < MIN_FEEDBACK_LENGTH}
                    className="rounded-xl bg-accent-500 hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 text-sm font-semibold transition-colors"
                  >
                    {feedbackStatus === 'sending' ? 'Envoi…' : 'Envoyer et recevoir mon crédit'}
                  </button>
                  <button onClick={() => setFeedbackOpen(false)} className="text-sm text-charcoal/40 hover:text-charcoal/60 py-1">
                    Annuler
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
