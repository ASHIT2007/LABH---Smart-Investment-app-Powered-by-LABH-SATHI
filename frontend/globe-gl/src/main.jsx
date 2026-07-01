import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { GlobeProvider } from './context/GlobeContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobeProvider>
      <App />
    </GlobeProvider>
  </React.StrictMode>,
)
