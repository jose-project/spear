import { useState } from 'react'
import { useCrashGame } from './useCrashGame'
import { useAuth } from '../contexts/AuthContext'
import CrashGraph from './CrashGraph'
import BettingPanel from './BettingPanel'
import GameHistory from './GameHistory'
import BetHistory from './BetHistory'
import LiveBets from './LiveBets'
import AuthModal from './AuthModal'
import styles from './CrashGame.module.css'

export default function CrashGame() {
  const game = useCrashGame()
  const { user, logout, demoMode, demoBalance, enterDemo, updateDemoBalance } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [activeTab, setActiveTab] = useState('my')

  const {
    phase, multiplier, crashPoint, countdown,
    history, betHistory, liveBets, betPlaced, cashedOut, cashedOutAt,
    error, connected,
  } = game


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
          <img src="/src/assets/company_logo.png" alt="Spear Rush" className={styles.logoIcon} />
          <span className={styles.logoText}>Spear Rush</span>
        </div>

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
              <img src="/src/assets/company_logo.png" alt="Spear" className={styles.loginPromptLogo} />
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
