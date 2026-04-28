import styles from './GameHistory.module.css'

export default function GameHistory({ history }) {
  function getColor(value) {
    if (value < 1.5) return styles.red
    if (value < 2) return styles.orange
    if (value < 5) return styles.yellow
    if (value < 10) return styles.blue
    return styles.purple
  }

  return (
    <div className={styles.container}>
      {/* <span className={styles.label}>History</span> */}
      <div className={styles.list}>
        {history.map(item => (
          <span key={item.id} className={`${styles.chip} ${getColor(item.value)}`}>
            {item.value.toFixed(2)}×
          </span>
        ))}
        {history.length === 0 && (
          <span className={styles.empty}>No rounds yet</span>
        )}
      </div>
    </div>
  )
}
