import { useEffect } from 'react'
import { ClerkProvider, useAuth } from '@clerk/clerk-react'
import { useSessionStore } from './store/sessionStore'
import { LandingPage } from './components/LandingPage'
import { SessionPage } from './components/SessionPage'
import { SharePage } from './components/SharePage'
import { ComparePage } from './components/ComparePage'
import { CardPage } from './components/CardPage'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

// Detect share route: /share/<sessionId>
const shareMatch = window.location.pathname.match(/^\/share\/([^/]+)$/)
const SHARE_SESSION_ID = shareMatch ? shareMatch[1] : null

// Detect card route: /card/<sessionId>
const cardMatch = window.location.pathname.match(/^\/card\/([^/]+)$/)
const CARD_SESSION_ID = cardMatch ? cardMatch[1] : null

// Detect compare route: /compare/<id1>/<id2>
const compareMatch = window.location.pathname.match(/^\/compare\/([^/]+)\/([^/]+)$/)
const COMPARE_IDS = compareMatch ? [compareMatch[1], compareMatch[2]] as const : null

// Detect Razorpay payment return: /?sid=Y&razorpay_payment_link_id=X&razorpay_payment_link_status=paid
function getPaymentReturn() {
  const p = new URLSearchParams(window.location.search)
  const status = p.get('razorpay_payment_link_status')
  const linkId = p.get('razorpay_payment_link_id')
  const sid = p.get('sid')
  if (status === 'paid' && linkId && sid) {
    return { paymentLinkId: linkId, sessionId: sid }
  }
  return null
}
const PAYMENT_RETURN = getPaymentReturn()

/** Syncs the Clerk JWT into the store. Refreshes every 45 min before expiry. */
function ClerkSync() {
  const { getToken, isSignedIn } = useAuth()
  const setAuthToken = useSessionStore((s) => s.setAuthToken)
  const loadSessionHistory = useSessionStore((s) => s.loadSessionHistory)

  useEffect(() => {
    if (!isSignedIn) {
      setAuthToken(null)
      return
    }

    const refresh = async () => {
      const t = await getToken()
      setAuthToken(t)
    }

    refresh()
    loadSessionHistory()

    // Clerk tokens expire in 1 h — refresh every 45 min
    const interval = setInterval(refresh, 45 * 60 * 1000)
    return () => clearInterval(interval)
  }, [isSignedIn])

  return null
}

function AppShell() {
  const session = useSessionStore((s) => s.session)
  const loadSessionHistory = useSessionStore((s) => s.loadSessionHistory)
  const verifyAndUnlock = useSessionStore((s) => s.verifyAndUnlock)

  useEffect(() => {
    loadSessionHistory()

    // Handle return from Razorpay payment
    if (PAYMENT_RETURN?.paymentLinkId && PAYMENT_RETURN?.sessionId) {
      // Strip query params from URL so a refresh doesn't re-trigger
      window.history.replaceState({}, '', window.location.pathname)
      verifyAndUnlock(PAYMENT_RETURN.paymentLinkId, PAYMENT_RETURN.sessionId)
    }
  }, [])

  return session ? <SessionPage /> : <LandingPage />
}

export default function App() {
  // Share page is a public read-only view — no auth or store needed
  if (SHARE_SESSION_ID) {
    return <SharePage sessionId={SHARE_SESSION_ID} />
  }

  // Verdict card — public shareable score card
  if (CARD_SESSION_ID) {
    return <CardPage sessionId={CARD_SESSION_ID} />
  }

  // Compare page is a public read-only view — no auth or store needed
  if (COMPARE_IDS) {
    return <ComparePage id1={COMPARE_IDS[0]} id2={COMPARE_IDS[1]} />
  }

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
