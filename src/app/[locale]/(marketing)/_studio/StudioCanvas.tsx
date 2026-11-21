'use client'

import { useEffect, useRef } from 'react'
import { DECORS, LIGHTS, SCENE_H, SCENE_W, sceneAt, type DecorSlug } from './scene'

// The studio, drawn by one fragment shader: the scene's layers (the customer's parking photo,
// the studio render, the editor's backgrounds, the car's shadow, the car itself — real pixels,
// never redrawn) composited under a camera, with the studio's lights, a decor-swap light sweep,
// a vignette and film grain. Plain WebGL 1, no 3D engine: the car is a real photograph, so there
// is nothing to model, and three.js would add ~150 KB for a single full-screen quad.
//
// Driven from outside through refs: `progress` (0 → 1, the page's only scroll value) and `decor`
// (the background picked in chapter 3). Renders only when something changed, at most 60 fps,
// and not at all while the tab is hidden.

export interface StudioCanvasProps {
  progress: React.RefObject<number>
  decor: React.RefObject<DecorSlug>
  /** Small textures and a capped pixel ratio (phones). */
  light: boolean
  onReady?: () => void
}

const MAX_LIGHTS = 8

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec4 uCam;          // cx, cy, viewW, viewH (scene pixels)
uniform vec2 uScene;        // 1200, 900
uniform sampler2D uBefore, uAfter, uBgA, uBgB, uCar, uShadow;
uniform float uParA, uParB;   // 1 = this decor slides with the parallax (0 for the real render, which holds the car)
uniform float uStudio, uAmbient, uBeforeLight, uCarLight, uDecorSwap, uDim, uTime;
uniform float uBgMix, uSweep;
uniform vec2 uParallax;
uniform vec4 uLightGeo[${MAX_LIGHTS}];    // a.xy, b.xy (a == b for a point)
uniform vec4 uLightParam[${MAX_LIGHTS}];  // radius, level, tint (packed below)
uniform vec3 uLightTint[${MAX_LIGHTS}];

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  return length(p - (a + ab * t));
}

// The picture never shows an edge. Sideways it continues as its own mirror image and fades into
// darkness (the left dissolves under the text column). At the bottom it is never mirrored (the
// floor's texture would show a seam): the floor sinks into the dark before the edge, like a
// studio sweep.
// Sideways and at the top the picture simply fades out before its edge (no mirrored copy: it
// showed as symmetrical smears). At the bottom, glossy floors (studio, decors) continue as a
// blurred reflection; the parking's asphalt just fades to black.
vec2 mirror(vec2 uv) { return vec2(clamp(uv.x, 0.0, 1.0), max(uv.y, 0.0)); }
float inside(vec2 uv, float glossy) {
  // One long linear fade on the left, under the text column; the other edges are off screen in
  // the resting shots (full bleed), and only fade when the camera pulls back (chapter 5).
  float left = smoothstep(-0.04, 0.3, uv.x);
  float right = 1.0 - smoothstep(0.985, 1.04, uv.x);
  float top = smoothstep(-0.03, 0.01, uv.y);
  float bottom = mix(1.0 - smoothstep(0.93, 1.02, uv.y), 1.0 - smoothstep(0.95, 1.2, uv.y), glossy);
  return left * right * top * bottom;
}

// Below the picture, the floor continues as a blurred reflection of itself that grows softer with
// distance: no seam (the blur hides it) and no dead black band.
vec3 floorTap(sampler2D t, vec2 uv) {
  if (uv.y <= 1.0) return texture2D(t, uv).rgb;
  float k = uv.y - 1.0;
  vec2 m = vec2(uv.x, 1.0 - k);
  float r = 0.004 + k * 0.09;
  vec3 c = texture2D(t, m).rgb * 0.2;
  c += texture2D(t, m + vec2(r, 0.0)).rgb * 0.16;
  c += texture2D(t, m - vec2(r, 0.0)).rgb * 0.16;
  c += texture2D(t, m + vec2(0.0, r * 0.6)).rgb * 0.12;
  c += texture2D(t, m - vec2(0.0, r * 0.6)).rgb * 0.12;
  c += texture2D(t, m + vec2(r * 2.0, r)).rgb * 0.06;
  c += texture2D(t, m - vec2(r * 2.0, -r)).rgb * 0.06;
  c += texture2D(t, m + vec2(-r * 2.0, r)).rgb * 0.06;
  c += texture2D(t, m + vec2(r * 2.0, -r)).rgb * 0.06;
  // Same brightness at the edge (no line), a little dimmer further down, like a damp floor.
  return c * mix(1.0, 0.55, smoothstep(0.0, 0.22, k));
}

