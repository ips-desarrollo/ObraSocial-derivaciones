import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx'
import Afiliados from './paginas/afiliados.tsx'
import Usuarios from './paginas/usuarios.tsx'
import Derivaciones from './paginas/derivaciones.tsx'
import Legajo from './paginas/legajo.tsx'
import './index.css'

function ProtectedUsuarios() {
  try {
    const u = localStorage.getItem('usuario')
    if (u) {
      const roles = JSON.parse(u).roles || []
      if (roles.length === 1 && roles[0] === 'lectura') {
        return <Navigate to="/afiliados" replace />
      }
    }
  } catch {}
  return <Usuarios />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/afiliados" element={<Afiliados />} />
        <Route path="/derivaciones" element={<Derivaciones />} />
        <Route path="/legajo" element={<Legajo />} />
        <Route path="/usuarios" element={<ProtectedUsuarios />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
