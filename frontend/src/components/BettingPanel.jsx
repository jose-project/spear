import { useState, useEffect } from 'react'
import styles from './BettingPanel.module.css'

const SLOTS = [
  { label: 'Bet 1', color: '#00cfb4', rgb: '0,207,180' },
  { label: 'Bet 2', color: '#8b5cf6', rgb: '139,92,246' },
  { label: 'Bet 3', color: '#f59e0b', rgb: '245,158,11' },
]

function BetSlot({
  color, rgb,
  phase, balance, multiplier,
  betAmount, setBetAmount,
  autoCashout, setAutoCashout,
  autoCashoutEnabled, setAutoCashoutEnabled,
  autoBet, setAutoBet, autoBetCount, autoBetLimit, setAutoBetLimit, resetAutoBetCount,
  betPlaced, cashedOut, cashedOutAt, lastWin,
  placeBet, cashOut,
  nextRoundBet, setNextRoundBet,
}) {
  const canBet     = phase === 'waiting' && !betPlaced && !autoBet
  const canCashOut = phase === 'running' && betPlaced && !cashedOut
  const running    = phase === 'running'
  const crashed    = phase === 'crashed'

  const [autoBetOpen, setAutoBetOpen] = useState(autoBet)
  useEffect(() => { if (autoBet) setAutoBetOpen(true) }, [autoBet])

  function handleBetInput(e) {
    const val = parseFloat(e.target.value)
    if (!isNaN(val) && val >= 0) setBetAmount(val)
  }

  function stepBet(delta) {
    if (betPlaced) return
    setBetAmount(prev => Math.max(1, parseFloat((prev + delta).toFixed(2))))
  }

  function adjustBet(type) {
    if (betPlaced) return
    if (type === 'half')   setBetAmount(prev => Math.max(1, parseFloat((prev / 2).toFixed(2))))
    if (type === 'double') setBetAmount(prev => Math.min(balance, parseFloat((prev * 2).toFixed(2))))
    if (type === 'max')    setBetAmount(Math.max(1, parseFloat(balance.toFixed(2))))
  }

  function handleAutoBetToggle(enabled) {
    setAutoBetOpen(enabled)
    if (!enabled && autoBet) setAutoBet(false)
  }

  const potentialWin = (betAmount * (multiplier || 1)).toFixed(2)

  return (
    <div className={styles.slot} style={{ '--accent': color, '--accent-rgb': rgb }}>

      {/* Bet Amount */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.label}>Bet Amount</span>
          <span className={styles.balanceHint}>Bal: {balance?.toFixed(2)}</span>
        </div>
        <div className={styles.amountRow}>
          <button className={styles.stepBtn} onClick={() => stepBet(-1)} disabled={betPlaced}>−</button>
          <input
            type="number"
            className={styles.amountInput}
            value={betAmount}
            onChange={handleBetInput}
            min={1}
            max={balance}
            step={1}
            disabled={betPlaced}
          />
          <button className={styles.stepBtn} onClick={() => stepBet(1)} disabled={betPlaced}>+</button>
        </div>
        <div className={styles.adjRow}>
          <button className={styles.adjBtn} onClick={() => adjustBet('half')}   disabled={betPlaced}>½</button>
          <button className={styles.adjBtn} onClick={() => adjustBet('double')} disabled={betPlaced}>2×</button>
          <button className={styles.adjBtn} onClick={() => adjustBet('max')}    disabled={betPlaced}>Max</button>
        </div>
      </div>

      {/* Auto Cash Out */}
      <div className={styles.section}>
        <div className={styles.toggleRow}>
          <label className={styles.label}>Auto Cash Out</label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={autoCashoutEnabled}
              onChange={e => setAutoCashoutEnabled(e.target.checked)}
              disabled={running && betPlaced}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
        {autoCashoutEnabled && (
          <div className={styles.inputWrap}>
            <input
              type="number"
              className={styles.targetInput}
              placeholder="1.50"
              value={autoCashout}
              onChange={e => setAutoCashout(e.target.value)}
              min={1.01}
              step={0.01}
              disabled={running && betPlaced}
            />
            <span className={styles.inputSuffix}>×</span>
          </div>
        )}
      </div>

      {/* Auto Bet */}
      <div className={styles.section}>
        <div className={styles.toggleRow}>
          <label className={styles.label}>Auto Bet</label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={autoBetOpen}
              onChange={e => handleAutoBetToggle(e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
        {autoBetOpen && (
          !autoBet ? (
            <>
              <div className={styles.autoBetLimitRow}>
                <label className={styles.label}>Rounds</label>
                <input
                  type="number"
                  inputMode="numeric"
                  className={styles.autoBetLimitInput}
                  value={autoBetLimit === 0 ? '' : autoBetLimit}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10)
                    const newLimit = isNaN(v) || v < 1 ? 0 : v
                    setAutoBetLimit(newLimit)
                    if (newLimit > 0) resetAutoBetCount()
                  }}
                  placeholder="∞"
                  step={1}
                />
              </div>
              <button
                className={`${styles.actionBtn} ${styles.autoBetStartBtn}`}
                onClick={() => {
                  resetAutoBetCount()
                  setAutoBet(true)
                  if (phase === 'waiting' && !betPlaced) placeBet()
                }}
              >
                Start Auto Bet
              </button>
            </>
          ) : (
            <>
              <div className={styles.autoBetStatus}>
                <span className={styles.autoBetDot} />
                <span>Auto betting</span>
                {autoBetLimit > 0
                  ? <span className={styles.autoBetCount}>{autoBetCount} / {autoBetLimit}</span>
                  : autoBetCount > 0 && <span className={styles.autoBetCount}>{autoBetCount}</span>}
              </div>
              <button
                className={`${styles.actionBtn} ${styles.autoBetStopBtn}`}
                onClick={() => setAutoBet(false)}
              >
                Stop Auto Bet
              </button>
            </>
          )
        )}
      </div>

      {/* Action area */}
      <div className={styles.actionArea}>
        {canBet && (
          <button className={`${styles.actionBtn} ${styles.placeBetBtn}`} onClick={placeBet}>
            Place Bet
          </button>
        )}

        {phase === 'waiting' && betPlaced && (
          <div className={styles.betPlacedBadge}>
            <span className={styles.betPlacedDot} />
            <span>Bet placed — waiting for round</span>
          </div>
        )}

        {canCashOut && (
          <button className={`${styles.actionBtn} ${styles.cashoutBtn}`} onClick={cashOut}>
            <span className={styles.cashoutLabel}>Cash Out</span>
            <span className={styles.cashoutAmount}>{potentialWin}</span>
          </button>
        )}

        {running && betPlaced && cashedOut && (
          <div className={styles.cashedOutInfo}>
            <span className={styles.cashedOutLabel}>Cashed Out</span>
            <span className={styles.cashedOutMult}>{cashedOutAt?.toFixed(2)}×</span>
            <span className={styles.cashedOutWin}>+C {lastWin?.toFixed(2)}</span>
          </div>
        )}

        {(running || crashed) && !betPlaced && !autoBet && (
          !nextRoundBet ? (
            <button
              className={`${styles.actionBtn} ${styles.nextRoundBtn}`}
              onClick={() => setNextRoundBet(true)}
            >
              Bet Next Round
            </button>
          ) : (
            <div className={styles.nextRoundQueued}>
              <div className={styles.nextRoundQueuedLeft}>
                <span className={styles.nextRoundDot} />
                <span>Queued for next round</span>
              </div>
              <button className={styles.nextRoundCancel} onClick={() => setNextRoundBet(false)}>Cancel</button>
            </div>
          )
        )}
      </div>

    </div>
  )
}

