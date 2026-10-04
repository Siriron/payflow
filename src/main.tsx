import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { Web3Provider } from './providers/Web3Provider'
import { ThemeProvider } from './providers/ThemeProvider'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <Web3Provider>
        <App />
        <Toaster position="top-center" richColors />
      </Web3Provider>
    </ThemeProvider>
  </StrictMode>,
)

