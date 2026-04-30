import { useRef, useEffect } from 'react'

// ── Sprite sheet constants ────────────────────────────────────
const SPRITE_COLS        = 16
const SPRITE_FRAME_W     = 512
const SPRITE_FRAME_H     = 512
const SPRITE_RUN_START   = 0    // frames 0-54   → running (frame001-frame055)
const SPRITE_RUN_COUNT   = 55
const SPRITE_THROW_START = 55   // frames 55-115 → throw   (frame056-frame116)
const SPRITE_THROW_COUNT = 73
const SPRITE_PANT_START       = 128  // frames 116-127 → panting (frame117-frame128)
const SPRITE_PANT_COUNT       = 17
const SPRITE_SWAY_START       = 146  // frames 146-192 → idle sway (alternates with panting)
const SPRITE_SWAY_COUNT       = 47
const SPRITE_SWAY_DELAY_MS    = 1000  // pause at frame 192 before reversing
// Feet in panting/after-crash frames sit higher in the cell than running frames.
// These offsets (source px out of 512) push groundY down to realign feet.
const SPRITE_PANT_FOOT_GAP       = 23   // 511 - 488
const SPRITE_AFTERCRASH_START    = 193
const SPRITE_AFTERCRASH_COUNT    = 8
// Per-frame character heights (px in 512-cell) for frames 193-200.
// Used to lock display height to the running reference (402px avg) via per-frame scale.
const SPRITE_AFTERCRASH_CONTENT_H = [450, 444, 440, 435, 432, 410, 412, 422]
const SPRITE_AFTERCRASH_FOOT_GAP  = 26   // 511 - 485 (avg foot bottom)
const SPRITE_RUN_CONTENT_H        = 402
const SPRITE_DISPLAY_H   = 140  // canvas draw height in px
const SPRITE_GROUND_SINK = 10   // px to push feet below the ground line — increase if floating

function drawSpriteFrame(ctx, img, frameIdx, cx, groundY, displayH = SPRITE_DISPLAY_H) {
  if (!img) return
  const col        = frameIdx % SPRITE_COLS
  const row        = Math.floor(frameIdx / SPRITE_COLS)
  const sx         = col * SPRITE_FRAME_W
  const sy         = row * SPRITE_FRAME_H
  const groundSink = Math.round(SPRITE_GROUND_SINK * displayH / SPRITE_DISPLAY_H)
  const dy         = groundY + groundSink - displayH
  ctx.drawImage(img, sx, sy, SPRITE_FRAME_W, SPRITE_FRAME_H,
    cx - displayH / 2, dy,
    displayH, displayH)
}

const MULTIPLIER_SPEED = 0.00006
const PAD_L = 56
const PAD_B = 48
const PAD_T = 28
const PAD_R = 28
const SCENE_W = 2000

// ── Pre-generated parallax scene elements ─────────────────────
const FAR_TREES = Array.from({ length: 14 }, (_, i) => ({
  x: i * (SCENE_W / 14) + Math.sin(i * 7.3) * 55 + 40,
  h: 26 + Math.abs(Math.sin(i * 3.7)) * 16,
  pine: i % 3 !== 1,
}))
const NEAR_TREES = Array.from({ length: 9 }, (_, i) => ({
  x: i * (SCENE_W / 9) + Math.sin(i * 5.1) * 80 + 100,
  h: 46 + Math.abs(Math.sin(i * 2.9)) * 26,
  pine: i % 2 === 0,
}))
const GRASS_EL = Array.from({ length: 90 }, (_, i) => ({
  x: i * (SCENE_W / 90) + Math.sin(i * 4.1) * 8,
  h: 5 + Math.abs(Math.sin(i * 7.7)) * 4,
  blades: 2 + (i % 3 === 0 ? 1 : 0),
}))

// ── Pre-generated star field ──────────────────────────────────
// speed = ms for one full twinkle cycle  →  formula: sin(now * 2π / speed + phase)
const STARS = Array.from({ length: 90 }, (_, i) => ({
  x:      (Math.sin(i * 37.1) * 0.5 + 0.5),           // deterministic pseudo-random x [0,1]
  y:      (Math.abs(Math.sin(i * 19.7))) * 0.62,       // upper 62% of canvas (sky only)
  r:      0.6  + Math.abs(Math.sin(i * 11.3)) * 1.8,   // radius 0.6–2.4 px
  bright: 0.45 + Math.abs(Math.sin(i *  7.9)) * 0.50,  // peak alpha 0.45–0.95
  phase:  Math.sin(i * 23.5) * Math.PI * 2,            // twinkle phase offset
  speed:  500  + Math.abs(Math.sin(i *  3.1)) * 1500,  // 0.5–2 s per cycle
  glow:   i % 9 === 0,                                  // ~11% get a soft halo
}))

function modWrap(n, m) { return ((n % m) + m) % m }
function drawRepeating(fn, elements, scroll, parallax, w) {
  const off  = modWrap(scroll * parallax, SCENE_W)
  const reps = Math.ceil(w / SCENE_W) + 2
  for (let r = -1; r < reps; r++)
    for (const el of elements) {
      const x = el.x + r * SCENE_W - off
      if (x > -160 && x < w + 60) fn(x, el)
    }
}

// ── Sky gradient ──────────────────────────────────────────────
function drawSky(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0,    '#060d1a')
  g.addColorStop(0.55, '#0b1628')
  g.addColorStop(1,    '#0d1f18')
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
}

// ── Twinkling stars ───────────────────────────────────────────
function drawStars(ctx, w, h, scroll) {
  const now = Date.now()
  const off  = modWrap(scroll * 0.06, SCENE_W)   // very slow parallax — far sky layer
  const reps = Math.ceil(w / SCENE_W) + 2

  for (const s of STARS) {
    const twinkle = 0.5 + 0.5 * Math.sin((now / s.speed) * Math.PI * 2 + s.phase)
    const alpha   = s.bright * (0.05 + 0.95 * twinkle)
    const sy      = s.y * h

    for (let r = -1; r < reps; r++) {
      const sx = s.x * SCENE_W + r * SCENE_W - off
      if (sx < -20 || sx > w + 20) continue

      if (s.glow) {
        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 5)
        grd.addColorStop(0, `rgba(190,215,255,${(alpha * 0.55).toFixed(2)})`)
        grd.addColorStop(1, 'rgba(190,215,255,0)')
        ctx.fillStyle = grd
        ctx.beginPath(); ctx.arc(sx, sy, s.r * 5, 0, Math.PI * 2); ctx.fill()
      }

      ctx.fillStyle = `rgba(215,230,255,${alpha.toFixed(2)})`
      ctx.beginPath(); ctx.arc(sx, sy, s.r, 0, Math.PI * 2); ctx.fill()
    }
  }
}

// ── Rolling hills ─────────────────────────────────────────────
function drawHills(ctx, w, h, scroll) {
  const gY = h - PAD_B
  ctx.fillStyle = '#091422'
  ctx.beginPath(); ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += 3)
    ctx.lineTo(x, gY - 18 - Math.sin((x + scroll * 0.08) * 0.007) * 22 - Math.sin((x + scroll * 0.08) * 0.018) * 10)
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#0b1d17'
  ctx.beginPath(); ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += 3)
    ctx.lineTo(x, gY - 8 - Math.sin((x + scroll * 0.15) * 0.011) * 16 - Math.sin((x + scroll * 0.15) * 0.025) * 7)
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill()
}

// ── Pine tree ─────────────────────────────────────────────────
function drawPine(ctx, x, gY, h) {
  const tw = Math.max(2.5, h * 0.07), th = h * 0.22
  ctx.fillStyle = '#3b1f0d'; ctx.fillRect(x - tw / 2, gY - th, tw, th)
  const colors = ['#0f3320', '#184d2e', '#1f6b3e']
  for (let l = 2; l >= 0; l--) {
    const ly = gY - th - (h * 0.75 * (3 - l) / 3)
    const hw = h * 0.32 * (1 - l * 0.22)
    ctx.fillStyle = colors[l]
    ctx.beginPath(); ctx.moveTo(x, ly - h * 0.1); ctx.lineTo(x + hw, ly + h * 0.04); ctx.lineTo(x - hw, ly + h * 0.04); ctx.closePath(); ctx.fill()
  }
}

// ── Round tree ────────────────────────────────────────────────
function drawRoundTree(ctx, x, gY, h) {
  const tw = Math.max(2.5, h * 0.08), th = h * 0.32, r = h * 0.3
  ctx.fillStyle = '#4a2e10'; ctx.fillRect(x - tw / 2, gY - th, tw, th)
  const cy = gY - th - r * 0.75
  ctx.fillStyle = '#143d1e'; ctx.beginPath(); ctx.arc(x + r * 0.12, cy + r * 0.1, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1f6b3e'; ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#27904f'; ctx.beginPath(); ctx.arc(x - r * 0.2, cy - r * 0.2, r * 0.58, 0, Math.PI * 2); ctx.fill()
}

// ── Ground strip ──────────────────────────────────────────────
function drawGroundStrip(ctx, w, h) {
  const y = h - PAD_B
  const g = ctx.createLinearGradient(0, y, 0, h)
  g.addColorStop(0, '#0f2d1a'); g.addColorStop(1, '#071209')
  ctx.fillStyle = g; ctx.fillRect(0, y, w, h - y)
}

// ── Grass tufts (parallax, from pre-generated elements) ───────
function drawGrassEl(ctx, x, gY, el) {
  ctx.strokeStyle = 'rgba(45,122,69,0.7)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'
  for (let b = 0; b < el.blades; b++) {
    const bx = x + (b - (el.blades - 1) / 2) * 4
    const angle = -0.35 + b * (0.7 / Math.max(el.blades - 1, 1))
    ctx.beginPath(); ctx.moveTo(bx, gY)
    ctx.quadraticCurveTo(bx + Math.sin(angle) * el.h * 0.55, gY - el.h * 0.65, bx + Math.sin(angle) * el.h, gY - el.h)
    ctx.stroke()
  }
}

function toX(elapsed, maxE, w) { return PAD_L + (elapsed / maxE) * (w - PAD_L - PAD_R) }
function toY(m, maxM, h) {
  const logMax = Math.log(Math.max(maxM, 1.01))
  return h - PAD_B - (Math.log(Math.max(m, 1)) / logMax) * (h - PAD_T - PAD_B)
}
function lerp(a, b, t) { return a + (b - a) * t }

// ── Speed lines (radiating from upper-right, drawn over bg) ───
function drawSpeedLines(ctx, w, h, scroll = 0) {
  const vpX = w * 0.82
  const vpY = h * 0.08
  const count = 22
  for (let i = 0; i < count; i++) {
    const spread = Math.PI * 0.75
    const base   = Math.PI + Math.PI * 0.12
    const angle  = base + (i / (count - 1)) * spread
    const dist   = Math.hypot(w, h) * 1.8
    // Animate scroll offset per line slightly
    const shift = ((scroll * 0.002 + i * 0.05) % 1)
    const x1 = vpX + Math.cos(angle) * dist * shift
    const y1 = vpY + Math.sin(angle) * dist * shift
    const x2 = vpX + Math.cos(angle) * dist
    const y2 = vpY + Math.sin(angle) * dist

    const brightness = 0.03 + (i % 4 === 0 ? 0.06 : 0.01)
    ctx.strokeStyle = `rgba(255,255,255,${brightness})`
    ctx.lineWidth   = i % 5 === 0 ? 2 : 1
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  }
}

// ── Full parallax background ──────────────────────────────────
function drawBackground(ctx, w, h, scroll) {
  const gY = h - PAD_B
  drawSky(ctx, w, h)
  drawStars(ctx, w, h, scroll)
  drawHills(ctx, w, h, scroll)
  drawRepeating((x, el) => el.pine ? drawPine(ctx, x, gY, el.h) : drawRoundTree(ctx, x, gY, el.h), FAR_TREES,  scroll, 0.22, w)
  drawRepeating((x, el) => el.pine ? drawPine(ctx, x, gY, el.h) : drawRoundTree(ctx, x, gY, el.h), NEAR_TREES, scroll, 0.5,  w)
  drawGroundStrip(ctx, w, h)
  drawRepeating((x, el) => drawGrassEl(ctx, x, gY, el), GRASS_EL, scroll, 1.0, w)
}

// ── Axes + grid ───────────────────────────────────────────────
function drawAxes(ctx, w, h, maxM) {
  ctx.fillStyle  = 'rgba(200,200,200,0.5)'
  ctx.font       = '11px Inter,sans-serif'
  ctx.textAlign  = 'right'
  for (const s of [0.5, 1, 1.5, 2, 2.5, 3, 5, 10, 20, 50]) {
    if (s > maxM + 0.5) continue
    const y = toY(Math.max(s, 1), maxM, h)
    if (y < PAD_T || y > h - PAD_B + 4) continue
    if (s >= 1) {
      ctx.fillText(s.toFixed(s < 2 ? 1 : 0), PAD_L - 7, y + 4)
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.7
      ctx.setLineDash([3, 6])
      ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(w - PAD_R, y); ctx.stroke()
      ctx.setLineDash([])
    }
  }
  // Y axis line
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD_L, PAD_T); ctx.lineTo(PAD_L, h - PAD_B); ctx.stroke()
}

// ── Ground dashed line + grass ────────────────────────────────
function drawGround(ctx, w, h, scroll) {
  const y = h - PAD_B

  // Dashed ground line (scrolling)
  ctx.strokeStyle = 'rgba(220,180,60,0.6)'; ctx.lineWidth = 1.5
  ctx.setLineDash([8, 6])
  ctx.lineDashOffset = -scroll * 0.8
  ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(w - PAD_R, y); ctx.stroke()
  ctx.setLineDash([]); ctx.lineDashOffset = 0

  // Grass tufts
  const SPACING = 14
  const total   = Math.ceil((w - PAD_L - PAD_R) / SPACING) + 2
  const offset  = scroll % SPACING
  for (let i = 0; i < total; i++) {
    const gx = PAD_L + i * SPACING - offset
    if (gx < PAD_L - 2 || gx > w - PAD_R + 2) continue
    const gh = 4 + Math.sin(i * 3.7 + scroll * 0.01) * 2.5
    ctx.strokeStyle = 'rgba(80,160,80,0.55)'; ctx.lineWidth = 1.1; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx - 2, y - gh); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + 2, y - gh * 0.85); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx,     y - gh * 1.1); ctx.stroke()
  }

}

// ── Dead bare tree (right side) ───────────────────────────────
function drawDeadTree(ctx, x, y) {
  ctx.strokeStyle = 'rgba(160,140,100,0.5)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
  // Trunk
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 36); ctx.stroke()
  // Branches
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x - 14, y - 34); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x + 11, y - 32); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x - 8,  y - 38); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x + 7,  y - 40); ctx.stroke()
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(x - 14, y - 34); ctx.lineTo(x - 20, y - 38); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(x + 11, y - 32); ctx.lineTo(x + 16, y - 36); ctx.stroke()
}

// ════════════════════════════════════════════════════════════

