import { useState } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import CrashGame from './components/CrashGame'
import LoadingScreen from './components/LoadingScreen'
import './App.css'

function App() {
  const [loading, setLoading] = useState(true)

  return (
    <>
      {loading && <LoadingScreen onDone={() => setLoading(false)} />}
      {!loading && (
        <AuthProvider>
          <CrashGame />
        </AuthProvider>
      )}
    </>
  )
}

export default App
