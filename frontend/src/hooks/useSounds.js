import { useRef, useState, useCallback, useEffect } from 'react'

// ── Audio context (singleton) ─────────────────────────────────────────────
let _ctx = null
function getCtx() {
  if (!_ctx || _ctx.state === 'closed')
    _ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

// ── Background music state (module-level so it survives re-renders) ───────
let _bgOscillators = []
let _bgMaster = null

function _startBg(ctx) {
  if (_bgOscillators.length > 0) return

  // Master output with slow fade-in
  _bgMaster = ctx.createGain()
  _bgMaster.gain.value = 0
  _bgMaster.connect(ctx.destination)
  _bgMaster.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 3.5)

  // Low-frequency oscillator modulates master volume (0.07 Hz ≈ 14-second swell)
  const lfo = ctx.createOscillator()
  const lfoAmt = ctx.createGain()
  lfo.type = 'sine'
  lfo.frequency.value = 0.07
  lfoAmt.gain.value = 0.018
  lfo.connect(lfoAmt)
  lfoAmt.connect(_bgMaster.gain)

  // Helper: create one voice and wire it
  function voice(type, freq, detune, gain) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    osc.detune.value = detune ?? 0
    g.gain.value = gain
    osc.connect(g)
    g.connect(_bgMaster)
    osc.start()
    return osc
  }

  // Tense minor-chord drone: root + min-3rd + 5th across three octaves
  const v1  = voice('sine',     55,    0,   0.80)  // A1 root — deep bass
  const v2  = voice('sine',     55.25, 0,   0.40)  // A1 detuned — slow beating pulse
  const v3  = voice('triangle', 110,   0,   0.28)  // A2 octave
  const v4  = voice('sine',     130.8, 0,   0.20)  // C3 minor 3rd
  const v5  = voice('triangle', 165,   0,   0.14)  // E3 perfect 5th
  const v6  = voice('sine',     220,  -8,   0.08)  // A3 — slight detune shimmer
  const v7  = voice('sine',     261.6, 0,   0.04)  // C4 very quiet top layer

  lfo.start()
  _bgOscillators = [v1, v2, v3, v4, v5, v6, v7, lfo]
}

