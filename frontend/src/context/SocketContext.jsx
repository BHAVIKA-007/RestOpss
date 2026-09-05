import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'
const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const socketRef = useRef(null)

  useEffect(() => {
    const socket = io(SOCKET_URL)
    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const value = useMemo(() => ({
    joinRestaurantRoom(restaurantId) {
      if (restaurantId && socketRef.current) {
        socketRef.current.emit('joinRestaurant', restaurantId)
      }
    },
    on(eventName, callback) {
      socketRef.current?.on(eventName, callback)
      return () => socketRef.current?.off(eventName, callback)
    },
  }), [])

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) throw new Error('useSocket must be used inside a SocketProvider')
  return context
}

export function useSocketEvent(eventName, callback) {
  const { on } = useSocket()

  useEffect(() => on(eventName, callback), [eventName, callback, on])
}
