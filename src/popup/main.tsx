import { Theme } from '@radix-ui/themes'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './popup.css'

const root = document.getElementById('root')
if (!root) throw new Error('Popup root element is missing')

const appearance = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

createRoot(root).render(
  <StrictMode>
    <Theme accentColor="grass" grayColor="slate" radius="large" appearance={appearance}>
      <App />
    </Theme>
  </StrictMode>,
)
