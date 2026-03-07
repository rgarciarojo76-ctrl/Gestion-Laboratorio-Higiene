import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Gatekeeper from './components/Gatekeeper.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { ToastProvider } from './components/ToastNotification.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CartProvider>
      <ToastProvider>
        <Gatekeeper>
          <App />
        </Gatekeeper>
      </ToastProvider>
    </CartProvider>
  </StrictMode>,
)