function _stopBg() {
  if (!_bgOscillators.length) return
  const master = _bgMaster
  const oscs = _bgOscillators
  _bgOscillators = []
  _bgMaster = null

  if (master && _ctx) {
    try {
      master.gain.cancelScheduledValues(_ctx.currentTime)
      master.gain.linearRampToValueAtTime(0, _ctx.currentTime + 1.2)
    } catch {}
  }
  setTimeout(() => oscs.forEach(o => { try { o.stop() } catch {} }), 1300)
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useSounds() {
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('spear_muted') === 'true' } catch { return false }
  })
  const mutedRef = useRef(muted)

  // Keep bg music running / stopped in sync with mute state
  useEffect(() => {
    if (!muted) {
      // Don't auto-start here — wait for first user interaction via play()
    } else {
      _stopBg()
    }
  }, [muted])

  // Stop bg on unmount
  useEffect(() => () => _stopBg(), [])

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      mutedRef.current = next
      try { localStorage.setItem('spear_muted', String(next)) } catch {}
      if (next) _stopBg()
      return next
    })
  }, [])

  // Core play helper — also boots background music on first real sound
  const play = useCallback((fn) => {
    if (mutedRef.current) return
    try {
      const ctx = getCtx()
      fn(ctx)
      _startBg(ctx)   // no-op if already running
    } catch {}
  }, [])

  // ── Explicitly start / stop bg (for external control) ──────────────────
  const startBgMusic = useCallback(() => {
    if (mutedRef.current) return
    try { _startBg(getCtx()) } catch {}
  }, [])

  const stopBgMusic = useCallback(() => _stopBg(), [])

  // ── Bet placed — soft two-note chime (replaces old 880 Hz ping) ─────────
  const playBetPlaced = useCallback(() => play(ctx => {
    [330, 494].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.08
      gain.gain.setValueAtTime(0.10, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.2)
    })
  }), [play])

  // ── Round start — impact thud + upward sweep + shimmer tail ─────────────
  const playRoundStart = useCallback(() => play(ctx => {
    const now = ctx.currentTime

    // Low thud
    const thud = ctx.createOscillator()
    const thudG = ctx.createGain()
    thud.type = 'sine'
    thud.frequency.setValueAtTime(90, now)
    thud.frequency.exponentialRampToValueAtTime(30, now + 0.18)
    thudG.gain.setValueAtTime(0.55, now)
    thudG.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
    thud.connect(thudG); thudG.connect(ctx.destination)
    thud.start(now); thud.stop(now + 0.25)

    // Mid sweep
    const sweep = ctx.createOscillator()
    const sweepG = ctx.createGain()
    sweep.type = 'sawtooth'
    sweep.frequency.setValueAtTime(180, now + 0.04)
    sweep.frequency.exponentialRampToValueAtTime(900, now + 0.42)
    sweepG.gain.setValueAtTime(0, now)
    sweepG.gain.linearRampToValueAtTime(0.13, now + 0.07)
    sweepG.gain.exponentialRampToValueAtTime(0.001, now + 0.48)
    sweep.connect(sweepG); sweepG.connect(ctx.destination)
    sweep.start(now + 0.04); sweep.stop(now + 0.5)

    // High shimmer trail
    ;[1100, 1650].forEach((f, i) => {
      const s = ctx.createOscillator()
      const sg = ctx.createGain()
      s.type = 'sine'; s.frequency.value = f
      const t0 = now + 0.18 + i * 0.06
      sg.gain.setValueAtTime(0.07 - i * 0.02, t0)
      sg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5)
      s.connect(sg); sg.connect(ctx.destination)
      s.start(t0); s.stop(t0 + 0.55)
    })
  }), [play])

  // ── Ring pass — metallic zing at multiplier milestones ──────────────────
  const playRingPass = useCallback((multiplier = 2) => play(ctx => {
    const now = ctx.currentTime
    // Pitch scales slightly with milestone
    const base = 700 + Math.log2(multiplier) * 120

    // Metallic partials (inharmonic = bell-like)
    ;[1, 1.52, 2.18, 3.0].forEach((ratio, i) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = base * ratio
      g.gain.setValueAtTime(0.18 / (i + 1), now)
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5 - i * 0.06)
      osc.connect(g); g.connect(ctx.destination)
      osc.start(now); osc.stop(now + 0.55)
    })

    // Quick downward whip for the "passing through" sensation
    const whip = ctx.createOscillator()
    const wg = ctx.createGain()
    whip.type = 'sawtooth'
    whip.frequency.setValueAtTime(2200, now)
    whip.frequency.exponentialRampToValueAtTime(350, now + 0.09)
    wg.gain.setValueAtTime(0.09, now)
    wg.gain.exponentialRampToValueAtTime(0.001, now + 0.11)
    whip.connect(wg); wg.connect(ctx.destination)
    whip.start(now); whip.stop(now + 0.12)
  }), [play])

  // ── Cashout — ascending major arpeggio with harmonics ───────────────────
  const playCashout = useCallback(() => play(ctx => {
    const now = ctx.currentTime
    // C5 E5 G5 C6
    ;[523, 659, 784, 1047].forEach((freq, i) => {
      const t = now + i * 0.09

      // Fundamental
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'; osc.frequency.value = freq
      g.gain.setValueAtTime(0.28, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
      osc.connect(g); g.connect(ctx.destination)
      osc.start(t); osc.stop(t + 0.42)

      // Octave overtone
      const osc2 = ctx.createOscillator()
      const g2 = ctx.createGain()
      osc2.type = 'triangle'; osc2.frequency.value = freq * 2
      g2.gain.setValueAtTime(0.07, t)
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
      osc2.connect(g2); g2.connect(ctx.destination)
      osc2.start(t); osc2.stop(t + 0.2)
    })
  }), [play])

  // ── Crash — deep boom + crack + filtered noise ───────────────────────────
  const playCrash = useCallback(() => play(ctx => {
    const now = ctx.currentTime

    // Sub boom
    const boom = ctx.createOscillator()
    const boomG = ctx.createGain()
    boom.type = 'sine'
    boom.frequency.setValueAtTime(110, now)
    boom.frequency.exponentialRampToValueAtTime(18, now + 0.7)
    boomG.gain.setValueAtTime(0.65, now)
    boomG.gain.exponentialRampToValueAtTime(0.001, now + 0.75)
    boom.connect(boomG); boomG.connect(ctx.destination)
    boom.start(now); boom.stop(now + 0.8)

    // Mid crack
    const crack = ctx.createOscillator()
    const crackG = ctx.createGain()
    crack.type = 'square'
    crack.frequency.setValueAtTime(220, now)
    crack.frequency.exponentialRampToValueAtTime(40, now + 0.12)
    crackG.gain.setValueAtTime(0.30, now)
    crackG.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    crack.connect(crackG); crackG.connect(ctx.destination)
    crack.start(now); crack.stop(now + 0.18)

    // Shaped noise burst (pre-shaped amplitude in buffer)
    const frames = Math.floor(ctx.sampleRate * 0.4)
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < frames; i++)
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 1.8)
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    const filt = ctx.createBiquadFilter()
    filt.type = 'lowpass'; filt.frequency.value = 900
    const noiseG = ctx.createGain()
    noiseG.gain.setValueAtTime(0.35, now)
    noiseG.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
    noise.connect(filt); filt.connect(noiseG); noiseG.connect(ctx.destination)
    noise.start(now)
  }), [play])

  return {
    muted, toggleMute,
    startBgMusic, stopBgMusic,
    playBetPlaced, playRoundStart, playRingPass, playCashout, playCrash,
  }
}