// ── Trajectory curve (yellow arrow) ──────────────────────────
function drawCurve(ctx, w, h, pts, maxM, crashed) {
  if (pts.length < 2) return 1000
  const maxE  = Math.max(pts[pts.length - 1].elapsed, 1000)
  const color = crashed ? '#ef4444' : '#f59e0b'
  const glow  = crashed ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.5)'

  ctx.beginPath()
  ctx.moveTo(toX(pts[0].elapsed, maxE, w), toY(pts[0].multiplier, maxM, h))
  for (const p of pts) ctx.lineTo(toX(p.elapsed, maxE, w), toY(p.multiplier, maxM, h))
  ctx.strokeStyle = color; ctx.lineWidth = crashed ? 2.5 : 3
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  ctx.shadowBlur = 16; ctx.shadowColor = glow
  ctx.stroke(); ctx.shadowBlur = 0

  // Arrow head at tip
  if (!crashed && pts.length > 4) {
    const last  = pts[pts.length - 1]
    const prev  = pts[pts.length - 5]
    const tx    = toX(last.elapsed, maxE, w)
    const ty    = toY(last.multiplier, maxM, h)
    const px    = toX(prev.elapsed, maxE, w)
    const py    = toY(prev.multiplier, maxM, h)
    const angle = Math.atan2(ty - py, tx - px)
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(angle)
    ctx.fillStyle = color; ctx.shadowBlur = 12; ctx.shadowColor = glow
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-4, -6); ctx.lineTo(-2, 0); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill()
    ctx.shadowBlur = 0; ctx.restore()
  }
  return maxE
}

// ── Fireball / rocket at spear tip ───────────────────────────
function drawFireball(ctx, x, y, multiplier) {
  const r = 10 + Math.min(multiplier * 0.5, 8)

  // Outer glow
  const og = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5)
  og.addColorStop(0,   'rgba(245,158,11,0.5)')
  og.addColorStop(0.5, 'rgba(239,68,68,0.2)')
  og.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = og; ctx.beginPath(); ctx.arc(x, y, r * 3.5, 0, Math.PI * 2); ctx.fill()

  // Core (purple/blue like the image)
  const cg = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r)
  cg.addColorStop(0,   '#ffffff')
  cg.addColorStop(0.3, '#c084fc')
  cg.addColorStop(0.7, '#7c3aed')
  cg.addColorStop(1,   '#3730a3')
  ctx.fillStyle = cg; ctx.shadowBlur = 20; ctx.shadowColor = 'rgba(139,92,246,0.9)'
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0

  // Flame trailing left
  const flame = ctx.createLinearGradient(x - r * 3, y, x, y)
  flame.addColorStop(0, 'rgba(0,0,0,0)')
  flame.addColorStop(0.4, 'rgba(245,158,11,0.15)')
  flame.addColorStop(1, 'rgba(245,158,11,0.5)')
  ctx.fillStyle = flame
  ctx.beginPath()
  ctx.ellipse(x - r * 1.5, y, r * 2.5, r * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()
}

// ── Particle system ──────────────────────────────────────────
function emitSparks(particles, x, y, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const v = speed * (0.3 + Math.random() * 0.7)
    const life = 0.25 + Math.random() * 0.55
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.2,
      life, maxLife: life, size: 1.5 + Math.random() * 2.5, gold: Math.random() > 0.3 })
  }
}
// Burst of sparks + low dust from spear-tip impact on ground
function emitGroundImpact(particles, x, y) {
  for (let i = 0; i < 32; i++) {
    const a = Math.PI + (Math.random() - 0.5) * Math.PI * 1.2  // wide upward cone
    const v = 80 + Math.random() * 220
    const life = 0.3 + Math.random() * 0.6
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life, maxLife: life, size: 1.5 + Math.random() * 3.5, gold: Math.random() > 0.4 })
  }
  for (let i = 0; i < 12; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const v = 35 + Math.random() * 70
    const life = 0.45 + Math.random() * 0.4
    particles.push({ x, y, vx: side * v * (0.7 + Math.random() * 0.6),
      vy: -(15 + Math.random() * 35),
      life, maxLife: life, size: 2.5 + Math.random() * 3, gold: false })
  }
}

function updateParticles(particles, dt) {
  const s = dt / 1000
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life -= s; p.x += p.vx * s; p.y += p.vy * s; p.vy += 90 * s
    if (p.life <= 0) particles.splice(i, 1)
  }
}
function drawParticles(ctx, particles) {
  for (const p of particles) {
    const a = Math.pow(p.life / p.maxLife, 1.3)
    if (a < 0.02) continue
    ctx.globalAlpha = a
    ctx.fillStyle   = p.gold ? '#fde68a' : '#ffffff'
    ctx.shadowBlur  = 8; ctx.shadowColor = 'rgba(250,204,21,0.7)'
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * Math.max(a, 0.15), 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur  = 0
  }
  ctx.globalAlpha = 1
}

// ── Explosion system ─────────────────────────────────────────
function spawnExplosion(particles, shockwaves, x, y) {
  emitSparks(particles, x, y, 55, 190)
  emitSparks(particles, x, y, 30, 70)

  shockwaves.push({ x, y, age:  0,    maxAge: 0.55, maxR: 150 })
  shockwaves.push({ x, y, age: -0.12, maxAge: 0.85, maxR: 260 })
}

function updateShockwaves(waves, dt) {
  const s = dt / 1000
  for (let i = waves.length - 1; i >= 0; i--) {
    waves[i].age += s
    if (waves[i].age >= waves[i].maxAge) waves.splice(i, 1)
  }
}

function drawShockwaves(ctx, waves) {
  for (const w of waves) {
    if (w.age < 0) continue
    const t = w.age / w.maxAge
    const r = w.maxR * Math.pow(t, 0.5)
    const a = (1 - t) * 0.9
    ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255,200,60,${a.toFixed(2)})`
    ctx.lineWidth   = (1 - t) * 7 + 1
    ctx.shadowBlur  = 20; ctx.shadowColor = `rgba(255,150,20,${a.toFixed(2)})`
    ctx.stroke()
    ctx.shadowBlur  = 0
  }
}


// ── 4-pointed sparkle star ────────────────────────────────────
function drawSparkle(ctx, x, y, size, alpha, color = '#fde68a', glowColor = 'rgba(250,204,21,0.9)') {
  if (alpha < 0.02) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.shadowBlur  = size * 2.5
  ctx.shadowColor = glowColor
  ctx.fillStyle   = color
  ctx.beginPath()
  const arms = 4, outer = size, inner = size * 0.22
  for (let i = 0; i < arms * 2; i++) {
    const a = (i * Math.PI) / arms - Math.PI / 2
    const r = i % 2 === 0 ? outer : inner
    i === 0 ? ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
            : ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  ctx.closePath(); ctx.fill()
  // Bright centre dot
  ctx.globalAlpha = alpha * 0.9
  ctx.fillStyle   = '#ffffff'
  ctx.shadowBlur  = size
  ctx.beginPath(); ctx.arc(x, y, size * 0.18, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

// ── Spear trail ──────────────────────────────────────────────
function drawTrail(ctx, trail) {
  if (trail.length < 3) return
  const now = Date.now()
  ctx.lineCap = 'round'

  // Wide soft glow pass
  for (let i = 2; i < trail.length; i++) {
    const age = (now - trail[i].t) / 500
    const a   = Math.max(0, 1 - age) * (i / trail.length) * 0.35
    if (a < 0.01) continue
    ctx.strokeStyle = `rgba(250,204,21,${a})`
    ctx.lineWidth   = (i / trail.length) * 10 * (1 - age * 0.7)
    ctx.shadowBlur  = 14; ctx.shadowColor = 'rgba(245,158,11,0.5)'
    ctx.beginPath(); ctx.moveTo(trail[i-1].x, trail[i-1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke()
  }

  // Bright core line
  for (let i = 2; i < trail.length; i++) {
    const age = (now - trail[i].t) / 350
    const a   = Math.max(0, 1 - age) * (i / trail.length) * 0.75
    if (a < 0.01) continue
    ctx.strokeStyle = `rgba(255,240,160,${a})`
    ctx.lineWidth   = (i / trail.length) * 3 * (1 - age)
    ctx.shadowBlur  = 6; ctx.shadowColor = 'rgba(255,220,80,0.6)'
    ctx.beginPath(); ctx.moveTo(trail[i-1].x, trail[i-1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke()
  }

  // Sparkle stars scattered along the trail
  const step = Math.max(1, Math.floor(trail.length / 9))
  for (let i = step; i < trail.length; i += step) {
    const age  = (now - trail[i].t) / 550
    const frac = i / trail.length
    const a    = Math.max(0, 1 - age) * frac
    if (a < 0.04) continue
    const size = 2.5 + frac * 6
    drawSparkle(ctx, trail[i].x, trail[i].y, size, a)
  }

  // Extra-bright sparkle at the newest point (spear tip vicinity)
  if (trail.length > 0) {
    const last = trail[trail.length - 1]
    const age  = (now - last.t) / 400
    drawSparkle(ctx, last.x, last.y, 9, Math.max(0, 1 - age), '#ffffff', 'rgba(255,230,80,1)')
  }

  ctx.shadowBlur = 0
}

// ── Hoop shapes & themes ─────────────────────────────────────
const HOOP_SHAPES = ['ellipse', 'diamond', 'hexagon', 'star']

//  rgb          – base colour  spinDir – dash rotation direction
//  pulseSpeed   – ms per pulse cycle  glowScale – glow intensity multiplier
//  dashLen/gap  – dash pattern  burstColor – ring colour on burst
const HOOP_THEMES = {
  ellipse: { rgb:[251,191, 36], spinDir: 1,  pulseSpeed:340, glowScale:1.0, dashLen:15, gap:7,  burstColor:'#fbbf24' },
  diamond: { rgb:[ 32,211,210], spinDir:-1,  pulseSpeed:210, glowScale:1.4, dashLen: 8, gap:12, burstColor:'#22d3ee' },
  hexagon: { rgb:[192,132,252], spinDir:-1,  pulseSpeed:500, glowScale:0.9, dashLen:18, gap:6,  burstColor:'#c084fc' },
  star:    { rgb:[251, 96, 96], spinDir: 1,  pulseSpeed:180, glowScale:1.7, dashLen:10, gap:5,  burstColor:'#f87171' },
}

// Draw a closed path for the given shape within rx (flight dir) × ry (perpendicular)
function pathHoopShape(ctx, shape, rx, ry) {
  ctx.beginPath()
  switch (shape) {
    case 'ellipse':
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
      break
    case 'diamond':
      ctx.moveTo(0, -ry); ctx.lineTo(rx, 0)
      ctx.lineTo(0,  ry); ctx.lineTo(-rx, 0)
      ctx.closePath()
      break
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2
        const x = Math.cos(a) * rx, y = Math.sin(a) * ry
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
      break
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a    = (i / 10) * Math.PI * 2 - Math.PI / 2
        const outer = i % 2 === 0
        const x = Math.cos(a) * (outer ? rx : rx * 0.45)
        const y = Math.sin(a) * (outer ? ry : ry * 0.45)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
      break
  }
}

// Vertex / tip positions for the decorative diamond nodes
function hoopNodes(shape, rx, ry) {
  switch (shape) {
    case 'ellipse':  return [[0,-ry],[0,ry],[-rx,0],[rx,0]]
    case 'diamond':  return [[0,-ry],[rx,0],[0,ry],[-rx,0]]
    case 'hexagon':
      return Array.from({length:6}, (_, i) => {
        const a = (i/6)*Math.PI*2 - Math.PI/2
        return [Math.cos(a)*rx, Math.sin(a)*ry]
      })
    case 'star':
      return Array.from({length:5}, (_, i) => {
        const a = (i/5)*Math.PI*2 - Math.PI/2
        return [Math.cos(a)*rx, Math.sin(a)*ry]
      })
    default: return [[0,-ry],[0,ry],[-rx,0],[rx,0]]
  }
}

// ── Hoop rings ───────────────────────────────────────────────
// Rings fly in toward the spear one at a time along the flight path.
// Each ring is positioned in prog-space and moves toward the spear at progSpeed/ms.
// hx/hy are pre-computed screen coords stored on the hoop each frame.
function drawHoops(ctx, hoops, flyAngle) {
  const now = Date.now()
  const RX = 11, RY = 44

  for (const hoop of hoops) {
    if (hoop.phase === 'done' || hoop.hx === undefined) continue

    const shape  = hoop.shape || 'ellipse'
    const theme  = HOOP_THEMES[shape] || HOOP_THEMES.ellipse
    const [r, g, b] = theme.rgb

    ctx.save()
    ctx.translate(hoop.hx, hoop.hy)
    ctx.rotate(flyAngle)

    if (hoop.phase === 'approach') {
      const pulse = 0.5 + 0.5 * Math.sin(now / theme.pulseSpeed + hoop.phaseOffset)
      const spin  = now * 0.042 * theme.spinDir
      const gs    = theme.glowScale

      // 1. Wide aura glow
      pathHoopShape(ctx, shape, RX, RY)
      ctx.strokeStyle = `rgba(${r},${g},${b},${(0.15 * pulse * gs).toFixed(2)})`
      ctx.lineWidth   = 20
      ctx.shadowBlur  = 30 * gs
      ctx.shadowColor = `rgba(${r},${g},${b},0.5)`
      ctx.stroke()
      ctx.shadowBlur  = 0

      // 2. Rotating dashed outer ring
      ctx.setLineDash([theme.dashLen, theme.gap])
      ctx.lineDashOffset = spin * 0.28
      pathHoopShape(ctx, shape, RX, RY)
      ctx.strokeStyle = `rgba(${r},${g},${b},${(0.55 * pulse + 0.2).toFixed(2)})`
      ctx.lineWidth   = 2.2
      ctx.shadowBlur  = 14 * gs
      ctx.shadowColor = `rgba(${r},${g},${b},0.85)`
      ctx.stroke()
      ctx.setLineDash([])
      ctx.shadowBlur  = 0

      // 3. Counter-spinning inner ring at 60% — gives depth
      ctx.setLineDash([theme.dashLen * 0.6, theme.gap * 1.5])
      ctx.lineDashOffset = -spin * 0.18
      pathHoopShape(ctx, shape, RX * 0.6, RY * 0.6)
      ctx.strokeStyle = `rgba(${r},${g},${b},${(0.5 * pulse).toFixed(2)})`
      ctx.lineWidth   = 1.4
      ctx.shadowBlur  = 8
      ctx.shadowColor = `rgba(${r},${g},${b},0.6)`
      ctx.stroke()
      ctx.setLineDash([])
      ctx.shadowBlur  = 0

      // 4. Spinning diamond nodes at vertex positions of this shape
      for (const [nx, ny] of hoopNodes(shape, RX, RY)) {
        const s = 3.0 + 1.8 * pulse
        ctx.save()
        ctx.translate(nx, ny)
        ctx.rotate(spin * 0.9)
        ctx.fillStyle  = `rgba(${r},${g},${b},${(0.95 * pulse).toFixed(2)})`
        ctx.shadowBlur = 10 * gs
        ctx.shadowColor = `rgba(${r},${g},${b},0.9)`
        ctx.beginPath()
        ctx.moveTo(0,-s); ctx.lineTo(s*0.45,0); ctx.lineTo(0,s); ctx.lineTo(-s*0.45,0)
        ctx.closePath(); ctx.fill()
        ctx.shadowBlur = 0
        ctx.restore()
      }

    } else if (hoop.phase === 'burst') {
      const t     = hoop.burstAge / 480
      const eased = 1 - Math.pow(1 - t, 2)
      const scale = 1 + eased * 2.2
      const alpha = Math.pow(Math.max(0, 1 - t), 1.2)

      ctx.globalAlpha = alpha

      // Brief centre fill flash in theme colour
      if (t < 0.18) {
        ctx.fillStyle = `rgba(${r},${g},${b},${((1 - t / 0.18) * 0.28).toFixed(2)})`
        pathHoopShape(ctx, shape, RX, RY)
        ctx.fill()
      }

      // Expanding outer ring: white flash → theme colour
      pathHoopShape(ctx, shape, RX * scale, RY * scale)
      ctx.strokeStyle = t < 0.18 ? '#ffffff' : theme.burstColor
      ctx.lineWidth   = Math.max(1, 5 * (1 - t * 0.78))
      ctx.shadowBlur  = 28; ctx.shadowColor = `rgba(${r},${g},${b},0.95)`
      ctx.stroke()
      ctx.shadowBlur  = 0

      // Expanding inner ring at slower rate
      const is = 1 + eased * 1.4
      pathHoopShape(ctx, shape, RX * 0.6 * is, RY * 0.6 * is)
      ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.55).toFixed(2)})`
      ctx.lineWidth   = Math.max(0.8, 2 * (1 - t))
      ctx.stroke()

      ctx.globalAlpha = 1
    }

    ctx.restore()
  }
}

