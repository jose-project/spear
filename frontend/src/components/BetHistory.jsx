import styles from './BetHistory.module.css'

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function BetHistory({ betHistory }) {
  if (!betHistory || betHistory.length === 0) {
    return <div className={styles.empty}>No bets yet. Place a bet to see your history!</div>
  }

  return (
    <div className={styles.container}>
      {betHistory.map(row => (
        <div key={row.id} className={`${styles.row} ${row.won ? styles.rowWon : styles.rowLost}`}>

          <span className={`${styles.pill} ${row.won ? styles.pillWon : styles.pillLost}`}>
            {row.won ? 'WIN' : 'LOST'}
          </span>

          <div className={styles.meta}>
            <span className={styles.metaTop}>
              {row.roundNumber != null ? `Round #${row.roundNumber}` : '—'}
            </span>
            <span className={styles.metaSub}>Bet {row.bet.toFixed(2)} · {fmtTime(row.time)}</span>
          </div>

          <span className={`${styles.multBadge} ${row.won ? styles.multWon : styles.multLost}`}>
            {row.won
              ? `${row.cashedOutAt?.toFixed(2)}×`
              : row.crashPoint != null ? `✕${row.crashPoint.toFixed(2)}×` : '—'}
          </span>

          <span className={`${styles.profit} ${row.profit >= 0 ? styles.profitPos : styles.profitNeg}`}>
            {row.profit >= 0 ? '+' : ''}{row.profit.toFixed(2)}
          </span>

        </div>
      ))}
    </div>
  )
}
