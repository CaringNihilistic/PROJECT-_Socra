import { useEffect } from 'react'
import { ClerkProvider, useAuth } from '@clerk/clerk-react'
import { useSessionStore } from './store/sessionStore'
import { LandingPage } from './components/LandingPage'
import { SessionPage } from './components/SessionPage'
import { CLERK_ENABLED } from './lib/auth'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

/** Syncs the Clerk JWT into the store. Only rendered inside ClerkProvider. */
function ClerkSync() {
  const { getToken, isSignedIn } = useAuth()
  const setAuthToken = useSessionStore((s) => s.setAuthToken)
  const loadSessionHistory = useSessionStore((s) => s.loadSessionHistory)

  useEffect(() => {
    if (isSignedIn) {
      getToken().then((t) => {
        setAuthToken(t)
        loadSessionHistory()
      })
    } else {
      setAuthToken(null)
    }
  }, [isSignedIn])

  return null
}

function AppShell() {
  const session = useSessionStore((s) => s.session)
  const loadSessionHistory = useSessionStore((s) => s.loadSessionHistory)

  useEffect(() => {
    loadSessionHistory()
  }, [])

  return session ? <SessionPage /> : <LandingPage />
}

export default function App() {
  if (CLERK_KEY) {
    return (
      <ClerkProvider publishableKey={CLERK_KEY}>
        <ClerkSync />
        <AppShell />
      </ClerkProvider>
    )
  }
  return <AppShell />
}