// Where the car's tyres meet the floor (scene pixels): rear-left, front-left, front-right.
const vec2 W_RL = vec2(272.0, 588.0);
const vec2 W_FL = vec2(566.0, 744.0);
const vec2 W_FR = vec2(975.0, 642.0);
float groundY(float x) {
  return x < W_FL.x ? mix(W_RL.y, W_FL.y, (x - W_RL.x) / (W_FL.x - W_RL.x))
                    : mix(W_FL.y, W_FR.y, (x - W_FL.x) / (W_FR.x - W_FL.x));
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 sp = uCam.xy + (frag - 0.5 * uRes) * (uCam.z / uRes.x);
  vec2 uv = sp / uScene;
  vec2 bgUv = (sp + uParallax) / uScene;
  vec2 bgUvC = mirror(bgUv);
  vec2 uvC = mirror(uv);
  float glossyAll = max(uStudio, uDecorSwap);

  // The studio is the real AutoStudio render, car, shadows and floor reflections included. It
  // holds the car, so it never slides with the parallax (no ghost of the car's edge).
  vec3 after = floorTap(uAfter, uvC);
  float mask = uAmbient;
  vec3 glow = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    vec4 g = uLightGeo[i];
    vec4 q = uLightParam[i];
    if (q.y <= 0.0) continue;
    float d = segDist(sp, g.xy, g.zw);
    float f = exp(-(d * d) / (q.x * q.x));
    mask += q.y * f * 0.9;
    glow += uLightTint[i] * q.y * f * f * 0.22;
  }
  vec3 studio = after * mix(0.05, 1.0, clamp(mask, 0.0, 1.0)) + glow * (1.0 - 0.75 * uAmbient);
  // A denser contact shadow on the studio floor under the tyres and the body (the floor only:
  // the car is drawn over it below).
  studio *= 1.0 - 0.72 * texture2D(uShadow, clamp(uvC, 0.0, 1.0)).r * inside(uv, glossyAll);

  // The customer's own photo, whole (its car and its real shadow): it holds the car too, so it
  // does not slide either. Only the editor's backgrounds below move with the parallax.
  float sh = texture2D(uShadow, clamp(uvC, 0.0, 1.0)).r * inside(uv, glossyAll);
  // The parking's grey sky dimmed towards the top, so the car stays the brightest thing (the
  // photo itself is untouched: a graduated filter over it, as on a lens).
  vec3 before = texture2D(uBefore, clamp(uvC, 0.0, 1.0)).rgb * uBeforeLight * mix(0.62, 1.0, smoothstep(0.05, 0.42, uv.y));
  vec3 col = mix(before, studio, uStudio);

  // The chosen background, swapped with a light sweep crossing the frame. The editor's
  // backgrounds slide with the parallax and take the car's computed shadow.
  vec2 uvA = mix(uvC, bgUvC, uParA);
  vec2 uvB = mix(uvC, bgUvC, uParB);
  vec3 bgA = floorTap(uBgA, uvA) * (1.0 - 0.86 * sh * uParA);
  vec3 bgB = floorTap(uBgB, uvB) * (1.0 - 0.86 * sh * uParB);
  float wipe = uSweep < 0.0 ? uBgMix : smoothstep(uSweep - 0.06, uSweep + 0.06, 1.0 - bgUv.x);
  vec3 decor = mix(bgA, bgB, wipe);
  if (uSweep >= 0.0) decor += vec3(1.0, 0.86, 0.62) * exp(-pow((1.0 - bgUv.x - uSweep) * 22.0, 2.0)) * 0.35;
  col = mix(col, decor, uDecorSwap);

  float glossy = max(uStudio, uDecorSwap);
  // The decor's grade: deeper blacks, and the ceiling's yellow safety stripes calmed so the page
  // keeps a single accent. Applied to the decor only, never to the car's pixels.
  vec3 graded = mix(col, col * col * (3.0 - 2.0 * col), 0.4);
  graded = graded / (1.0 + 0.12 * pow(max(graded, 0.0), vec3(4.0)));  // the lamps keep a shape
  float yellow = smoothstep(0.03, 0.14, min(col.r, col.g) - col.b) * smoothstep(0.12, 0.3, col.r);
  graded = mix(graded, vec3(dot(graded, vec3(0.3, 0.55, 0.15))) * 0.6, yellow);
  // The neon blue pulled a third towards cold steel, closer to the car's neutral light.
  float luma = dot(graded, vec3(0.3, 0.55, 0.15));
  float blue = smoothstep(0.05, 0.25, graded.b - max(graded.r, graded.g));
  graded = mix(graded, mix(vec3(luma), graded, 0.62), blue);
  col = mix(col, graded, glossy);

  // A faint reflection of the car on the glossy floors (studio and decors): the car mirrored
  // about the line where its tyres touch the ground, fading with distance.
  float gy = groundY(sp.x);
  if (sp.y > gy && glossy > 0.0) {
    vec2 m = vec2(sp.x, 2.0 * gy - sp.y) / uScene;
    vec4 rc = texture2D(uCar, clamp(m, 0.0, 1.0));
    vec3 rcol = mix(rc.rgb, texture2D(uAfter, clamp(m, 0.0, 1.0)).rgb, glossy);
    float fade = exp(-(sp.y - gy) / 90.0) * 0.34 * glossy * rc.a;
    col = mix(col, rcol * uCarLight, fade);
  }

  // The decor fades towards the dark edges; the car, drawn after, never does (a fade over it would
  // change the car on the page).
  col *= inside(bgUv, glossyAll);

  // The car, always on top: the customer's photo on the parking, the render's own pixels of the
  // same car in the studio and on every decor (AutoStudio's real output).
  vec4 car = texture2D(uCar, clamp(uvC, 0.0, 1.0));
  float carA = car.a * step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  vec3 carSrc = mix(car.rgb, after, glossy);
  col = mix(col, carSrc * uCarLight, carA);

  col *= 1.0 - uDim;

  // Lens: vignette and a fine grain.
  vec2 v = frag / uRes - 0.5;
  col *= 1.0 - 0.55 * smoothstep(0.35, 0.95, length(v * vec2(1.0, 1.2)));
  col += (hash(frag + fract(uTime) * 61.0) - 0.5) * 0.028;
  gl_FragColor = vec4(col, 1.0);
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`studio shader: ${gl.getShaderInfoLog(s) || (gl.isContextLost() ? 'context lost' : 'no log')}`)
  }
  return s
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`image ${src}`))
    img.src = src
  })
}

