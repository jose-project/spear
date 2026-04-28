import styles from './BetHistory.module.css'

export default function LiveBets({ liveBets }) {
  if (!liveBets || liveBets.length === 0) {
    return <div className={styles.empty}>No bets yet this round.</div>
  }

  return (
    <div className={styles.container}>
      {liveBets.map(row => {
        const isPending = row.pending === true || row.won === null

        const rowClass = isPending
          ? styles.rowPlaying
          : row.won ? styles.rowWon : styles.rowLost

        const pillClass = isPending
          ? styles.pillPlaying
          : row.won ? styles.pillWon : styles.pillLost

        const pillLabel = isPending ? '...' : row.won ? 'WIN' : 'LOST'

        return (
          <div key={row.id} className={`${styles.row} ${rowClass}`}>

            <span className={`${styles.pill} ${pillClass}`}>
              {pillLabel}
            </span>

            <div className={styles.meta}>
              <span className={styles.metaTop}>{row.username || '—'}</span>
              <span className={styles.metaSub}>Bet {row.bet.toFixed(2)}</span>
            </div>

            <span className={`${styles.multBadge} ${row.cashedOutAt != null ? styles.multWon : styles.multNone}`}>
              {row.cashedOutAt != null ? `${row.cashedOutAt.toFixed(2)}×` : '—'}
            </span>

            {!isPending && row.profit != null && (
              <span className={`${styles.profit} ${row.profit >= 0 ? styles.profitPos : styles.profitNeg}`}>
                {row.profit >= 0 ? '+' : ''}{row.profit.toFixed(2)}
              </span>
            )}

          </div>
        )
      })}
    </div>
  )
}