export default function BettingPanel({
  phase, balance, multiplier,
  betAmount, setBetAmount,
  autoCashout, setAutoCashout,
  autoCashoutEnabled, setAutoCashoutEnabled,
  autoBet, setAutoBet, autoBetCount, autoBetLimit, setAutoBetLimit, resetAutoBetCount,
  betPlaced, cashedOut, cashedOutAt, lastWin,
  placeBet, cancelBet, cashOut,
  nextRoundBet, setNextRoundBet,
  bet2Amount, setBet2Amount,
  autoCashout2, setAutoCashout2,
  autoCashout2Enabled, setAutoCashout2Enabled,
  autoBet2, setAutoBet2, autoBetCount2, autoBetLimit2, setAutoBetLimit2, resetAutoBetCount2,
  bet2Placed, cashedOut2, cashedOut2At, lastWin2,
  placeBet2, cancelBet2, cashOut2,
  nextRoundBet2, setNextRoundBet2,
  bet3Amount, setBet3Amount,
  autoCashout3, setAutoCashout3,
  autoCashout3Enabled, setAutoCashout3Enabled,
  autoBet3, setAutoBet3, autoBetCount3, autoBetLimit3, setAutoBetLimit3, resetAutoBetCount3,
  bet3Placed, cashedOut3, cashedOut3At, lastWin3,
  placeBet3, cancelBet3, cashOut3,
  nextRoundBet3, setNextRoundBet3,
}) {
  const [activeSlot, setActiveSlot] = useState(0)

  const activePlaced = [betPlaced, bet2Placed, bet3Placed]

  const slotProps = [
    {
      phase, balance, multiplier,
      betAmount, setBetAmount, autoCashout, setAutoCashout,
      autoCashoutEnabled, setAutoCashoutEnabled,
      autoBet, setAutoBet, autoBetCount, autoBetLimit, setAutoBetLimit, resetAutoBetCount,
      betPlaced, cashedOut, cashedOutAt, lastWin,
      placeBet, cashOut, nextRoundBet, setNextRoundBet,
    },
    {
      phase, balance, multiplier,
      betAmount: bet2Amount, setBetAmount: setBet2Amount,
      autoCashout: autoCashout2, setAutoCashout: setAutoCashout2,
      autoCashoutEnabled: autoCashout2Enabled, setAutoCashoutEnabled: setAutoCashout2Enabled,
      autoBet: autoBet2, setAutoBet: setAutoBet2, autoBetCount: autoBetCount2,
      autoBetLimit: autoBetLimit2, setAutoBetLimit: setAutoBetLimit2, resetAutoBetCount: resetAutoBetCount2,
      betPlaced: bet2Placed, cashedOut: cashedOut2, cashedOutAt: cashedOut2At, lastWin: lastWin2,
      placeBet: placeBet2, cashOut: cashOut2, nextRoundBet: nextRoundBet2, setNextRoundBet: setNextRoundBet2,
    },
    {
      phase, balance, multiplier,
      betAmount: bet3Amount, setBetAmount: setBet3Amount,
      autoCashout: autoCashout3, setAutoCashout: setAutoCashout3,
      autoCashoutEnabled: autoCashout3Enabled, setAutoCashoutEnabled: setAutoCashout3Enabled,
      autoBet: autoBet3, setAutoBet: setAutoBet3, autoBetCount: autoBetCount3,
      autoBetLimit: autoBetLimit3, setAutoBetLimit: setAutoBetLimit3, resetAutoBetCount: resetAutoBetCount3,
      betPlaced: bet3Placed, cashedOut: cashedOut3, cashedOutAt: cashedOut3At, lastWin: lastWin3,
      placeBet: placeBet3, cashOut: cashOut3, nextRoundBet: nextRoundBet3, setNextRoundBet: setNextRoundBet3,
    },
  ]

  return (
    <div className={styles.panel}>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        {SLOTS.map((s, i) => (
          <button
            key={i}
            className={`${styles.tab} ${activeSlot === i ? styles.tabActive : ''}`}
            style={activeSlot === i ? { '--tab-color': s.color, '--tab-rgb': s.rgb } : {}}
            onClick={() => setActiveSlot(i)}
          >
            {activePlaced[i] && (
              <span className={styles.tabDot} style={{ background: s.color }} />
            )}
            {s.label}
          </button>
        ))}
      </div>

      {/* Active bet slot */}
      <BetSlot
        key={activeSlot}
        color={SLOTS[activeSlot].color}
        rgb={SLOTS[activeSlot].rgb}
        {...slotProps[activeSlot]}
      />

    </div>
  )
}