function texture(gl: WebGLRenderingContext, img: HTMLImageElement, owned: WebGLTexture[]) {
  const t = gl.createTexture()!
  owned.push(t)
  // Created on a scratch unit: binding it on the active one would replace whatever texture
  // a sampler already reads there.
  gl.activeTexture(gl.TEXTURE7)
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return t
}

/** The decor's plate: the real render for the garage, a fitted editor background otherwise. */
function decorSrc(slug: DecorSlug, sm: string) {
  return slug === 'garage-neon' ? `/site-3d/plate-after${sm}.webp` : `/site-3d/bg-${slug}${sm}.webp`
}

export default function StudioCanvas({ progress, decor, light, onReady }: StudioCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' })
    if (!gl) return
    let disposed = false
    let raf = 0
    const owned: WebGLTexture[] = []

    // Any WebGL failure (old driver, shader refused) leaves the still images on screen: the
    // scene is decoration, the page must never fall over because of it.
    const prog = gl.createProgram()!
    try {
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
      gl.linkProgram(prog)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`studio program: ${gl.getProgramInfoLog(prog)}`)
    } catch (err) {
      console.warn(err instanceof Error ? err.message : err)
      return
    }
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    const u = (name: string) => gl.getUniformLocation(prog, name)

    // Flatten the light groups once: geometry is fixed, only levels change.
    const flat = LIGHTS.flatMap((group, gi) => group.map(l => ({ l, gi }))).slice(0, MAX_LIGHTS)
    const geo = new Float32Array(MAX_LIGHTS * 4)
    const tint = new Float32Array(MAX_LIGHTS * 3)
    flat.forEach(({ l }, i) => {
      const a = l.kind === 'segment' ? l.a : l.at
      const b = l.kind === 'segment' ? l.b : l.at
      geo.set([a[0], a[1], b[0], b[1]], i * 4)
      tint.set(l.tint, i * 3)
    })
    gl.uniform4fv(u('uLightGeo'), geo)
    gl.uniform3fv(u('uLightTint'), tint)
    gl.uniform2f(u('uScene'), SCENE_W, SCENE_H)
    const param = new Float32Array(MAX_LIGHTS * 4)

    const sm = light ? '-sm' : ''
    const units: Record<string, number> = { uBefore: 0, uAfter: 1, uBgA: 2, uBgB: 3, uCar: 4, uShadow: 5 }
    Object.entries(units).forEach(([name, unit]) => gl.uniform1i(u(name), unit))
    const decorTex = new Map<DecorSlug, WebGLTexture>()
    const bind = (unit: number, t: WebGLTexture) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, t)
    }

    // Decor swap animation state.
    let shownDecor: DecorSlug = decor.current ?? 'garage-neon'
    let fromDecor: DecorSlug = shownDecor
    let swapStart = -1
    const SWAP_MS = 900

    let smoothP = progress.current ?? 0
    let lastKey = ''
    let visible = true
    const onVisibility = () => { visible = document.visibilityState === 'visible' }
    document.addEventListener('visibilitychange', onVisibility)

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, light ? 1.5 : 2)
      const w = Math.round(canvas.clientWidth * dpr)
      const h = Math.round(canvas.clientHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
        lastKey = ''
      }
    }
    window.addEventListener('resize', resize)

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible || disposed) return
      resize()
      // Inertia on the scroll value: the camera glides instead of jumping with the wheel.
      const target = progress.current ?? 0
      smoothP += (target - smoothP) * 0.14
      if (Math.abs(target - smoothP) < 1e-4) smoothP = target

      const wanted = decor.current ?? 'garage-neon'
      if (wanted !== shownDecor && swapStart < 0 && decorTex.has(wanted)) {
        fromDecor = shownDecor
        shownDecor = wanted
        swapStart = now
      }
      let sweep = -1
      let mix = 0
      if (swapStart >= 0) {
        const t = Math.min(1, (now - swapStart) / SWAP_MS)
        sweep = t * 1.2 - 0.1
        mix = t
        if (t >= 1) { swapStart = -1; fromDecor = shownDecor }
      }

      const key = `${smoothP.toFixed(5)}|${canvas.width}x${canvas.height}|${shownDecor}|${sweep.toFixed(3)}`
      // Grain moves only while something else does: a still scene costs nothing.
      if (key === lastKey) return
      lastKey = key

      const aspect = canvas.width / canvas.height
      const s = sceneAt(smoothP, aspect, canvas.clientWidth >= 900)
      gl.uniform2f(u('uRes'), canvas.width, canvas.height)
      gl.uniform4f(u('uCam'), s.camera.cx, s.camera.cy, s.camera.viewW, s.camera.viewH)
      gl.uniform1f(u('uStudio'), s.studio)
      gl.uniform1f(u('uAmbient'), s.ambient)
      gl.uniform1f(u('uBeforeLight'), s.studio < 1 ? s.carLight : 0)
      gl.uniform1f(u('uCarLight'), s.carLight)
      gl.uniform1f(u('uDecorSwap'), s.decorSwap)
      gl.uniform1f(u('uDim'), s.dim)
      gl.uniform2f(u('uParallax'), s.parallax[0], s.parallax[1])
      gl.uniform1f(u('uTime'), now / 1000)
      param.fill(0)
      flat.forEach(({ l, gi }, i) => param.set([l.radius, s.lights[gi]], i * 4))
      gl.uniform4fv(u('uLightParam'), param)
      bind(2, decorTex.get(fromDecor)!)
      bind(3, decorTex.get(shownDecor)!)
      gl.uniform1f(u('uParA'), (swapStart >= 0 ? fromDecor : shownDecor) === 'garage-neon' ? 0 : 1)
      gl.uniform1f(u('uParB'), shownDecor === 'garage-neon' ? 0 : 1)
      gl.uniform1f(u('uBgMix'), swapStart >= 0 ? mix : 0)
      gl.uniform1f(u('uSweep'), sweep)
      if (swapStart < 0) bind(2, decorTex.get(shownDecor)!)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    ;(async () => {
      try {
        const [before, after, car, shadow] = await Promise.all([
          loadImage(`/site-3d/plate-before${sm}.webp`),
          loadImage(`/site-3d/plate-after${sm}.webp`),
          loadImage(`/site-3d/car${sm}.webp`),
          loadImage('/site-3d/shadow.webp'),
        ])
        if (disposed) return
        bind(0, texture(gl, before, owned))
        const afterTex = texture(gl, after, owned)
        bind(1, afterTex)
        bind(4, texture(gl, car, owned))
        bind(5, texture(gl, shadow, owned))
        decorTex.set('garage-neon', afterTex)
        bind(2, afterTex)
        bind(3, afterTex)
        resize()
        raf = requestAnimationFrame(frame)
        onReady?.()
        // The other three decors arrive after the first frame: nothing waits for them.
        for (const slug of DECORS.filter(d => d !== 'garage-neon')) {
          loadImage(decorSrc(slug, sm)).then(img => {
            if (!disposed) {
              decorTex.set(slug, texture(gl, img, owned))
              lastKey = ''
            }
          }).catch(() => {})
        }
      } catch {
        // Images missing or WebGL lost: the still images underneath stay on screen.
      }
    })()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      // Resources freed, the context kept: React (strict mode) remounts on the same canvas, and
      // a context lost on purpose here would come back lost.
      owned.forEach(t => gl.deleteTexture(t))
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    }
  }, [progress, decor, light, onReady])

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
}
