import { useState, useEffect, useRef } from 'react'
import { useCrashGame } from './useCrashGame'
import { useAuth } from '../contexts/AuthContext'
import { useSounds } from '../hooks/useSounds'
import CrashGraph from './CrashGraph'
import companyLogo from '../assets/company_logo.png'
import BettingPanel from './BettingPanel'
import GameHistory from './GameHistory'
import BetHistory from './BetHistory'
import LiveBets from './LiveBets'
import AuthModal from './AuthModal'
import styles from './CrashGame.module.css'

export default function CrashGame() {
  const game = useCrashGame()
  const { user, logout, demoMode, demoBalance, enterDemo, updateDemoBalance } = useAuth()
  const { muted, toggleMute, playBetPlaced, playRoundStart, playCashout, playCrash } = useSounds()
  const [showAuth, setShowAuth] = useState(false)
  const [activeTab, setActiveTab] = useState('my')

  const {
    phase, multiplier, crashPoint, countdown,
    history, betHistory, liveBets, betPlaced, cashedOut, cashedOutAt,
    cashedOut2, cashedOut3,
    error, connected,
  } = game

  const prevPhaseRef = useRef(null)
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase
    if (prev === null) return
    if (phase === 'running') playRoundStart()
    else if (phase === 'crashed') playCrash()
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const prevBetPlacedRef = useRef(betPlaced)
  useEffect(() => {
    if (!prevBetPlacedRef.current && betPlaced) playBetPlaced()
    prevBetPlacedRef.current = betPlaced
  }, [betPlaced]) // eslint-disable-line react-hooks/exhaustive-deps

  const prevCashedOutRef = useRef(cashedOut)
  useEffect(() => {
    if (!prevCashedOutRef.current && cashedOut) playCashout()
    prevCashedOutRef.current = cashedOut
  }, [cashedOut]) // eslint-disable-line react-hooks/exhaustive-deps

  const prevCashedOut2Ref = useRef(cashedOut2)
  useEffect(() => {
    if (!prevCashedOut2Ref.current && cashedOut2) playCashout()
    prevCashedOut2Ref.current = cashedOut2
  }, [cashedOut2]) // eslint-disable-line react-hooks/exhaustive-deps

  const prevCashedOut3Ref = useRef(cashedOut3)
  useEffect(() => {
    if (!prevCashedOut3Ref.current && cashedOut3) playCashout()
    prevCashedOut3Ref.current = cashedOut3
  }, [cashedOut3]) // eslint-disable-line react-hooks/exhaustive-deps


  function multClass() {
    if (phase === 'crashed') return styles.red
    if (phase === 'waiting') return styles.muted
    if (cashedOut) return styles.green
    if (multiplier >= 10) return styles.purple
    if (multiplier >= 2) return styles.yellow
    return styles.green
  }

  const displayValue = phase === 'crashed'
    ? `${crashPoint?.toFixed(2)}×`
    : `${multiplier.toFixed(2)}×`

  return (
    <div className={styles.root}>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <img src={companyLogo} alt="Spear Rush" className={styles.logoIcon} />
          <span className={styles.logoText}>Spear Rush</span>
        </div>

        <div className={styles.headerRight}>
          <button
            className={`${styles.muteBtn} ${!muted ? styles.muteBtnActive : ''}`}
            onClick={toggleMute}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {muted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            )}
          </button>

          {user ? (
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.username}</span>
              <span className={styles.userBalance}>
                {Number(user.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <button className={styles.logoutBtn} onClick={logout}>Logout</button>
            </div>
          ) : demoMode ? (
            <div className={styles.userInfo}>
              <span className={styles.demoBadge}>DEMO</span>
              <span className={styles.userBalance}>
                {Number(demoBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {demoBalance < 5 && (
                <button className={styles.resetDemoBtn} onClick={() => updateDemoBalance(1000)}>Reset</button>
              )}
              <button className={styles.loginBtn} onClick={() => setShowAuth(true)}>Connect</button>
            </div>
          ) : (
            <div className={styles.headerActions}>
              <button className={styles.demoBtn} onClick={enterDemo}>Play Demo</button>
              <button className={styles.loginBtn} onClick={() => setShowAuth(true)}>Connect</button>
            </div>
          )}
        </div>
      </header>

      {/* Crash history chips */}
      <div className={styles.historyBar}>
        <GameHistory history={history} />
      </div>

      {/* Error toast */}
      {error && (
        <div className={styles.errorToast}>{error}</div>
      )}

      {/* Main body */}
      <div className={styles.body}>

        {/* Graph card */}
        <div className={styles.graphCard}>
          <CrashGraph phase={phase} multiplier={multiplier} crashPoint={crashPoint} countdown={countdown} />

          <div className={styles.badgeOverlay}>
            {phase === 'waiting' && betPlaced && (
              <span className={styles.betBadge}>Bet placed ✓</span>
            )}
            {phase === 'running' && cashedOut && (
              <div className={styles.cashoutSub}>
                Cashed out @ {cashedOutAt?.toFixed(2)}×
              </div>
            )}
          </div>
        </div>

        {/* Round status + betting panel */}
        <div className={styles.panelCol}>

          {/* Round status — visible to everyone */}
          <div className={styles.roundStatus}>

            <div className={styles.statusRow}>
              <div className={`${styles.statusBadge} ${
                phase === 'running' ? styles.badgeRunning :
                phase === 'crashed' ? styles.badgeCrashed :
                styles.badgeWaiting
              }`}>
                <div className={`${styles.statusDot} ${
                  phase === 'running' ? styles.dotRunning :
                  phase === 'crashed' ? styles.dotCrashed :
                  styles.dotWaiting
                }`} />
                <span className={styles.statusText}>Round Status</span>
              </div>
              {phase === 'running' && (
                <div className={styles.liveIndicator}>
                  <span className={styles.liveText}>LIVE</span>
                </div>
              )}
            </div>

            <div className={styles.multiplierSection}>
              <div className={styles.multiplierLabel}>Multiplier</div>
              <div>
                <span className={`${styles.multiplierValue} ${
                  phase === 'running' ? styles.multRunning :
                  phase === 'crashed' ? styles.multCrashed :
                  styles.multWaiting
                }`}>
                  {phase === 'crashed' ? crashPoint?.toFixed(2) : multiplier.toFixed(2)}
                </span>
                <span className={`${styles.multiplierSymbol} ${
                  phase === 'running' ? styles.multRunning :
                  phase === 'crashed' ? styles.multCrashed :
                  styles.multWaiting
                }`}>×</span>
              </div>
            </div>
{/* 
            <div className={styles.infoRow}>
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>Status</div>
                <div className={styles.infoValue}>
                  {phase === 'waiting' ? 'Waiting' : phase === 'running' ? 'Live' : 'Crashed'}
                </div>
              </div>
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>{phase === 'waiting' ? 'Starting In' : 'Multiplier'}</div>
                <div className={styles.infoValue}>
                  {phase === 'waiting'
                    ? `${countdown.toFixed(1)}s`
                    : phase === 'crashed'
                    ? `${crashPoint?.toFixed(2)}×`
                    : `${multiplier.toFixed(2)}×`}
                </div>
              </div>
            </div> */}

          </div>

          {/* Betting controls (logged in or demo) or login prompt */}
          {(user || demoMode) ? (
            <BettingPanel {...game} />
          ) : (
            <div className={styles.loginPrompt}>
              <img src={companyLogo} alt="Spear" className={styles.loginPromptLogo} />
              <p>Login or create an account to place bets and track your balance.</p>
              <button className={styles.loginPromptBtn} onClick={() => setShowAuth(true)}>
                Connect
              </button>
              <div className={styles.demoSeparator}><span>or</span></div>
              <button className={styles.demoBtn} onClick={enterDemo}>
                Play Demo
              </button>
              <p className={styles.demoNote}>Try with 1,000 demo coins — no account needed</p>
            </div>
          )}

        </div>

        {/* Bet history */}
        <div className={styles.historyCard}>
          <div className={styles.historyCardHeader}>
            <div className={styles.historyTabs}>
              <button
                className={`${styles.historyTab} ${activeTab === 'my' ? styles.historyTabActive : ''}`}
                onClick={() => setActiveTab('my')}
              >
                My Bets
                {betHistory.length > 0 && <span className={styles.tabCount}>{betHistory.length}</span>}
              </button>
              <button
                className={`${styles.historyTab} ${activeTab === 'all' ? styles.historyTabActive : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All Bets
                {liveBets.length > 0 && <span className={styles.tabCount}>{liveBets.length}</span>}
              </button>
            </div>
          </div>
          {activeTab === 'all' ? (
            <LiveBets liveBets={liveBets} />
          ) : (
            <BetHistory betHistory={betHistory} />
          )}
        </div>

      </div>

      {phase === 'crashed' && <div className={styles.crashFlash} key={crashPoint} />}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}
