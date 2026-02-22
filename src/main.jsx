import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Gatekeeper from './components/Gatekeeper.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Gatekeeper>
      <App />
    </Gatekeeper>
  </StrictMode>,
)
