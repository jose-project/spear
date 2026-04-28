import { useEffect, useState } from 'react'
import styles from './LoadingScreen.module.css'
import rushcoreLogo from '../assets/rushcore_logo.png'

export default function LoadingScreen({ onDone }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2200)
    const doneTimer = setTimeout(() => onDone(), 2700)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  return (
    <div className={`${styles.screen} ${fading ? styles.fadeOut : ''}`}>
      <div className={styles.content}>
        <img
          src={rushcoreLogo}
          alt="RushCore Gaming"
          className={styles.logo}
        />
        <div className={styles.dots}>
          <span /><span /><span />
        </div>
      </div>
    </div>
  )
}
