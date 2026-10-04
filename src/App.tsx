import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { isSupabaseReady } from './lib/supabase'
import Navbar from './components/Navbar'
import ConfigWarning from './components/ConfigWarning'

const ExplorePage = lazy(() => import('./pages/ExplorePage'))
const CreateRequestPage = lazy(() => import('./pages/CreateRequestPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

const PageLoader = () => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ fontSize: 32, opacity: 0.2, animation: 'pulse 1.5s ease-in-out infinite' }}>★</div>
    <style>{`@keyframes pulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.5; } }`}</style>
  </div>
)

export default function App() {
  if (!isSupabaseReady) {
    return (
      <>
        <ConfigWarning />
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20, opacity: 0.3 }}>★</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>StarLift is not configured</h1>
          <p style={{ fontSize: 16, color: '#c4c9d4', maxWidth: 480, lineHeight: 1.6 }}>
            The app needs Supabase environment variables to function. Set
            <code style={{ background: '#1a1e26', padding: '2px 6px', borderRadius: 4, margin: '0 4px', fontSize: 14 }}>VITE_SUPABASE_URL</code>
            and
            <code style={{ background: '#1a1e26', padding: '2px 6px', borderRadius: 4, margin: '0 4px', fontSize: 14 }}>VITE_SUPABASE_ANON_KEY</code>
            in your environment, then redeploy.
          </p>
        </div>
      </>
    )
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Navbar />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<ExplorePage />} />
              <Route path="/create" element={<CreateRequestPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/wallet" element={<Navigate to="/dashboard" replace />} />
              <Route path="/my-requests" element={<Navigate to="/dashboard" replace />} />
              <Route path="/referrals" element={<Navigate to="/dashboard" replace />} />
              <Route path="/leaderboard" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
