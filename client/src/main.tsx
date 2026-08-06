import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App' // Đã bỏ đuôi .js
import './styles/globals.css'
import './styles/tailwind.css'
// Imported after tailwind so the .cp-* rules win over Tailwind's base layer.
import './styles/cosmic.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)