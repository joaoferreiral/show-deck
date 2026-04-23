'use client'

import { createContext, useContext } from 'react'

export type SessionData = {
  orgId: string
  orgName: string
  userName: string
  userEmail: string
}

const SessionCtx = createContext<SessionData | null>(null)

export function SessionProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: SessionData
}) {
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}

export function useSession() {
  const ctx = useContext(SessionCtx)
  if (!ctx) throw new Error('useSession deve ser usado dentro do SessionProvider')
  return ctx
}
