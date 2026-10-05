import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Splash from '@/components/SplashScreen'
import Home from '@/pages/Home'
import Send from '@/pages/Send'
import Review from '@/pages/Review'
import Progress from '@/pages/Progress'
import Receipt from '@/pages/Receipt'
import Activity from '@/pages/Activity'
import { NewRequest, ResolveRequest } from '@/pages/RequestPage'
import VerifiedPayment from '@/pages/VerifiedPayment'

/** Wraps Routes so AnimatePresence can see location changes */
function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/send" element={<Send />} />
        <Route path="/review" element={<Review />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/receipt" element={<Receipt />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/request/new" element={<NewRequest />} />
        <Route path="/r/:id" element={<ResolveRequest />} />
        <Route path="/p/:hash" element={<VerifiedPayment />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false)

  return (
    <>
      <AnimatePresence>
        {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
      </AnimatePresence>

      {splashDone && (
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      )}
    </>
  )
}