// ════════════════════════════════════════════════════════════
// FIGURE DRAWING — 3 distinct poses matching the screenshots
// ════════════════════════════════════════════════════════════

// Scale/size constants
const FIG_HEAD_R = 7    // realistic head — ~1/6 of total body height, proportional to shoulders

// Throw animation timing
const THROW_DURATION      = 650   // ms — full wind-up → follow-through
const THROW_SPEAR_RELEASE = 0.50  // fraction at which spear leaves hand
const THROW_WINDUP_P      = 0.28  // plant + coil phase ends
const THROW_RELEASE_P     = 0.56  // explosive release phase ends
const THROW_LAND_P        = 0.90  // athlete returns to ground
const THROW_JUMP_H        = 34    // peak jump height in px

// Returns how many px the throwing figure is above ground at phase p
function throwJumpY(p) {
  if (p < THROW_WINDUP_P || p >= THROW_LAND_P) return 0
  const jt = (p - THROW_WINDUP_P) / (THROW_LAND_P - THROW_WINDUP_P)
  return Math.sin(Math.PI * jt) * THROW_JUMP_H
}

function easeOut3(t) { return 1 - Math.pow(1 - t, 3) }
function easeIn2(t)  { return t * t }
const FIG_TORSO  = 22   // athletic torso
const FIG_LEG    = 30   // full leg proportion
const FIG_ARM    = 13
const FIG_SCALE  = 1.3  // uniform character scale — makes figure larger on screen

// Flat vector athlete palette — skin/hair are fixed; clothing rotates per round
const C_SKIN    = '#D4793A'
const C_SKIN_H  = '#E8945A'
const C_HAIR    = '#1A0800'
const C_OUTLINE = '#0D0D0D'

let C_SHIRT   = '#1A56A8'
let C_SHIRT_H = '#2E7FD4'
let C_PANTS   = '#0C0C22'
let C_PANTS_H = '#18183A'
let C_SHOE    = '#B0B0B0'

const COSTUMES = [
  { shirt: '#1A56A8', shirtH: '#2E7FD4', pants: '#0C0C22', pantsH: '#18183A', shoe: '#B0B0B0' }, // royal blue
  { shirt: '#B91C1C', shirtH: '#EF4444', pants: '#1A0C0C', pantsH: '#2D1616', shoe: '#C8C8C8' }, // red
  { shirt: '#166534', shirtH: '#22C55E', pants: '#0A1A0C', pantsH: '#142018', shoe: '#AAAAAA' }, // forest green
  { shirt: '#6D28D9', shirtH: '#9333EA', pants: '#12081C', pantsH: '#1E1030', shoe: '#C0B8CC' }, // purple
  { shirt: '#B45309', shirtH: '#F59E0B', pants: '#1A1208', pantsH: '#2A1E10', shoe: '#C8C0A8' }, // gold/amber
]

function applyCostume(idx) {
  const c = COSTUMES[idx % COSTUMES.length]
  C_SHIRT = c.shirt; C_SHIRT_H = c.shirtH
  C_PANTS = c.pants; C_PANTS_H = c.pantsH
  C_SHOE  = c.shoe
}

// Flat vector featureless head — smooth silhouette, no facial features, matches reference illustration
function figHead(ctx, cx, cy) {
  const R = FIG_HEAD_R

  // ── Shoulder yoke — trapezius muscles sloping from neck to shoulders ──
  const yokeTopY = cy + R + 1         // = neckY
  const yokeBotY = cy + R + 9         // extends past shoulderY for fuller trapezius depth
  const ykNkHW   = R * 0.52           // half-width at top — snug against neck base
  const ykShHW   = R * 1.04           // half-width at bottom — matches jersey shoulder width (7.2px)

  function yokePath() {
    ctx.beginPath()
    ctx.moveTo(cx - ykNkHW, yokeTopY)
    // Control point pulled outward past final width — creates natural outward-flaring trapezius curve
    ctx.quadraticCurveTo(cx - ykShHW * 1.10, yokeTopY + (yokeBotY - yokeTopY) * 0.55, cx - ykShHW, yokeBotY)
    ctx.lineTo(cx + ykShHW, yokeBotY)
    ctx.quadraticCurveTo(cx + ykShHW * 1.10, yokeTopY + (yokeBotY - yokeTopY) * 0.55, cx + ykNkHW, yokeTopY)
    ctx.closePath()
  }

  // Shirt fabric covers the full shoulder yoke area — short-sleeved shirt
  ctx.fillStyle = C_SHIRT; yokePath(); ctx.fill()
  ctx.save()
  yokePath(); ctx.clip()
  const ykG = ctx.createLinearGradient(cx - ykShHW, yokeTopY, cx + ykShHW, yokeTopY)
  ykG.addColorStop(0,    'rgba(0,0,0,0.36)')
  ykG.addColorStop(0.42, 'rgba(0,0,0,0.10)')
  ykG.addColorStop(1,    'rgba(0,0,0,0)')
  ctx.fillStyle = ykG; ctx.fillRect(cx - ykShHW, yokeTopY - 1, ykShHW * 2, (yokeBotY - yokeTopY) + 2)
  ctx.restore()

  // Side-profile head — jaw projects forward (+x), flat back of skull, rounded crown
  function headPath(inf) {
    const i = inf
    ctx.beginPath()
    // Crown — back-left of head
    ctx.moveTo(cx - R * 0.55,      cy - R * 0.92 - i)
    // Sweep over top of skull to forehead
    ctx.bezierCurveTo(
      cx - R * 0.10 + i,  cy - R * 1.18 - i,
      cx + R * 0.55 + i,  cy - R * 1.10 - i,
      cx + R * 0.88 + i,  cy - R * 0.60)
    // Down the face — forehead to nose bridge area
    ctx.bezierCurveTo(
      cx + R * 1.05 + i,  cy - R * 0.20,
      cx + R * 1.10 + i,  cy + R * 0.10,
      cx + R * 1.05 + i,  cy + R * 0.38)
    // Chin — projects forward
    ctx.bezierCurveTo(
      cx + R * 0.98 + i,  cy + R * 0.62,
      cx + R * 0.82 + i,  cy + R * 0.88,
      cx + R * 0.55 + i,  cy + R * 1.05 + i)
    // Jaw back to neck
    ctx.bezierCurveTo(
      cx + R * 0.20,      cy + R * 1.14 + i,
      cx - R * 0.10,      cy + R * 1.10 + i,
      cx - R * 0.30,      cy + R * 0.82 + i)
    // Back of neck / skull — flat
    ctx.bezierCurveTo(
      cx - R * 0.62,      cy + R * 0.50,
      cx - R * 0.72,      cy + R * 0.10,
      cx - R * 0.70,      cy - R * 0.30)
    // Up the back of skull
    ctx.bezierCurveTo(
      cx - R * 0.68,      cy - R * 0.60,
      cx - R * 0.62,      cy - R * 0.80,
      cx - R * 0.55,      cy - R * 0.92 - i)
    ctx.closePath()
  }

  // 4. Neck — drawn BEFORE head skin fill so the head covers the seam.
  //    Top corners match headPath jaw/chin bezier anchors exactly → zero gap.
  const nB = cy + R * 1.96
  ctx.fillStyle = C_SKIN
  ctx.beginPath()
  ctx.moveTo(cx - R * 0.30, cy + R * 0.82)   // jaw-back anchor (matches headPath)
  ctx.lineTo(cx - R * 0.57, nB)
  ctx.lineTo(cx + R * 0.51, nB)
  ctx.lineTo(cx + R * 0.55, cy + R * 1.05)   // chin anchor (matches headPath)
  ctx.closePath(); ctx.fill()
  const nkG = ctx.createLinearGradient(cx - R * 0.57, cy + R * 0.82, cx + R * 0.51, cy + R * 0.82)
  nkG.addColorStop(0,   'rgba(0,0,0,0.28)'); nkG.addColorStop(0.55, 'rgba(0,0,0,0)')
  ctx.fillStyle = nkG
  ctx.beginPath()
  ctx.moveTo(cx - R * 0.30, cy + R * 0.82)
  ctx.lineTo(cx - R * 0.57, nB)
  ctx.lineTo(cx + R * 0.51, nB)
  ctx.lineTo(cx + R * 0.55, cy + R * 1.05)
  ctx.closePath(); ctx.fill()

  // ── Shirt collar — round crew neckline visible at base of neck ──
  // Drawn AFTER neck skin: collar covers the lower neck area (shirt wraps neck)
  // and extends wider than the neck so the ring is visible on both sides.
  {
    const collarCY = nB - 0.5            // collar center sits just above neck base
    const collarRX = R * 0.90            // ≈6.3 px — wider than neck (~4 px) to show ring
    const collarRY = R * 0.28            // ≈2.0 px — side-profile height of collar band
    ctx.fillStyle = C_SHIRT
    ctx.beginPath(); ctx.ellipse(cx, collarCY, collarRX, collarRY, 0, 0, Math.PI * 2); ctx.fill()
    ctx.save()
    ctx.beginPath(); ctx.ellipse(cx, collarCY, collarRX, collarRY, 0, 0, Math.PI * 2); ctx.clip()
    // Top-to-bottom shadow: upper rim darker, gives collar its 3-D round feel
    const cTopG = ctx.createLinearGradient(cx, collarCY - collarRY, cx, collarCY + collarRY)
    cTopG.addColorStop(0,    'rgba(0,0,0,0.42)')
    cTopG.addColorStop(0.45, 'rgba(0,0,0,0.08)')
    cTopG.addColorStop(1,    'rgba(0,0,0,0)')
    ctx.fillStyle = cTopG
    ctx.fillRect(cx - collarRX - 1, collarCY - collarRY - 1, (collarRX + 1) * 2, (collarRY + 1) * 2)
    // Back-side shadow (left = back of athlete = viewer's side)
    const cBkG = ctx.createLinearGradient(cx - collarRX, collarCY, cx + collarRX * 0.3, collarCY)
    cBkG.addColorStop(0,   'rgba(0,0,0,0.26)')
    cBkG.addColorStop(1,   'rgba(0,0,0,0)')
    ctx.fillStyle = cBkG
    ctx.fillRect(cx - collarRX - 1, collarCY - collarRY - 1, (collarRX + 1) * 2, (collarRY + 1) * 2)
    ctx.restore()
  }

  // 1. Head skin fill — drawn on top of neck, covering the seam for a seamless join
  ctx.fillStyle = C_SKIN
  headPath(0); ctx.fill()

  // 2. Flat shadow on back/shadow side of face
  const shadG = ctx.createLinearGradient(cx - R * 0.70, cy, cx + R * 0.50, cy)
  shadG.addColorStop(0,   'rgba(0,0,0,0.40)')
  shadG.addColorStop(0.45,'rgba(0,0,0,0.12)')
  shadG.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = shadG; headPath(0); ctx.fill()

  // 3. Short dark hair — covers crown and back of skull, clipped to head shape
  ctx.save()
  headPath(0); ctx.clip()
  ctx.fillStyle = C_HAIR
  ctx.beginPath()
  ctx.moveTo(cx - R * 0.70,  cy - R * 0.30)
  ctx.bezierCurveTo(cx - R * 0.68, cy - R * 0.60, cx - R * 0.55, cy - R * 0.92, cx - R * 0.10, cy - R * 1.18)
  ctx.bezierCurveTo(cx + R * 0.40, cy - R * 1.14, cx + R * 0.88, cy - R * 0.92, cx + R * 0.88, cy - R * 0.60)
  ctx.bezierCurveTo(cx + R * 0.70, cy - R * 0.30, cx + R * 0.46, cy - R * 0.18, cx + R * 0.20, cy - R * 0.22)
  ctx.bezierCurveTo(cx - R * 0.10, cy - R * 0.26, cx - R * 0.40, cy - R * 0.10, cx - R * 0.70, cy - R * 0.30)
  ctx.closePath(); ctx.fill()
  ctx.restore()
}

