import { createContext, useContext, useEffect, useState } from 'react'
import { getTimingConfig } from '../services/timingService'

const TimingContext = createContext(null)

export function TimingProvider({ children }) {
  const [timing, setTiming] = useState(null)

  useEffect(() => {
    getTimingConfig().then(setTiming).catch(() => setTiming(null))
  }, [])

  return <TimingContext.Provider value={timing}>{children}</TimingContext.Provider>
}

export function useTiming() {
  return useContext(TimingContext)
}