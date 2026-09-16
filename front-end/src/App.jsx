import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import logoNombre from './multimedia/logo-nombre.svg'
import { loginDesdePortal } from './auth'
import './paginas/globales.css'

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [listo, setListo] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function iniciar() {
      const ok = await loginDesdePortal()
      if (cancelled) return
      if (ok) {
        setListo(true)
        if (location.pathname === '/') {
          navigate('/inicio', { replace: true })
        }
      } else {
        setError('No se pudo verificar tu sesión. Redirigiendo al portal...')
      }
    }

    iniciar()
    return () => { cancelled = true }
  }, [navigate, location.pathname])

  if (error) {
    return (
      <div className="login-page">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: '1.5rem',
        }}>
          <img src={logoNombre} alt="Obra Social IPS" style={{ height: 64 }} />
          <p style={{ color: '#b91c1c', textAlign: 'center', maxWidth: 360 }}>{error}</p>
        </div>
      </div>
    )
  }

  if (!listo) {
    return (
      <div className="login-page">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: '1.5rem',
        }}>
          <img src={logoNombre} alt="Obra Social IPS" style={{ height: 64 }} />
          <p style={{ color: '#64748b' }}>Ingresando al sistema...</p>
        </div>
      </div>
    )
  }

  return <Outlet />
}

export default App
