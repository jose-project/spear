import { useRef, useState, useCallback } from 'react'

let _audioCtx = null

function getCtx() {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume()
  return _audioCtx
}

export function useSounds() {
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('spear_muted') === 'true' } catch { return false }
  })
  const mutedRef = useRef(muted)

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      mutedRef.current = next
      try { localStorage.setItem('spear_muted', String(next)) } catch {}
      return next
    })
  }, [])

  const play = useCallback((fn) => {
    if (mutedRef.current) return
    try { fn(getCtx()) } catch {}
  }, [])

  const playBetPlaced = useCallback(() => play(ctx => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.12)
  }), [play])

  const playRoundStart = useCallback(() => play(ctx => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(220, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(550, ctx.currentTime + 0.35)
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.45)
  }), [play])

  const playCashout = useCallback(() => play(ctx => {
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.1
      gain.gain.setValueAtTime(0.35, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      osc.start(t)
      osc.stop(t + 0.3)
    })
  }), [play])

  const playCrash = useCallback(() => play(ctx => {
    const bufferSize = Math.floor(ctx.sampleRate * 0.5)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const noiseGain = ctx.createGain()
    noise.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noiseGain.gain.setValueAtTime(0.4, ctx.currentTime)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    noise.start(ctx.currentTime)

    const osc = ctx.createOscillator()
    const thudGain = ctx.createGain()
    osc.type = 'sine'
    osc.connect(thudGain)
    thudGain.connect(ctx.destination)
    osc.frequency.setValueAtTime(180, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.4)
    thudGain.gain.setValueAtTime(0.6, ctx.currentTime)
    thudGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  }), [play])

  return { muted, toggleMute, playBetPlaced, playRoundStart, playCashout, playCrash }
}