// Flat vector fist — skin-colored, no outline
function figHand(ctx, ex, ey, hx, hy, alpha = 1) {
  const angle = Math.atan2(hy - ey, hx - ex)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(hx, hy)
  ctx.rotate(angle)
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath(); ctx.ellipse(0.6, 0.8, 3.2, 2.0, 0, 0, Math.PI * 2); ctx.fill()
  // Skin base
  ctx.fillStyle = C_SKIN
  ctx.beginPath(); ctx.ellipse(0, 0, 3.0, 1.9, 0, 0, Math.PI * 2); ctx.fill()
  // Flat shadow on knuckle side
  ctx.fillStyle = 'rgba(0,0,0,0.20)'
  ctx.beginPath(); ctx.ellipse(0.4, 0.6, 2.2, 1.2, 0, 0, Math.PI * 2); ctx.fill()
  // Thumb
  ctx.fillStyle = C_SKIN
  ctx.beginPath(); ctx.ellipse(-2.2, -0.9, 1.4, 0.9, -0.5, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

// Flat vector athletic shoe — rotates to follow foot orientation.
// angle=0: shoe points forward (right). Pass shin angle when foot is in the air.
function figShoe(ctx, fx, fy, angle = 0) {
  ctx.save()
  ctx.translate(fx, fy)
  ctx.rotate(angle)
  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath(); ctx.ellipse(2, 3.5, 8, 2.6, 0, 0, Math.PI * 2); ctx.fill()
  // Sock visible above the shoe collar
  ctx.fillStyle = '#D8D8D8'
  ctx.beginPath(); ctx.ellipse(-0.5, -2.5, 3.5, 3.0, 0, 0, Math.PI * 2); ctx.fill()
  // Rubber sole
  ctx.fillStyle = '#C4C4C4'
  ctx.beginPath(); ctx.ellipse(2, 1.4, 8.5, 2.4, 0, 0, Math.PI * 2); ctx.fill()
  // Shoe upper
  ctx.fillStyle = C_SHOE
  ctx.beginPath(); ctx.ellipse(2, -0.4, 7.8, 2.1, 0, 0, Math.PI * 2); ctx.fill()
  // Shadow on heel side
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath(); ctx.ellipse(4, 0, 4.0, 1.5, 0, 0, Math.PI * 2); ctx.fill()
  // Small white toe highlight
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.beginPath(); ctx.ellipse(6, -1.0, 2.2, 0.8, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

// Rounded deltoid cap — drawn at the shoulder joint to bridge jersey edge → upper arm.
// Shirt-coloured ellipse with directional shadow on the body-facing side.
function figDeltoid(ctx, sx, sy, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  const rX = 3.6, rY = 2.8   // shoulder cap bridging jersey seam to upper arm
  ctx.fillStyle = C_SHIRT
  ctx.beginPath(); ctx.ellipse(sx, sy, rX, rY, 0, 0, Math.PI * 2); ctx.fill()
  // Shadow on the inward/body-facing side (left of the cap)
  const shG = ctx.createLinearGradient(sx - rX, sy, sx + rX * 0.6, sy)
  shG.addColorStop(0,    'rgba(0,0,0,0.34)')
  shG.addColorStop(0.40, 'rgba(0,0,0,0.10)')
  shG.addColorStop(1,    'rgba(0,0,0,0)')
  ctx.fillStyle = shG
  ctx.beginPath(); ctx.ellipse(sx, sy, rX, rY, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

// Rounded elbow cap — bulks up the thin upper-arm terminus at the joint.
// Inherits ctx.globalAlpha so dimmed arms stay consistently dimmed.
function figElbow(ctx, ex, ey) {
  ctx.save()
  const r = 2.6
  ctx.fillStyle = C_SKIN
  ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill()
  const shG = ctx.createLinearGradient(ex - r, ey, ex + r * 0.6, ey)
  shG.addColorStop(0,    'rgba(0,0,0,0.30)')
  shG.addColorStop(0.42, 'rgba(0,0,0,0.08)')
  shG.addColorStop(1,    'rgba(0,0,0,0)')
  ctx.fillStyle = shG
  ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

// Flat vector muscle limb — clean filled shape with warm shadow overlay.
// No outlines — matches the reference illustration style.
function drawLimb(ctx, x1, y1, x2, y2, w, col, hlCol, bulgeFactor = 1.0, e1 = 0.26, e2 = 0.26) {
  const dx = x2 - x1, dy = y2 - y1
  const d  = Math.hypot(dx, dy) || 1
  const nx = -dy / d, ny = dx / d   // perpendicular unit — lit (upper-left) side

  const we1     = w * e1
  const we2     = w * e2
  const wBelly  = w * 0.58 * bulgeFactor
  const wBellyR = wBelly * 0.78
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2

  function musclePath(extra) {
    const b1 = we1 + extra, b2 = we2 + extra
    const bL = wBelly + extra, bR = wBellyR + extra
    ctx.beginPath()
    ctx.moveTo(x1 + nx * b1, y1 + ny * b1)
    ctx.quadraticCurveTo(cx + nx * bL, cy + ny * bL, x2 + nx * b2, y2 + ny * b2)
    ctx.lineTo(x2 - nx * b2, y2 - ny * b2)
    ctx.quadraticCurveTo(cx - nx * bR, cy - ny * bR, x1 - nx * b1, y1 - ny * b1)
    ctx.closePath()
  }

  // 1. Base fill
  ctx.fillStyle = col
  musclePath(0); ctx.fill()

  // 2. Flat shadow overlay on dark/shadow side — clipped to limb shape
  ctx.save()
  musclePath(0); ctx.clip()
  ctx.fillStyle = 'rgba(0,0,0,0.42)'
  // Fill shadow side: a large rect offset in the -nx (shadow) direction
  const perpLen = d + w * 2
  const bx = -ny * perpLen, by = nx * perpLen   // along-limb direction scaled
  ctx.beginPath()
  ctx.moveTo(x1,                        y1)
  ctx.lineTo(x1 - nx * w * 2,           y1 - ny * w * 2)
  ctx.lineTo(x1 - nx * w * 2 + bx,     y1 - ny * w * 2 + by)
  ctx.lineTo(x1 + bx,                   y1 + by)
  ctx.closePath(); ctx.fill()
  ctx.restore()
}

// Athletic torso with V-taper silhouette + muscle definition overlaid on jersey.
// hipY < shoulderY in canvas coords (hipY is less-negative = lower on screen).
function drawTorso(ctx, hipY, shoulderY, wScale = 1.0) {
  const torsoH = hipY - shoulderY   // positive: distance from shoulder to hip
  const sHW  = 6.2 * wScale   // shoulder half-width
  const cHW  = 5.6 * wScale   // chest bezier control-point half-width
  const wHW  = 3.8 * wScale   // waist half-width  — clear V-taper
  const hHW  = 5.2 * wScale   // hip half-width    — slight flare blends into leg join
  const waistY = shoulderY + torsoH * 0.60
  const pecY   = shoulderY + torsoH * 0.26

  // ── Singlet silhouette — viewed from the back-side ──
  // -x = back of athlete (what the viewer sees).
  // The visible back strap slopes inward: wide at the shoulder seam, narrows
  // toward the back neckline — the signature look of an athletic singlet.
  // +x = front chest (away from viewer), sits flat at shoulderY.
  const nkY   = shoulderY - 6    // back neckline height (= neckY in figLayout)
  const bStHW = sHW * 0.54       // ≈ 3.3 px — back strap half-width at neckline
  function jerseyPath() {
    ctx.beginPath()
    // Back strap top — narrow at neckline level (visible side)
    ctx.moveTo(-bStHW, nkY)
    // Slope outward to full shoulder width
    ctx.lineTo(-sHW, shoulderY)
    // Back side: shoulder → waist → hip
    ctx.quadraticCurveTo(-cHW, shoulderY + torsoH * 0.35, -wHW, waistY)
    ctx.quadraticCurveTo(-hHW * 1.06, hipY - 1, -hHW, hipY)
    ctx.lineTo(hHW, hipY)
    // Front side: hip → waist → front shoulder (flat at shoulderY)
    ctx.quadraticCurveTo(hHW * 1.06, hipY - 1, wHW, waistY)
    ctx.quadraticCurveTo(cHW, shoulderY + torsoH * 0.35, sHW, shoulderY)
    // Neckline: front shoulder → gentle curve → back strap top
    ctx.quadraticCurveTo(sHW * 0.2, shoulderY - 2, -bStHW, nkY)
    ctx.closePath()
  }

  // 1. Base jersey fill
  ctx.fillStyle = C_SHIRT
  jerseyPath(); ctx.fill()

  ctx.save()
  jerseyPath(); ctx.clip()

  // 2. Side shadow — left = back/shadow side, fades toward front
  const shadG = ctx.createLinearGradient(-sHW, 0, sHW * 0.38, 0)
  shadG.addColorStop(0,    'rgba(0,0,0,0.42)')
  shadG.addColorStop(0.38, 'rgba(0,0,0,0.10)')
  shadG.addColorStop(1,    'rgba(0,0,0,0)')
  ctx.fillStyle = shadG
  ctx.fillRect(-sHW, nkY - 1, sHW * 2, torsoH + (shoulderY - nkY) + 2)

  ctx.lineCap = 'round'

  // 3. Pectoral line — lower edge of chest muscle visible through jersey
  ctx.strokeStyle = 'rgba(0,0,0,0.17)'
  ctx.lineWidth = 1.0
  ctx.beginPath()
  ctx.moveTo(-cHW * 0.68, pecY - 1)
  ctx.quadraticCurveTo(0, pecY + 2.5, cHW * 0.68, pecY - 1)
  ctx.stroke()

  // 4. Sternum — center groove from pec line down to waist
  ctx.strokeStyle = 'rgba(0,0,0,0.11)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(0, pecY + 1); ctx.lineTo(0, waistY - 1)
  ctx.stroke()

  // 5. Abdominal bands — two horizontal arcs for rectus abdominis segments
  ctx.strokeStyle = 'rgba(0,0,0,0.13)'
  ctx.lineWidth = 0.9
  for (const ay of [shoulderY + torsoH * 0.46, shoulderY + torsoH * 0.62]) {
    const hw = wHW * 0.80
    ctx.beginPath()
    ctx.moveTo(-hw, ay); ctx.quadraticCurveTo(0, ay + 1.0, hw, ay)
    ctx.stroke()
  }

  // 6. Oblique shadow — angled darker region on the shadow/back side lower torso
  ctx.fillStyle = 'rgba(0,0,0,0.10)'
  ctx.beginPath()
  ctx.moveTo(-wHW, waistY)
  ctx.lineTo(-cHW * 0.70, pecY + 2)
  ctx.lineTo(0, pecY + 4)
  ctx.lineTo(0, waistY)
  ctx.closePath(); ctx.fill()

  ctx.restore()
}

// Bottom-up figure layout (feet at y=0, ground level)
function figLayout(t = 0, bob = 0) {
  const hipY      = -(FIG_LEG + bob)
  const neckY     = hipY - FIG_TORSO
  const headCY    = neckY - FIG_HEAD_R - 1
  const shoulderY = neckY + 6   // 6px below neckY — room for trapezius yoke
  return { hipY, neckY, headCY, shoulderY }
}

// Returns hand positions for the javelin approach stance
function figureWaitingHands(t) {
  const bob = Math.sin(t * 0.008) * 1.2
  const { shoulderY } = figLayout(t, bob)
  // Throwing hand (right): extended forward at shoulder level
  const rhX = 20,  rhY = shoulderY - 3
  // Balance hand (left): swept back and down
  const lhX = -14, lhY = shoulderY + 18
  return { lhX, lhY, rhX, rhY }
}

function drawFigureWaiting(ctx, x, y, t) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(FIG_SCALE, FIG_SCALE)
  ctx.rotate(0.12)   // forward lean like an athlete about to throw
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'

  const bob = Math.sin(t * 0.008) * 1.2
  const { hipY, neckY, headCY, shoulderY } = figLayout(t, bob)
  const { lhX, lhY, rhX, rhY } = figureWaitingHands(t)

  // Back leg (behind body)
  drawLimb(ctx, 0, hipY, -7, hipY * 0.48, 14, C_PANTS, C_PANTS_H, 1.6, 0.44, 0.28)
  drawLimb(ctx, -7, hipY * 0.48, -13, 0,  9, C_SKIN,  C_SKIN_H,  1.2, 0.34, 0.12)
  figShoe(ctx, -13, 0)

  // Balance arm (left, behind body) — short sleeve then bare skin
  // Elbow swept back (-14) so arm reads as trailing behind torso, not hanging straight down
  const lElbX = -14, lElbY = shoulderY + 7
  figDeltoid(ctx, -8, shoulderY, 0.6)
  ctx.globalAlpha = 0.6
  drawLimb(ctx, -8, shoulderY, -11, shoulderY+3.5, 7, C_SHIRT, C_SHIRT_H, 1.2, 0.38, 0.36)
  drawLimb(ctx, -11, shoulderY+3.5, lElbX, lElbY, 7, C_SKIN, C_SKIN_H, 1.2, 0.36, 0.32)
  figElbow(ctx, lElbX, lElbY)
  drawLimb(ctx, lElbX, lElbY, lhX, lhY,    6, C_SKIN, C_SKIN_H, 0.80, 0.42, 0.14)
  figHand(ctx, lElbX, lElbY, lhX, lhY, 0.6)
  ctx.globalAlpha = 1

  // Body — red jersey
  drawTorso(ctx, hipY, shoulderY)

  // Front leg
  drawLimb(ctx, 0, hipY,  7, hipY * 0.48, 14, C_PANTS, C_PANTS_H, 1.6, 0.44, 0.28)
  drawLimb(ctx,  7, hipY * 0.48, 14, 0,   9, C_SKIN,  C_SKIN_H,  1.2, 0.34, 0.12)
  figShoe(ctx,  14, 0)

  // Throwing arm (right, in front) — short sleeve then bare skin
  const rElbX = 14, rElbY = shoulderY + 5
  figDeltoid(ctx, 5, shoulderY)
  drawLimb(ctx, 5, shoulderY, 9.5, shoulderY+2.5, 7, C_SHIRT, C_SHIRT_H, 1.2, 0.38, 0.36)
  drawLimb(ctx, 9.5, shoulderY+2.5, rElbX, rElbY, 7, C_SKIN, C_SKIN_H, 1.2, 0.36, 0.32)
  figElbow(ctx, rElbX, rElbY)
  drawLimb(ctx, rElbX, rElbY, rhX, rhY,    6, C_SKIN, C_SKIN_H, 0.80, 0.42, 0.14)
  figHand(ctx, rElbX, rElbY, rhX, rhY)

  // Spear — held in right hand, pointing forward at slight upward angle
  const sa = -0.25   // ~14° upward
  const sx1 = rhX - Math.cos(sa) * 34   // tail behind hand
  const sy1 = rhY - Math.sin(sa) * 34
  const sx2 = rhX + Math.cos(sa) * 66   // tip ahead of hand
  const sy2 = rhY + Math.sin(sa) * 66
  drawSpearShape(ctx, sx1, sy1, sx2, sy2, false)

  // Head (drawn last so it's on top)
  figHead(ctx, 0, headCY)

  ctx.restore()
}

function drawFigureRunning(ctx, x, y, legPhase, holdSpear = false, lean = 0.18) {
  ctx.save(); ctx.translate(x, y)
  ctx.scale(FIG_SCALE, FIG_SCALE)
  ctx.rotate(lean)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'

  const s = Math.sin(legPhase)   // right leg cycle: +1=forward/contact, -1=recovery/kick

  // Hip bobs slightly — down on contact, up during flight
  const hipBob = (1 - Math.abs(s)) * 1.5
  const { hipY, neckY, headCY, shoulderY } = figLayout(0, hipBob)

  // ── Motion blur: bold speed streaks ──
  ctx.save(); ctx.lineCap = 'round'
  const streaks = [
    { y: hipY * 0.20, len: 48, w: 2.2, a: 0.55 },
    { y: hipY * 0.35, len: 62, w: 1.8, a: 0.45 },
    { y: hipY * 0.50, len: 38, w: 2.8, a: 0.60 },
    { y: hipY * 0.65, len: 55, w: 1.6, a: 0.40 },
    { y: hipY * 0.78, len: 30, w: 2.0, a: 0.50 },
    { y: hipY * 0.12, len: 20, w: 1.2, a: 0.30 },
    { y: hipY * 0.90, len: 42, w: 1.4, a: 0.35 },
  ]
  for (const sk of streaks) {
    const grd = ctx.createLinearGradient(-18, 0, -18 - sk.len, 0)
    grd.addColorStop(0,   `rgba(255,255,255,${sk.a})`)
    grd.addColorStop(1,   'rgba(255,255,255,0)')
    ctx.strokeStyle = grd; ctx.lineWidth = sk.w
    ctx.beginPath(); ctx.moveTo(-18, sk.y); ctx.lineTo(-18 - sk.len, sk.y); ctx.stroke()
  }
  ctx.restore()

  // ── RIGHT LEG — s>0: striding forward, s<0: recovery (heel kicking up behind) ──
  const rRecover = Math.max(0, -s)   // 0→1 as leg enters recovery

  // Knee swings from behind-body to in-front; rises during recovery (thigh drives up)
  const rKneeX = lerp(-12, 14, (s + 1) / 2)
  const rKneeY = hipY * 0.55 - rRecover * 10

  // Foot expressed relative to knee — guarantees correct bend direction at all phases:
  //   recovery (s<0): foot trails BEHIND knee (shin folds back, heel toward butt)
  //   contact  (s>0): foot extends IN FRONT of knee (natural heel-strike / toe-off)
  const rFootX = rKneeX + lerp(-9, 10, (s + 1) / 2)
  const rFootY = -rRecover * 30   // heel tucks above knee height on recovery

  // ── LEFT LEG — opposite phase ──
  const ls = -s
  const lRecover = Math.max(0, -ls)

  const lKneeX = lerp(12, -14, (s + 1) / 2)
  const lKneeY = hipY * 0.55 - lRecover * 10

  const lFootX = lKneeX + lerp(9, -10, (s + 1) / 2)
  const lFootY = -lRecover * 30

  // ── ARM POSITIONS — tight athletic pump: elbow always below shoulder ──
  // Near arm (bright, drawn in front of torso) uses rT — full swing every cycle
  // Far arm  (dim,   drawn behind torso)      uses lT — opposite phase, full swing
  const rT = (-s + 1) / 2, lT = (s + 1) / 2

  // Elbow arcs are centered on each shoulder (near=+8, far=-8) so upper-arm
  // length stays ~12 px throughout the swing (back≈155°, forward≈25° from horiz).
  const nearElbX = lerp( -3, 19, rT), nearElbY = shoulderY + 5
  const nearHndX = lerp( -9, 14, rT), nearHndY = shoulderY + lerp(16, -7, rT)
  const farElbX  = lerp(-19,  3, lT), farElbY  = shoulderY + 5
  const farHndX  = lerp(-14, -2, lT), farHndY  = shoulderY + lerp(16, -7, lT)

  // ── Draw order: far arm → back leg → torso → front leg → near arm → head ──

  // Far arm — short sleeve then bare skin
  figDeltoid(ctx, -8, shoulderY, 0.6)
  const fSlvX = (-8 + farElbX) * 0.5, fSlvY = (shoulderY + farElbY) * 0.5
  drawLimb(ctx, -8, shoulderY, fSlvX, fSlvY, 7, C_SHIRT, C_SHIRT_H, 1.2, 0.38, 0.36)
  drawLimb(ctx, fSlvX, fSlvY, farElbX, farElbY, 7, C_SKIN, C_SKIN_H, 1.2, 0.36, 0.32)
  figElbow(ctx, farElbX, farElbY)
  drawLimb(ctx, farElbX, farElbY, farHndX, farHndY, 6, C_SKIN, C_SKIN_H, 0.80, 0.42, 0.14)
  figHand(ctx, farElbX, farElbY, farHndX, farHndY)

  // Back leg — thick thigh, tapering shin
  drawLimb(ctx, 0, hipY, lKneeX, lKneeY,       14, C_PANTS, C_PANTS_H, 1.6, 0.44, 0.28)
  drawLimb(ctx, lKneeX, lKneeY, lFootX, lFootY,  9, C_SKIN, C_SKIN_H, 1.2, 0.34, 0.12)
  figShoe(ctx, lFootX, lFootY,
    Math.atan2(lFootY - lKneeY, lFootX - lKneeX) * Math.min(1, -lFootY / 12))

  // Torso — broad shoulders, V-taper to hips
  // Compensate for the forward lean (0.18 rad) which foreshortens apparent width
  drawTorso(ctx, hipY, shoulderY, 1 / Math.cos(lean))

  // Front leg — thick thigh, tapering shin
  drawLimb(ctx, 0, hipY, rKneeX, rKneeY,       14, C_PANTS, C_PANTS_H, 1.6, 0.44, 0.28)
  drawLimb(ctx, rKneeX, rKneeY, rFootX, rFootY,  9, C_SKIN, C_SKIN_H, 1.2, 0.34, 0.12)
  figShoe(ctx, rFootX, rFootY,
    Math.atan2(rFootY - rKneeY, rFootX - rKneeX) * Math.min(1, -rFootY / 12))

  // Near arm — pumping freely, or javelin carry form (approach run)
  if (holdSpear) {
    // Draw head first so the spear shaft renders in front of / across the head
    figHead(ctx, 0, headCY)

    // Classic running javelin carry: upper arm raised forward-horizontal, elbow in front
    // of torso at shoulder height, forearm angles upward to grip near ear/head level.
    const eX = 16,  eY = shoulderY - 4    // elbow: forward of shoulder, slightly above
    const hX = 14,  hY = shoulderY - 14   // hand: above elbow, near ear height
    const sa  = -0.35   // ~20° above horizontal — shallow carry angle
    const sx1 = hX - Math.cos(sa) * 30, sy1 = hY - Math.sin(sa) * 30  // tail (behind hand)
    const sx2 = hX + Math.cos(sa) * 62, sy2 = hY + Math.sin(sa) * 62  // tip (forward)
    figDeltoid(ctx, 8, shoulderY)
    drawLimb(ctx, 8, shoulderY, 12, shoulderY-2, 7, C_SHIRT, C_SHIRT_H, 1.2, 0.38, 0.36)
    drawLimb(ctx, 12, shoulderY-2, eX, eY, 7, C_SKIN, C_SKIN_H, 1.2, 0.36, 0.32)
    figElbow(ctx, eX, eY)
    drawLimb(ctx, eX, eY, hX, hY,      6, C_SKIN, C_SKIN_H, 0.80, 0.42, 0.14)
    drawSpearShape(ctx, sx1, sy1, sx2, sy2, false)  // spear before hand — hand covers the grip
    figHand(ctx, eX, eY, hX, hY)
  } else {
    figDeltoid(ctx, 8, shoulderY)
    const nSlvX = (8 + nearElbX) * 0.5, nSlvY = (shoulderY + nearElbY) * 0.5
    drawLimb(ctx, 8, shoulderY, nSlvX, nSlvY, 7, C_SHIRT, C_SHIRT_H, 1.2, 0.38, 0.36)
    drawLimb(ctx, nSlvX, nSlvY, nearElbX, nearElbY, 7, C_SKIN, C_SKIN_H, 1.2, 0.36, 0.32)
    figElbow(ctx, nearElbX, nearElbY)
    drawLimb(ctx, nearElbX, nearElbY, nearHndX, nearHndY, 6, C_SKIN, C_SKIN_H, 0.80, 0.42, 0.14)
    figHand(ctx, nearElbX, nearElbY, nearHndX, nearHndY)

    // Head last for normal running — arm is in front, head on top of far-arm only
    figHead(ctx, 0, headCY)
  }

  ctx.restore()
}

// ── Throw animation: running carry → deep reverse-C wind-up → explosive high-elbow release → follow-through ──
function drawFigureThrowing(ctx, x, y, p) {
  // p: 0 = countdown hits zero / throw starts, 1 = transitions back to running
  const WINDUP  = THROW_WINDUP_P   // 0.28 — plant + coil complete
  const RELEASE = THROW_RELEASE_P  // 0.56 — javelin leaves hand

  const jumpY = throwJumpY(p)

  ctx.save()
  ctx.translate(x, y - jumpY)
  ctx.scale(FIG_SCALE, FIG_SCALE)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'

  const { hipY, neckY, headCY, shoulderY } = figLayout()

  // ── Body lean ──────────────────────────────────────────────────────────────
  // Running posture (+0.18) → deep reverse-C backward coil (-0.36) →
  // hips-first explosive uncoil forward (+0.18) → follow-through settle (+0.08)
  let lean
  if (p < WINDUP) {
    lean = lerp( 0.18, -0.36, easeIn2(p / WINDUP))
  } else if (p < RELEASE) {
    lean = lerp(-0.36,  0.18, easeOut3((p - WINDUP) / (RELEASE - WINDUP)))
  } else {
    lean = lerp( 0.18,  0.08, easeOut3((p - RELEASE) / (1 - RELEASE)))
  }
  ctx.rotate(lean)

  // ── Hip drop: deep crouch loads power during plant ──────────────────────
  const hipDrop = p < WINDUP ? 9 * Math.sin(Math.PI * (p / WINDUP)) : 0
  const aHipY   = hipY + hipDrop

  // ── Legs: wide power stance → lead-leg brace + drive-leg fire → landing ──
  let rKnX, rKnY, rFtX, rFtY   // lead / right leg
  let lKnX, lKnY, lFtX, lFtY   // drive / left leg

  if (p < WINDUP) {
    const t = easeOut3(p / WINDUP)
    // Running stride → wide planted stance, both feet grounded for maximum force transfer
    rFtX = lerp(10,  22, t);   rFtY = 0
    lFtX = lerp(-8, -22, t);   lFtY = lerp(0, -5, t)    // drive heel rises as weight loads
    rKnX = lerp( 5,  13, t);   rKnY = lerp(aHipY * 0.55, aHipY * 0.60, t)
    lKnX = lerp(-4, -13, t);   lKnY = lerp(aHipY * 0.55, aHipY * 0.60, t)
  } else if (p < RELEASE) {
    const t = easeOut3((p - WINDUP) / (RELEASE - WINDUP))
    // Drive leg fires, lead leg braces; brief airborne moment at peak of throw
    rFtX = lerp( 22,  28, t);  rFtY = lerp( 0, -14, t)  // lead leg kicks forward and up
    lFtX = lerp(-22, -14, t);  lFtY = lerp(-5, -18, t)  // drive leg pushes then lifts
    rKnX = lerp( 13,  20, t);  rKnY = lerp(aHipY * 0.60, aHipY * 0.72, t)
    lKnX = lerp(-13,  -8, t);  lKnY = lerp(aHipY * 0.60, aHipY * 0.68, t)
  } else {
    const t = easeOut3((p - RELEASE) / (1 - RELEASE))
    rFtX = lerp( 28,  16, t);  rFtY = lerp(-14,  0, t)
    lFtX = lerp(-14,  -8, t);  lFtY = lerp(-18,  0, t)
    rKnX = lerp( 20,   8, t);  rKnY = lerp(aHipY * 0.72, aHipY * 0.54, t)
    lKnX = lerp( -8,  -4, t);  lKnY = lerp(aHipY * 0.68, aHipY * 0.54, t)
  }

  // Back (drive) leg
  drawLimb(ctx, 0, aHipY, lKnX, lKnY,   14, C_PANTS, C_PANTS_H, 1.6, 0.44, 0.28)
  drawLimb(ctx, lKnX, lKnY, lFtX, lFtY,  9, C_SKIN, C_SKIN_H, 1.2, 0.34, 0.12)
  figShoe(ctx, lFtX, lFtY,
    Math.atan2(lFtY - lKnY, lFtX - lKnX) * Math.min(1, -lFtY / 12))

  // Torso — broad shoulders, V-taper to hips
  drawTorso(ctx, aHipY, shoulderY)

  // Front (lead/brace) leg
  drawLimb(ctx, 0, aHipY, rKnX, rKnY,   14, C_PANTS, C_PANTS_H, 1.6, 0.44, 0.28)
  drawLimb(ctx, rKnX, rKnY, rFtX, rFtY,  9, C_SKIN, C_SKIN_H, 1.2, 0.34, 0.12)
  figShoe(ctx, rFtX, rFtY,
    Math.atan2(rFtY - rKnY, rFtX - rKnX) * Math.min(1, -rFtY / 12))

  // ── Throwing arm (right) ────────────────────────────────────────────────
  // Phase 1 (0→WINDUP): running carry (elbow high, arm bent) → arm fully extended
  //   BACK at shoulder level — the "arm back, body rotated" power position
  // Phase 2 (WINDUP→RELEASE): explosive elbow-leads-first whip upward and forward →
  //   javelin releases from a HIGH point above the head
  // Phase 3 (RELEASE→1): follow-through arc forward and down
  let eX, eY, hX, hY
  if (p < WINDUP) {
    const t = easeIn2(p / WINDUP)
    // Start matches holdSpear running position to avoid visual jump at throw onset
    eX = lerp( 16, -14, t);  eY = lerp(shoulderY -  4, shoulderY +  2, t)
    hX = lerp( 14, -28, t);  hY = lerp(shoulderY - 14, shoulderY +  4, t)
  } else if (p < RELEASE) {
    const t = easeOut3((p - WINDUP) / (RELEASE - WINDUP))
    // Elbow rockets upward and forward FIRST (leads the throw), hand follows through to high release
    eX = lerp(-14,  10, t);  eY = lerp(shoulderY +  2, shoulderY - 22, t)
    hX = lerp(-28,  16, t);  hY = lerp(shoulderY +  4, shoulderY - 26, t)
  } else {
    const t = easeOut3((p - RELEASE) / (1 - RELEASE))
    eX = lerp( 10,   6, t);  eY = lerp(shoulderY - 22, shoulderY +  8, t)
    hX = lerp( 16,   2, t);  hY = lerp(shoulderY - 26, shoulderY + 18, t)
  }
  figDeltoid(ctx, 8, shoulderY)
  const tSlvX = (8 + eX) * 0.5, tSlvY = (shoulderY + eY) * 0.5
  drawLimb(ctx, 8, shoulderY, tSlvX, tSlvY, 7, C_SHIRT, C_SHIRT_H, 1.2, 0.38, 0.36)
  drawLimb(ctx, tSlvX, tSlvY, eX, eY, 7, C_SKIN, C_SKIN_H, 1.2, 0.36, 0.32)
  figElbow(ctx, eX, eY)
  drawLimb(ctx, eX, eY, hX, hY,      6, C_SKIN, C_SKIN_H, 0.80, 0.42, 0.14)
  figHand(ctx, eX, eY, hX, hY)

  // ── Counter-rotation arm (left) ──────────────────────────────────────────
  // Drives FORWARD as the throwing arm goes BACK (stores rotational energy),
  // then sweeps BACK hard as the body uncoils (classic javelin counter-rotation).
  // Counter-rotation arm: elbow stays ~12 px from shoulder (-8, shoulderY).
  // Back arc: elbow ≈ (-18, sY+5) — 155° from horiz, ua=11.2 px
  // Forward arc: elbow ≈ (  3, sY+5) —  25° from horiz, ua=12.1 px
  let beX, beY, bhX, bhY
  if (p < WINDUP) {
    const t = easeOut3(p / WINDUP)
    // Drives forward as throwing arm winds back
    beX = lerp(-18,  3, t);  beY = shoulderY + 5
    bhX = lerp(-16,  8, t);  bhY = shoulderY + lerp(16, -6, t)
  } else if (p < RELEASE) {
    const t = easeOut3((p - WINDUP) / (RELEASE - WINDUP))
    // Sweeps hard back as body uncoils
    beX = lerp(  3, -18, t);  beY = shoulderY + 5
    bhX = lerp(  8, -16, t);  bhY = shoulderY + lerp(-6, 16, t)
  } else {
    const t = easeOut3((p - RELEASE) / (1 - RELEASE))
    // Settles toward natural hang
    beX = lerp(-18, -14, t);  beY = shoulderY + lerp(5, 7, t)
    bhX = -16;                 bhY = shoulderY + lerp(16, 20, t)
  }
  ctx.globalAlpha = 0.65
  figDeltoid(ctx, -8, shoulderY, 0.65)
  const cSlvX = (-8 + beX) * 0.5, cSlvY = (shoulderY + beY) * 0.5
  drawLimb(ctx, -8, shoulderY, cSlvX, cSlvY, 7, C_SHIRT, C_SHIRT_H, 1.2, 0.38, 0.36)
  drawLimb(ctx, cSlvX, cSlvY, beX, beY, 7, C_SKIN, C_SKIN_H, 1.2, 0.36, 0.32)
  figElbow(ctx, beX, beY)
  drawLimb(ctx, beX, beY, bhX, bhY,    6, C_SKIN, C_SKIN_H, 0.80, 0.42, 0.14)
  figHand(ctx, beX, beY, bhX, bhY, 0.65)
  ctx.globalAlpha = 1

  // ── Head ──
  figHead(ctx, 0, headCY)

  // ── Javelin held until release ──────────────────────────────────────────
  // During wind-up: arm extends back, javelin stays nearly horizontal (tip still forward).
  // Just before release: angle climbs to ~32° above horizontal — classic launch angle.
  if (p < THROW_SPEAR_RELEASE) {
    let sa
    if (p < WINDUP) {
      // Carry angle (-0.30) → nearly flat as arm fully extends back (-0.16)
      sa = lerp(-0.30, -0.16, easeIn2(p / WINDUP))
    } else {
      // Whips from near-horizontal to ~32° above at release — the power position
      sa = lerp(-0.16, -0.56, easeOut3((p - WINDUP) / (THROW_SPEAR_RELEASE - WINDUP)))
    }
    const sx1 = hX - Math.cos(sa) * 30   // tail (behind hand)
    const sy1 = hY - Math.sin(sa) * 30
    const sx2 = hX + Math.cos(sa) * 38   // tip (forward)
    const sy2 = hY + Math.sin(sa) * 38
    drawSpearShape(ctx, sx1, sy1, sx2, sy2, false)
  }

  ctx.restore()
}

function drawFigureStanding(ctx, x, y) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(FIG_SCALE, FIG_SCALE)
  ctx.rotate(0.08)   // residual forward lean — matches tail of throw follow-through
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'

  const { hipY, neckY, headCY, shoulderY } = figLayout()

  // ── Far arm (left) — natural hang with slight elbow bend ──
  figDeltoid(ctx, -6, shoulderY, 0.6)
  drawLimb(ctx, -6, shoulderY, -8, shoulderY+6.5, 7, C_SHIRT, C_SHIRT_H, 1.2, 0.38, 0.36)
  drawLimb(ctx, -8, shoulderY+6.5, -10, shoulderY+13, 7, C_SKIN, C_SKIN_H, 1.2, 0.36, 0.32)
  figElbow(ctx, -10, shoulderY + 13)
  drawLimb(ctx, -10, shoulderY + 13, -7, shoulderY + 26, 6, C_SKIN, C_SKIN_H, 0.80, 0.42, 0.14)
  figHand(ctx, -10, shoulderY + 13, -7, shoulderY + 26)

  // ── Back (left) leg — trailing back after throw follow-through ──
  drawLimb(ctx, 0, hipY, -5, hipY * 0.52, 14, C_PANTS, C_PANTS_H, 1.1, 0.44, 0.28)
  drawLimb(ctx, -5, hipY * 0.52, -9, 0,   9, C_SKIN, C_SKIN_H,  1.2, 0.34, 0.12)
  figShoe(ctx, -9, 0)

  // ── Torso ──
  drawTorso(ctx, hipY, shoulderY)

  // ── Front (right) leg — planted forward, weight on lead foot ──
  drawLimb(ctx, 0, hipY, 5, hipY * 0.52, 14, C_PANTS, C_PANTS_H, 1.6, 0.44, 0.28)
  drawLimb(ctx, 5, hipY * 0.52, 13, 0,    9, C_SKIN, C_SKIN_H,  1.2, 0.34, 0.12)
  figShoe(ctx, 13, 0)

  // ── Near arm (right) — post-throw follow-through ──
  // Upper arm ~48° below horizontal: arm swings naturally down from the shoulder
  // joint before reaching forward. Elbow and hand both further forward (+x) than
  // shoulder — no backward bend anywhere.
  figDeltoid(ctx, 6, shoulderY)
  drawLimb(ctx, 6, shoulderY, 9, shoulderY+4.5, 7, C_SHIRT, C_SHIRT_H, 1.2, 0.38, 0.36)
  drawLimb(ctx, 9, shoulderY+4.5, 12, shoulderY+9, 7, C_SKIN, C_SKIN_H, 1.2, 0.36, 0.32)
  figElbow(ctx, 12, shoulderY + 9)
  drawLimb(ctx, 12, shoulderY+9, 17, shoulderY+18, 6, C_SKIN, C_SKIN_H, 0.80, 0.42, 0.14)
  figHand(ctx, 12, shoulderY+9, 17, shoulderY+18)

  figHead(ctx, 0, headCY)
  ctx.restore()
}

function drawFigureCrashed(ctx, x, y, crashTime) {
  const age  = (Date.now() - crashTime) / 1000
  const tilt = Math.min(age * 3.2, 1.30)    // tips to ~85° total (fully horizontal)
  const fade = Math.max(0.15, 1 - age * 0.4)

  ctx.save(); ctx.translate(x, y)
  ctx.scale(FIG_SCALE, FIG_SCALE)
  ctx.rotate(0.18 + tilt)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'

  const { hipY, neckY, headCY, shoulderY } = figLayout()

  // ── Pose: trunk + right leg on floor, left leg raised, both arms overhead ──
  // At ~90° rotation local axes in world:
  //   local -x → UP,   local +x → DOWN toward floor
  //   local +y (> hipY) → BEHIND,   local -y (< shoulderY) → OVERHEAD/FORWARD

  // Right leg — flat on floor, trailing straight behind
  const lKneeX = 2, lKneeY = hipY + 9    // knee: at floor, behind hip
  const lFootX = 4, lFootY = hipY + 21   // foot: at floor, trailing

  // Left leg — thigh on floor like right leg, knee bent, calf swings up
  const rKneeX = 3,   rKneeY = hipY + 10  // knee: at floor level, behind hip
  const rFootX = -18, rFootY = hipY + 14  // calf goes upward from knee

  // Far arm — fully extended overhead, dimmed
  ctx.globalAlpha = fade * 0.50
  const farElbX = 4,  farElbY = shoulderY - 15
  const farHndX = 6,  farHndY = shoulderY - 25
  figDeltoid(ctx, 0, shoulderY, fade * 0.50)
  drawLimb(ctx, 0, shoulderY, 2, shoulderY-7.5, 7, C_SHIRT, C_SHIRT_H, 1.2, 0.38, 0.36)
  drawLimb(ctx, 2, shoulderY-7.5, farElbX, farElbY, 7, C_SKIN, C_SKIN_H, 1.2, 0.36, 0.32)
  figElbow(ctx, farElbX, farElbY)
  drawLimb(ctx, farElbX, farElbY, farHndX, farHndY,  6, C_SKIN, C_SKIN_H, 0.80, 0.42, 0.14)
  figHand(ctx, farElbX, farElbY, farHndX, farHndY, 0.50)

  // Right leg (on floor)
  ctx.globalAlpha = fade
  drawLimb(ctx, 0, hipY, lKneeX, lKneeY,       14, C_PANTS, C_PANTS_H, 1.6, 0.44, 0.28)
  drawLimb(ctx, lKneeX, lKneeY, lFootX, lFootY,  9, C_SKIN, C_SKIN_H, 1.2, 0.34, 0.12)
  figShoe(ctx, lFootX, lFootY)

  // Torso — broad shoulders, V-taper to hips
  drawLimb(ctx, 0, neckY, 0, hipY, 18, C_SHIRT, C_SHIRT_H, 0.65, 0.36, 0.20)

  // Left leg — maximally raised (hip + knee flexed)
  drawLimb(ctx, 0, hipY, rKneeX, rKneeY,       14, C_PANTS, C_PANTS_H, 1.6, 0.44, 0.28)
  drawLimb(ctx, rKneeX, rKneeY, rFootX, rFootY,  9, C_SKIN, C_SKIN_H, 1.2, 0.34, 0.12)
  figShoe(ctx, rFootX, rFootY)

  // Near arm — drawn before head so head always renders on top
  const nearElbX = 2,  nearElbY = shoulderY - 17
  const nearHndX = 4,  nearHndY = shoulderY - 27
  figDeltoid(ctx, 0, shoulderY, fade)
  drawLimb(ctx, 0, shoulderY, 1, shoulderY-8.5, 7, C_SHIRT, C_SHIRT_H, 1.2, 0.38, 0.36)
  drawLimb(ctx, 1, shoulderY-8.5, nearElbX, nearElbY, 7, C_SKIN, C_SKIN_H, 1.2, 0.36, 0.32)
  figElbow(ctx, nearElbX, nearElbY)
  drawLimb(ctx, nearElbX, nearElbY, nearHndX, nearHndY, 6, C_SKIN, C_SKIN_H, 0.80, 0.42, 0.14)
  figHand(ctx, nearElbX, nearElbY, nearHndX, nearHndY)

  // Head — lifted higher (-x offset = up in world at ~90° rotation) and chin tilted up more
  ctx.save()
  ctx.translate(-8, headCY)   // -8 in local x = 8px higher in world
  ctx.rotate(-0.58)            // more chin-up tilt
  figHead(ctx, 0, 0)
  ctx.restore()

  ctx.restore()
}

// ── Spear (waiting — held in hands) ──────────────────────────
function drawSpearOverhead(ctx, figX, figY, t) {
  const { lhX, lhY, rhX, rhY } = figureWaitingHands(t)

  const dx  = rhX - lhX, dy = rhY - lhY
  const len = Math.hypot(dx, dy)
  const nx  = dx / len, ny = dy / len

  const x1 = figX + lhX - nx * 28   // tail beyond back hand
  const y1 = figY + lhY - ny * 28
  const x2 = figX + rhX + nx * 44   // tip  beyond front hand
  const y2 = figY + rhY + ny * 44

  drawSpearShape(ctx, x1, y1, x2, y2, false)
}

// Returns spearhead / text colors that burn: gold → amber → orange → red → deep crimson
function multColor(m) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  let r, g, b
  if (m < 2) {
    const t = clamp((m - 1) / 1, 0, 1)   // gold → amber
    r = Math.round(lerp(250, 251, t)); g = Math.round(lerp(204, 146, t)); b = Math.round(lerp(21, 12, t))
  } else if (m < 4) {
    const t = clamp((m - 2) / 2, 0, 1)   // amber → orange
    r = Math.round(lerp(251, 249, t)); g = Math.round(lerp(146, 115, t)); b = Math.round(lerp(12, 22, t))
  } else if (m < 8) {
    const t = clamp((m - 4) / 4, 0, 1)   // orange → bright red
    r = Math.round(lerp(249, 239, t)); g = Math.round(lerp(115, 40, t)); b = Math.round(lerp(22, 28, t))
  } else {
    const t = clamp((m - 8) / 6, 0, 1)   // bright red → deep crimson
    r = Math.round(lerp(239, 153, t)); g = Math.round(lerp(40, 10, t)); b = Math.round(lerp(28, 15, t))
  }
  // Glow intensity grows with multiplier — hotter burn
  const glowA = Math.min(0.95, 0.7 + (m - 1) * 0.025)
  const hex = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
  return { accent: hex, glow: `rgba(${r},${g},${b},${glowA.toFixed(2)})`, text: `rgba(${r},${g},${b},0.97)` }
}

// Canvas-space angle of the spear at the moment of release:
// figure lean at p=THROW_SPEAR_RELEASE (~+0.175 rad) + javelin sa at full whip (-0.56 rad)
const SPEAR_LEN           = 120                 // tip-to-tail draw length in px
const SPEAR_RELEASE_ANGLE = -Math.PI / 6        // -30°
const SPEAR_IMG_ANGLE     = -Math.PI / 4        // PNG natural angle: tip upper-right (~-45°)

function drawSpearImage(ctx, img, tipX, tipY, spearLen = SPEAR_LEN) {
  const s  = spearLen / (Math.SQRT2 * 0.85)
  const R  = SPEAR_RELEASE_ANGLE - SPEAR_IMG_ANGLE
  const cx = tipX - Math.cos(SPEAR_RELEASE_ANGLE) * spearLen / 2
  const cy = tipY - Math.sin(SPEAR_RELEASE_ANGLE) * spearLen / 2
  if (!img) {
    drawSpearShape(ctx,
      cx - Math.cos(SPEAR_RELEASE_ANGLE) * spearLen / 2,
      cy - Math.sin(SPEAR_RELEASE_ANGLE) * spearLen / 2,
      tipX, tipY, false)
    return
  }
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(cx, cy)
  ctx.rotate(R)
  ctx.drawImage(img, -s / 2, -s / 2, s, s)
  ctx.restore()
}

// Draw spear image at arbitrary angle (tip-to-tail direction given by spearAngle)
function drawSpearFall(ctx, img, tipX, tipY, spearAngle, spearLen) {
  const s  = spearLen / (Math.SQRT2 * 0.85)
  const R  = spearAngle - SPEAR_IMG_ANGLE
  const cx = tipX - Math.cos(spearAngle) * spearLen / 2
  const cy = tipY - Math.sin(spearAngle) * spearLen / 2
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(cx, cy)
  ctx.rotate(R)
  if (img) {
    ctx.drawImage(img, -s / 2, -s / 2, s, s)
  } else {
    // Fallback: plain shape
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(-spearLen / 2, 0); ctx.lineTo(spearLen / 2, 0); ctx.stroke()
  }
  ctx.restore()
}

function drawSpearShape(ctx, x1, y1, x2, y2, crashed, mult = 1) {
  const dx = x2 - x1, dy = y2 - y1
  const angle = Math.atan2(dy, dx)
  const len   = Math.hypot(dx, dy)
  if (len < 4) return

  ctx.save()
  ctx.translate(x1, y1); ctx.rotate(angle)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'

  const glowCol = crashed ? 'rgba(239,68,68,0.85)' : multColor(mult).glow
  // Match sprite: head ≈ 18 % of total length, moderate width
  const headLen   = Math.min(len * 0.18, 20)
  const shaftLen  = len - headLen
  const shaftW    = 2.5
  const headBaseW = shaftW * 1.9   // ~2× shaft width each side → matches sprite ratio

  // ── Drop shadow ───────────────────────────────────────────────
  ctx.save()
  ctx.shadowBlur = 5; ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.01)'; ctx.lineWidth = shaftW * 2.2
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke()
  ctx.restore()

  // ── Shaft — chestnut (slightly darker) ───────────────────────
  const shaftGrad = ctx.createLinearGradient(0, -shaftW, 0, shaftW)
  shaftGrad.addColorStop(0,    '#3e1c0a')   // dark top edge
  shaftGrad.addColorStop(0.18, '#c47840')   // chestnut highlight
  shaftGrad.addColorStop(0.50, '#9a5228')   // chestnut mid
  shaftGrad.addColorStop(0.82, '#5a2c10')   // dark brown lower shadow
  shaftGrad.addColorStop(1,    '#3e1c0a')   // dark bottom edge
  ctx.fillStyle = shaftGrad
  ctx.beginPath()
  ctx.moveTo(0,        -shaftW)
  ctx.lineTo(shaftLen, -shaftW * 0.6)
  ctx.lineTo(shaftLen,  shaftW * 0.6)
  ctx.lineTo(0,         shaftW)
  ctx.closePath(); ctx.fill()

  // Specular stripe along top of shaft
  ctx.strokeStyle = 'rgba(220,155,90,0.50)'; ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.moveTo(3, -shaftW * 0.38); ctx.lineTo(shaftLen - 3, -shaftW * 0.22); ctx.stroke()

  // Butt cap
  const capGrad = ctx.createRadialGradient(-1, -0.5, 0.3, 0, 0, shaftW + 1.5)
  capGrad.addColorStop(0, '#c07038'); capGrad.addColorStop(1, '#3e1c0a')
  ctx.fillStyle = capGrad
  ctx.beginPath(); ctx.ellipse(0, 0, 3, shaftW, 0, 0, Math.PI * 2); ctx.fill()

  // ── Arrowhead — warm gold, one tone lighter than shaft ────────
  if (!crashed) {
    ctx.shadowBlur = Math.min(50, 12 + mult * 3)
    ctx.shadowColor = glowCol
  } else {
    ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(239,68,68,0.80)'
  }
  const tipGrad = ctx.createLinearGradient(len - headLen, -headBaseW, len - headLen, headBaseW)
  tipGrad.addColorStop(0,    '#1a1a1e')   // near-black top edge
  tipGrad.addColorStop(0.12, '#c8ccd4')   // bright iron specular
  tipGrad.addColorStop(0.45, '#6a6e78')   // mid iron gray
  tipGrad.addColorStop(0.82, '#2e3038')   // dark iron shadow
  tipGrad.addColorStop(1,    '#1a1a1e')   // near-black bottom edge
  ctx.fillStyle = tipGrad
  ctx.beginPath()
  ctx.moveTo(len - headLen, -headBaseW)
  ctx.lineTo(len,            0)
  ctx.lineTo(len - headLen,  headBaseW)
  ctx.closePath(); ctx.fill()

  // Tip spine
  ctx.shadowBlur = 3; ctx.shadowColor = 'rgba(180,185,200,0.5)'
  ctx.strokeStyle = 'rgba(200,210,220,0.80)'; ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.moveTo(len - headLen * 0.9, 0); ctx.lineTo(len - headLen * 0.05, 0)
  ctx.stroke()

  // Tip glint
  ctx.fillStyle = '#ffffff'
  ctx.shadowBlur = crashed ? 22 : Math.min(45, 10 + mult * 5)
  ctx.shadowColor = glowCol
  ctx.beginPath(); ctx.arc(len, 0, 1.2, 0, Math.PI * 2); ctx.fill()

  ctx.shadowBlur = 0
  ctx.restore()
}

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════

export default function CrashGraph({ phase, multiplier, crashPoint, countdown }) {
  const canvasRef    = useRef(null)
  const pointsRef    = useRef([])
  const animRef      = useRef(null)
  const startRef     = useRef(null)
  const crashTimeRef = useRef(null)
  const tRef         = useRef(0)
  const scrollRef    = useRef(0)
  const lastTsRef    = useRef(null)
  const particlesRef = useRef([])
  const trailRef     = useRef([])
  const ringTimerRef    = useRef(0)
  const legPhaseRef     = useRef(0)
  const figXRef         = useRef(-60)
  const shockwaveRef       = useRef([])
  const hoopRef            = useRef([])
  const hoopSpawnTimerRef  = useRef(0)
  const explosionOrigin    = useRef(null)
  const crashSpearRef      = useRef(null)
  const crashImpactFiredRef = useRef(false)
  const costumeRef         = useRef(null)
  const spearIdleRef       = useRef(null)
  const spriteRef       = useRef(null)
  const spearImgRef     = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const resize = () => { const r = canvas.parentElement.getBoundingClientRect(); canvas.width = r.width; canvas.height = r.height }
    resize(); window.addEventListener('resize', resize)
    const img = new Image()
    img.src = '/spear-character.png'
    img.onload = () => { spriteRef.current = img }
    const spearImg = new Image()
    spearImg.src = '/spear-flying.png'
    spearImg.onload = () => { spearImgRef.current = spearImg }
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    cancelAnimationFrame(animRef.current)

    // ── WAITING ─────────────────────────────────────────────
    if (phase === 'waiting') {
      pointsRef.current = []; startRef.current = null; crashTimeRef.current = null
      trailRef.current = []; particlesRef.current = []
      // Pick a new random costume once per round (costumeRef is reset to null by the crashed phase)
      if (costumeRef.current === null) {
        costumeRef.current  = Math.floor(Math.random() * COSTUMES.length)
        scrollRef.current   = 0
        legPhaseRef.current = 0
        ringTimerRef.current = 0   // smooth linearFrac tracker (reused from running phase)
      }
      applyCostume(costumeRef.current)

      // legPhase and scroll both accumulate per-frame with dt and persist across the
      // 100 ms effect re-runs (countdown prop changes), giving smooth 60 fps animation.
      const loop = (ts) => {
        tRef.current++
        const dt = lastTsRef.current ? ts - lastTsRef.current : 16
        lastTsRef.current = ts

        const { width: w, height: h } = canvas
        const scale   = Math.min(1, Math.max(0.6, h / 320))
        const spriteH = Math.round(SPRITE_DISPLAY_H * scale)
        const gY = h - PAD_B

        const cdVal    = typeof countdown === 'number' ? countdown : 5
        const CD_TOTAL = 5
        const figX     = PAD_L + 30
        figXRef.current = figX

        // ── Speed model ───────────────────────────────────────────────────────
        // Ground speed (canvas px / ms) ramps linearly from slow jog → full sprint.
        const V_JOG    = 0.22   // slow jog  : 3.5 px/frame, near-trees 1.75 px/frame
        const V_SPRINT = 1.00   // full sprint: 16 px/frame, near-trees 8 px/frame

        // cdVal steps every 100 ms, which would make v, lean, and bounce amplitude
        // all snap to new values every 6 frames.  Exponential smoothing (τ=150 ms)
        // turns those discrete steps into a continuous ramp — no visible jumps.
        const targetFrac = Math.min(1, Math.max(0, (CD_TOTAL - cdVal) / CD_TOTAL))
        ringTimerRef.current += (targetFrac - ringTimerRef.current) * (1 - Math.exp(-dt / 150))
        const linearFrac = ringTimerRef.current
        const v = V_JOG + (V_SPRINT - V_JOG) * linearFrac

        // Background moves at the character's ground speed (px / ms)
        scrollRef.current += dt * v

        // ── Sprite frame rate ─────────────────────────────────────────────────
        // Advancing legPhase as v gives a 4.7× rate swing (jog→sprint) which
        // makes the sprite look frozen at low speed and skip frames at high speed.
        // Using v^0.6 compresses that to a 1.9× swing, keeping the animation in
        // the natural-looking range across the full countdown:
        //   jog   (v=0.22): ~0.7 frames/RAF  → cycle ≈ 1.3 s  ✓
        //   sprint (v=1.00): ~1.9 frames/RAF  → cycle ≈ 0.5 s  ✓
        const LEG_K = 75.3   // tuned so sprint → 1.5 frames/RAF
        legPhaseRef.current += dt * Math.pow(v, 0.6) / LEG_K

        // ── Body-bob ──────────────────────────────────────────────────────────
        // cos²(φ) peaks at legPhase=0,π (flight frames 0,27) and is 0 at π/2,3π/2
        // (contact frames 13,41) — matching the sprite's gait phase convention.
        const bounceY = Math.pow(Math.cos(legPhaseRef.current), 2) * 7 * (0.45 + 0.55 * linearFrac)

        // ── Forward lean grows with speed ─────────────────────────────────────
        // Rotate around the feet so the character tilts into the sprint naturally.
        const leanAngle = Math.pow(linearFrac, 1.5) * 0.18   // 0 → ~10.3° at full sprint

        drawBackground(ctx, w, h, scrollRef.current)
        drawSpeedLines(ctx, w, h, scrollRef.current)
        drawAxes(ctx, w, h, 2.0)
        drawGround(ctx, w, h, scrollRef.current)

        const runFrame = Math.floor(legPhaseRef.current * (SPRITE_RUN_COUNT / (2 * Math.PI))) % SPRITE_RUN_COUNT
        const groundSink = Math.round(SPRITE_GROUND_SINK * spriteH / SPRITE_DISPLAY_H)
        const feetY = gY - bounceY + groundSink
        ctx.save()
        ctx.translate(figX, feetY)
        ctx.rotate(-leanAngle)
        ctx.translate(-figX, -feetY)
        drawSpriteFrame(ctx, spriteRef.current, SPRITE_RUN_START + runFrame, figX, gY - bounceY, spriteH)
        ctx.restore()

        // Countdown: 5 → 4 → 3 → 2 → 1
        const cdDisplay    = Math.ceil(cdVal)
        const fracIntoStep = cdDisplay - cdVal
        const pulse        = 1 + 0.4 * (1 - fracIntoStep)
        ctx.save()
        ctx.translate(w * 0.55, h * 0.38)
        ctx.scale(pulse, pulse)
        ctx.fillStyle = 'rgba(250,204,21,0.92)'; ctx.font = `bold ${Math.round(48 * scale)}px Inter,sans-serif`; ctx.textAlign = 'center'
        ctx.shadowBlur = 16; ctx.shadowColor = 'rgba(250,204,21,0.6)'
        ctx.fillText(String(cdDisplay), 0, 0)
        ctx.restore()
        ctx.shadowBlur = 0

        animRef.current = requestAnimationFrame(loop)
      }
      animRef.current = requestAnimationFrame(loop)
      return () => { cancelAnimationFrame(animRef.current); lastTsRef.current = null }
    }

    // ── RUNNING ──────────────────────────────────────────────
    if (phase === 'running') {
      // Back-calculate elapsed from the server-synced multiplier so the canvas
      // stays in sync after a page refresh mid-round (not always 0).
      const knownElapsed = Math.log(Math.max(multiplier, 1)) / MULTIPLIER_SPEED
      startRef.current = performance.now() - knownElapsed
      trailRef.current = []; particlesRef.current = []; ringTimerRef.current = 0
      hoopRef.current = []; hoopSpawnTimerRef.current = 1200
      legPhaseRef.current = 0; spearIdleRef.current = null

      // Carry the waiting-phase costume through, or pick one if joining mid-round
      if (costumeRef.current === null) costumeRef.current = Math.floor(Math.random() * COSTUMES.length)
      applyCostume(costumeRef.current)

      const loop = (ts) => {
        tRef.current++
        const dt      = lastTsRef.current ? ts - lastTsRef.current : 16; lastTsRef.current = ts
        const elapsed = performance.now() - startRef.current
        const curM    = Math.pow(Math.E, MULTIPLIER_SPEED * elapsed)
        const maxM    = Math.max(curM * 1.18, 2.5)

        pointsRef.current.push({ elapsed, multiplier: curM })
        if (pointsRef.current.length > 900) pointsRef.current.shift()

        const SPEED_CAP_M = 10   // multiplier at which speed stops increasing
        const cappedM = Math.min(curM, SPEED_CAP_M)
        const speed = Math.min(1.5 + (cappedM - 1) * 0.5, 7)
        scrollRef.current += dt * speed * 0.07
        // Leg cadence — frozen once the throw animation completes
        const throwDone = elapsed >= THROW_DURATION
        if (!throwDone) legPhaseRef.current += dt * 0.004 * Math.sqrt(cappedM)
        updateParticles(particlesRef.current, dt)

        const { width: w, height: h } = canvas
        const scale     = Math.min(1, Math.max(0.6, h / 320))
        const spriteH   = Math.round(SPRITE_DISPLAY_H * scale)
        const distScale = Math.max(0.60, Math.pow(curM, -0.07))
        const spearLen  = Math.round(SPEAR_LEN * scale * distScale)
        const gY   = h - PAD_B
        const pts  = pointsRef.current
        const figX = PAD_L + 30

        drawBackground(ctx, w, h, scrollRef.current)
        drawSpeedLines(ctx, w, h, scrollRef.current)
        drawAxes(ctx, w, h, maxM)
        drawGround(ctx, w, h, scrollRef.current)

        // Spear launch: right edge of sprite, at the row where spear exits the frame (row≈105/640)
        const spearStartX = figX + spriteH / 2
        const spearStartY = gY + Math.round(SPRITE_GROUND_SINK * scale) - spriteH + (105 / 640) * spriteH
        const spearEndX   = w - PAD_R - 20, spearEndY = PAD_T + 20
        const flyAngle    = Math.atan2(spearEndY - spearStartY, spearEndX - spearStartX)
        // SPEAR_LEN is a module-level constant

        const BURST_FRAC         = 0.22
        const SPEAR_RELEASE_P    = 0.13  // throwP when spear exits the sprite frame

        // Figure: throw animation for first THROW_DURATION ms, then panting
        const throwP  = Math.min(elapsed / THROW_DURATION, 1)
        const launchM = Math.pow(Math.E, MULTIPLIER_SPEED * THROW_DURATION)
        // Burst: canvas spear travels 0→BURST_FRAC of its path during throwP SPEAR_RELEASE_P→1
        const burstT    = throwP < SPEAR_RELEASE_P ? 0
                        : throwP < 1               ? easeOut3((throwP - SPEAR_RELEASE_P) / (1 - SPEAR_RELEASE_P))
                        : 1
        const burstProg = burstT * BURST_FRAC
        // After throw ends, multiplier climbing moves spear the remaining path
        const spearMaxM = Math.max(curM * 3, 5)
        const spearProg = Math.max(0, (Math.log(Math.max(curM, launchM)) - Math.log(launchM))
                                    / (Math.log(Math.max(spearMaxM, launchM + 0.01)) - Math.log(launchM)))
        const totalProg = burstProg + spearProg * (1 - BURST_FRAC)
        const tipX = spearStartX + (spearEndX - spearStartX) * totalProg
        const tipY = spearStartY + (spearEndY - spearStartY) * totalProg

        if (throwP < 1) {
          const throwFrame = Math.min(Math.floor(throwP * SPRITE_THROW_COUNT), SPRITE_THROW_COUNT - 1)
          drawSpriteFrame(ctx, spriteRef.current, SPRITE_THROW_START + throwFrame, figX, gY, spriteH)
          // Canvas spear takes over the moment it exits the sprite's right edge
          if (throwP >= SPEAR_RELEASE_P) {
            drawSpearImage(ctx, spearImgRef.current, tipX, tipY, spearLen)
          }
        } else {
          // ── Ring hoops: one at a time, flying toward the spear ──
          hoopSpawnTimerRef.current -= dt

          // Spawn next ring when none is approaching and timer expired.
          // Rings start off-screen (prog > 1) and fly in from outside the canvas.
          const hasApproaching = hoopRef.current.some(h => h.phase === 'approach')
          if (!hasApproaching && hoopSpawnTimerRef.current <= 0) {
            // prog > 1.0 → position is beyond spearEnd, i.e. off the top-right edge
            const spawnProg = 1.12 + Math.random() * 0.18
            if (spawnProg > totalProg + 0.06) {
              hoopRef.current.push({
                prog: spawnProg,
                progSpeed: 0.00016 + Math.random() * 0.00010,
                phaseOffset: Math.random() * Math.PI * 2,
                shape: HOOP_SHAPES[Math.floor(Math.random() * HOOP_SHAPES.length)],
                phase: 'approach',
                burstAge: 0,
                hx: spearStartX + (spearEndX - spearStartX) * spawnProg,
                hy: spearStartY + (spearEndY - spearStartY) * spawnProg,
              })
            } else {
              // Spear is already far along — retry soon
              hoopSpawnTimerRef.current = 200
            }
          }

          // Advance each ring
          for (const hoop of hoopRef.current) {
            if (hoop.phase === 'approach') {
              hoop.prog -= hoop.progSpeed * dt   // ring flies toward spear (decreasing prog)
              hoop.hx = spearStartX + (spearEndX - spearStartX) * hoop.prog
              hoop.hy = spearStartY + (spearEndY - spearStartY) * hoop.prog
              // Hit: ring reached the spear tip
              if (hoop.prog <= totalProg + 0.012) {
                hoop.phase = 'burst'
                hoop.burstAge = 0
                emitSparks(particlesRef.current, hoop.hx, hoop.hy, 14, 95)
                hoopSpawnTimerRef.current = 1500 + Math.random() * 1500
              }
              // Missed: ring slipped behind spear (shouldn't happen normally)
              else if (hoop.prog < totalProg - 0.05) {
                hoop.phase = 'done'
                hoopSpawnTimerRef.current = 1200 + Math.random() * 800
              }
            } else if (hoop.phase === 'burst') {
              hoop.burstAge += dt
              if (hoop.burstAge > 420) hoop.phase = 'done'
            }
          }
          hoopRef.current = hoopRef.current.filter(h => h.phase !== 'done')

          trailRef.current.push({ x: tipX, y: tipY, t: Date.now() })
          if (trailRef.current.length > 80) trailRef.current.shift()
          drawTrail(ctx, trailRef.current)
          drawHoops(ctx, hoopRef.current, flyAngle)
          drawSpearImage(ctx, spearImgRef.current, tipX, tipY, spearLen)

          // Sparks from spear tip
          ringTimerRef.current += dt
          if (ringTimerRef.current > 60) {
            ringTimerRef.current = 0
            emitSparks(particlesRef.current, tipX, tipY, 1, 15 + curM * 2)
          }
          drawParticles(ctx, particlesRef.current)

          // Alternate between panting and sway while spear is flying
          // Randomly alternate panting (1-4 cycles) and sway (one round-trip)
          const PANT_ONE_MS    = (SPRITE_PANT_COUNT * 2 - 2) * 83              // one pant ping-pong
          const SWAY_FWD_MS    = SPRITE_SWAY_COUNT * 83                       // forward leg
          const SWAY_RT_MS     = SWAY_FWD_MS * 2 + SPRITE_SWAY_DELAY_MS      // fwd + hold + back
          const groundY        = gY + Math.round(spriteH * SPRITE_PANT_FOOT_GAP / 512)
          const now            = Date.now()
          if (!spearIdleRef.current)
            spearIdleRef.current = { mode: 'pant', start: now, cyclesLeft: Math.ceil(Math.random() * 4) }
          const idle = spearIdleRef.current
          const ageMs = now - idle.start
          if (idle.mode === 'pant') {
            if (ageMs >= idle.cyclesLeft * PANT_ONE_MS) {
              idle.mode = 'sway'; idle.start = now
              drawSpriteFrame(ctx, spriteRef.current, SPRITE_SWAY_START, figX, groundY, spriteH)
            } else {
              const pc = SPRITE_PANT_COUNT * 2 - 2
              const pf = Math.floor(ageMs / 83) % pc
              drawSpriteFrame(ctx, spriteRef.current, SPRITE_PANT_START + (pf < SPRITE_PANT_COUNT ? pf : pc - pf), figX, groundY, spriteH)
            }
          } else {
            if (ageMs >= SWAY_RT_MS) {
              idle.mode = 'pant'; idle.start = now; idle.cyclesLeft = Math.ceil(Math.random() * 4)
              drawSpriteFrame(ctx, spriteRef.current, SPRITE_PANT_START, figX, groundY, spriteH)
            } else {
              let sf
              if (ageMs < SWAY_FWD_MS) {
                sf = Math.floor(ageMs / 83)                                              // forward
              } else if (ageMs < SWAY_FWD_MS + SPRITE_SWAY_DELAY_MS) {
                sf = SPRITE_SWAY_COUNT - 1                                               // hold at 192
              } else {
                sf = Math.max(0, SPRITE_SWAY_COUNT - 1 - Math.floor((ageMs - SWAY_FWD_MS - SPRITE_SWAY_DELAY_MS) / 83))  // backward
              }
              drawSpriteFrame(ctx, spriteRef.current, SPRITE_SWAY_START + sf, figX, groundY, spriteH)
            }
          }

          // Multiplier label — offset perpendicular to spear (upper-left side), clamped to canvas
          const label = `${curM.toFixed(2)}x`
          ctx.save()
          const fontSize = Math.round(Math.max(8, Math.min(34, w / 10) * scale * distScale))
          ctx.font         = `bold ${fontSize}px Inter,sans-serif`
          ctx.textAlign    = 'center'
          ctx.textBaseline = 'middle'
          const textW  = ctx.measureText(label).width
          const pLen   = fontSize * 2.2
          // 90° CW from flight direction = upper-left of the spear tip
          const lx_raw = tipX + Math.sin(flyAngle) * pLen
          const ly_raw = tipY - Math.cos(flyAngle) * pLen
          const lx = Math.max(textW / 2 + 8, Math.min(lx_raw, w - textW / 2 - 8))
          const ly = Math.max(PAD_T + fontSize / 2 + 4, Math.min(ly_raw, h - fontSize / 2 - 4))
          // Wide glow halo
          ctx.shadowBlur   = 38; ctx.shadowColor = 'rgba(245,158,11,0.15)'
          ctx.fillStyle    = 'rgba(255, 162, 0, 0.48)'
          ctx.fillText(label, lx, ly)
          // Foreground
          ctx.shadowBlur   = 16; ctx.shadowColor = 'rgba(245,158,11,0.15)'
          ctx.fillStyle    = 'rgba(255, 162, 0, 0.48)'
          ctx.fillText(label, lx, ly)
          ctx.shadowBlur   = 0
          ctx.restore()
        }

        animRef.current = requestAnimationFrame(loop)
      }
      animRef.current = requestAnimationFrame(loop)
      return () => { cancelAnimationFrame(animRef.current); lastTsRef.current = null }
    }

    // ── CRASHED ──────────────────────────────────────────────
    if (phase === 'crashed') {
      crashTimeRef.current = Date.now()
      const pts    = pointsRef.current
      const finalM = crashPoint || 1.0
      const maxM   = Math.max(finalM * 1.18, 2.5)

      // Capture spear's last tip position for the fall animation
      crashSpearRef.current = null
      crashImpactFiredRef.current = false
      costumeRef.current = null   // trigger fresh pick next waiting phase
      if (trailRef.current.length > 0) {
        const last = trailRef.current[trailRef.current.length - 1]
        crashSpearRef.current = { tipX: last.x, tipY: last.y }
      }
      particlesRef.current = []

      // Spear falls then sticks at a realistic forward-lean angle (~40° from horizontal)
      const FALL_DUR    = 0.65
      const STUCK_ANGLE = Math.PI * 0.22   // ~40° from horizontal — tip forward in ground, tail up-left

      const loop = (ts) => {
        tRef.current++
        const dt  = lastTsRef.current ? ts - lastTsRef.current : 16; lastTsRef.current = ts
        const age = (Date.now() - crashTimeRef.current) / 1000
        const { width: w, height: h } = canvas
        const scale   = Math.min(1, Math.max(0.6, h / 320))
        const spriteH = Math.round(SPRITE_DISPLAY_H * scale)
        const distScaleAtCrash = Math.max(0.60, Math.pow(finalM, -0.07))
        const spearLen = Math.round(SPEAR_LEN * scale * distScaleAtCrash)

        updateParticles(particlesRef.current, dt)

        // Two-phase shake: hard initial crash jolt (0–0.12s) + ground-impact jolt (at FALL_DUR)
        let shakeX = 0, shakeY = 0
        const impactAge = age - FALL_DUR
        if (age < 0.35) {
          const amt = 10 * Math.pow(1 - age / 0.35, 2.2)
          shakeX = Math.sin(age * 310) * amt
          shakeY = Math.cos(age * 240) * amt
        } else if (impactAge >= 0 && impactAge < 0.25) {
          const amt = 7 * Math.pow(1 - impactAge / 0.25, 2.0)
          shakeX = Math.sin(impactAge * 280) * amt
          shakeY = Math.cos(impactAge * 220) * amt
        }

        const gY   = h - PAD_B
        const figX = PAD_L + 30

        ctx.save()
        ctx.translate(shakeX, shakeY)
        drawBackground(ctx, w, h, scrollRef.current)
        drawSpeedLines(ctx, w, h, scrollRef.current)
        drawAxes(ctx, w, h, maxM)
        drawGround(ctx, w, h, scrollRef.current)
        drawTrail(ctx, trailRef.current)

        // ── Falling / stuck spear ─────────────────────────────
        if (crashSpearRef.current) {
          const { tipX: crashTipX, tipY: crashTipY } = crashSpearRef.current
          const crashAngle = SPEAR_RELEASE_ANGLE

          // Compute center of spear at crash instant
          const crashCX = crashTipX - Math.cos(crashAngle) * spearLen / 2
          const crashCY = crashTipY - Math.sin(crashAngle) * spearLen / 2

          // Final (stuck) center: tip at ground, spear leaning forward at STUCK_ANGLE
          const stuckTipX = Math.min(crashCX + 55 + Math.cos(STUCK_ANGLE) * spearLen / 2, w - PAD_R - 10)
          const stuckCX   = stuckTipX - Math.cos(STUCK_ANGLE) * spearLen / 2
          const stuckCY   = gY - Math.sin(STUCK_ANGLE) * spearLen / 2

          if (age < FALL_DUR) {
            const t = age / FALL_DUR

            // Center follows a quadratic Bezier: slight upward kick at start (residual momentum),
            // then arcs down to the stuck position — mimics ballistic center-of-mass path
            const cpX = crashCX + (stuckCX - crashCX) * 0.28
            const cpY = crashCY - 22   // initial upward impulse from the throw
            const cx  = (1-t)*(1-t)*crashCX + 2*(1-t)*t*cpX + t*t*stuckCX
            const cy  = (1-t)*(1-t)*crashCY + 2*(1-t)*t*cpY + t*t*stuckCY

            // Smoothstep angle: nose rotates clockwise from -30° to +40°
            const ts    = t*t*(3-2*t)
            const angle = lerp(crashAngle, STUCK_ANGLE, ts)

            // Tip derived from center + half-length in flight direction
            drawSpearFall(ctx, spearImgRef.current,
              cx + Math.cos(angle) * spearLen / 2,
              cy + Math.sin(angle) * spearLen / 2,
              angle, spearLen)
          } else {
            // Spawn impact burst once the instant the spear hits the ground
            if (!crashImpactFiredRef.current) {
              crashImpactFiredRef.current = true
              emitGroundImpact(particlesRef.current, stuckTipX, gY)
            }

            // Stuck — small damped wobble like a vibrating javelin
            const wobbleAge = age - FALL_DUR
            const wobble    = Math.sin(wobbleAge * 16) * 0.03 * Math.exp(-wobbleAge * 5)
            drawSpearFall(ctx, spearImgRef.current, stuckTipX, gY, STUCK_ANGLE + wobble, spearLen)

            // Ground impact ring — expands and fades out
            const impactT = Math.min(1, wobbleAge / 0.4)
            if (impactT < 1) {
              ctx.save()
              ctx.globalAlpha = Math.pow(1 - impactT, 1.4) * 0.7
              ctx.strokeStyle = 'rgba(200,160,100,1)'
              ctx.lineWidth   = 2.5
              ctx.shadowBlur  = 10; ctx.shadowColor = 'rgba(245,158,11,0.6)'
              ctx.beginPath()
              ctx.ellipse(stuckTipX, gY, 40 * impactT, 12 * impactT, 0, 0, Math.PI * 2)
              ctx.stroke()
              ctx.shadowBlur = 0
              ctx.restore()
            }
          }
        }

        drawParticles(ctx, particlesRef.current)
        ctx.restore()

        // White flash at crash → fades to red → gone by 0.35s
        if (age < 0.35) {
          const t = age / 0.35
          // White component: sharp peak at t=0, gone by t=0.25
          const whiteA = age < 0.08 ? (1 - age / 0.08) * 0.6 : 0
          if (whiteA > 0) {
            ctx.fillStyle = `rgba(255,255,255,${whiteA.toFixed(3)})`
            ctx.fillRect(0, 0, w, h)
          }
          // Red flash: peaks around t=0.12, fades out
          const redA = Math.pow(Math.max(0, 1 - Math.abs(t - 0.35) / 0.65), 2.2) * 0.45
          if (redA > 0.01) {
            ctx.fillStyle = `rgba(220,10,10,${redA.toFixed(3)})`
            ctx.fillRect(0, 0, w, h)
          }
        }

        // Second flash at ground impact
        if (impactAge >= 0 && impactAge < 0.18) {
          const impA = Math.pow(1 - impactAge / 0.18, 2.5) * 0.28
          ctx.fillStyle = `rgba(230,120,20,${impA.toFixed(3)})`
          ctx.fillRect(0, 0, w, h)
        }

        // Dark red vignette — deepens after crash
        const vigA = Math.min(1, age / 0.5) * 0.55
        const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.22, w / 2, h / 2, h * 0.95)
        vig.addColorStop(0, 'rgba(0,0,0,0)')
        vig.addColorStop(1, `rgba(80,0,0,${vigA.toFixed(3)})`)
        ctx.fillStyle = vig
        ctx.fillRect(0, 0, w, h)

        // After-crash animation: plays once then holds on last frame
        ctx.save()
        ctx.translate(shakeX, shakeY)
        const acFrame = Math.min(Math.floor(age * 1000 / 42), SPRITE_AFTERCRASH_COUNT - 1)
        const acH     = Math.round(spriteH * SPRITE_RUN_CONTENT_H / SPRITE_AFTERCRASH_CONTENT_H[acFrame])
        drawSpriteFrame(ctx, spriteRef.current, SPRITE_AFTERCRASH_START + acFrame, figX, gY + Math.round(spriteH * SPRITE_AFTERCRASH_FOOT_GAP / 512), acH)
        ctx.restore()

        // ── "Rise is over" — punch-in + steady glow ──
        const textAge   = Math.max(0, age - 0.05)
        const textAlpha = Math.min(1, textAge / 0.12)
        const textScale = textAge < 0.22
          ? 1 + 1.5 * Math.pow(1 - textAge / 0.22, 2.5)
          : 1.0
        const tx = w * 0.55
        const ty = h * 0.35

        ctx.save()
        ctx.globalAlpha  = textAlpha
        ctx.translate(tx, ty)
        ctx.scale(textScale, textScale)
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.font         = `bold ${Math.round(38 * scale)}px Inter,sans-serif`
        ctx.shadowBlur   = 28; ctx.shadowColor = 'rgba(239,68,68,0.9)'
        ctx.fillStyle    = '#ef4444'
        ctx.fillText('Rise is over', 0, 0)
        ctx.shadowBlur   = 0
        ctx.restore()

        // ── Crash multiplier — gold, appears 0.12s after title ──
        const multAge   = Math.max(0, age - 0.17)
        const multAlpha = Math.min(1, multAge / 0.12)
        const multScale = multAge < 0.18
          ? 1 + 1.2 * Math.pow(1 - multAge / 0.18, 2.5)
          : 1.0

        ctx.save()
        ctx.globalAlpha  = multAlpha
        ctx.translate(tx, ty + Math.round(52 * scale))
        ctx.scale(multScale, multScale)
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.font         = `bold ${Math.round(28 * scale)}px Inter,sans-serif`
        ctx.shadowBlur   = 20; ctx.shadowColor = 'rgba(239,68,68,0.9)'
        ctx.fillStyle    = '#ef4444'
        ctx.fillText(`${finalM.toFixed(2)}x`, 0, 0)
        ctx.shadowBlur   = 0
        ctx.restore()

        animRef.current = requestAnimationFrame(loop)
      }
      animRef.current = requestAnimationFrame(loop)
      return () => { cancelAnimationFrame(animRef.current); lastTsRef.current = null }
    }
  }, [phase, crashPoint, countdown])

  return (
    <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}
