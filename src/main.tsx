import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './app/App'
import './styles/app.css'
import { registerServiceWorker } from './pwa/registerSW'
import { boot } from './app/boot'

boot().then(() => {
  registerServiceWorker()
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>,
  )
})
