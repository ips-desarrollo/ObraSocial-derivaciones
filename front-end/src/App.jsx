import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoNombre from './multimedia/logo-nombre.svg'
import './paginas/globales.css'

function App() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!usuario.trim() || !password.trim()) {
      setError('Completá todos los campos para continuar.')
      return
    }
    setLoading(true)
    try {
      const API = import.meta.env.VITE_API_URL || '/api'
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: usuario.trim(), password: password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'Error al iniciar sesión')
        setLoading(false)
        return
      }
      localStorage.setItem('token', data.token)
      localStorage.setItem('usuario', JSON.stringify(data.usuario))
      navigate('/afiliados')
    } catch {
      setError('No se pudo conectar con el servidor')
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="login-hero-bg">
          <div className="login-orb login-orb-1"></div>
          <div className="login-orb login-orb-2"></div>
          <div className="login-orb login-orb-3"></div>
        </div>
        <div className="login-hero-content">
          <img src={logoNombre} className="login-hero-logo" alt="Obra Social IPS" />
          <div className="login-hero-divider"></div>
          <p className="login-hero-tagline">Sistema de Obra Social</p>
          <p className="login-hero-desc">
            Gestión integral de derivaciones médicas para afiliados de la obra social.
          </p>
        </div>
      </div>

      <div className="login-form-side">
        <div className="login-form-container">
          <div className="login-form-header">
            <img src={logoNombre} className="login-mobile-logo" alt="Obra Social IPS" />
            <h1 className="login-title">Bienvenido</h1>
            <p className="login-subtitle">Ingresá tus credenciales para continuar</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label" htmlFor="login-user">Usuario</label>
              <div className="login-input-wrap">
                <svg className="login-input-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0H3z" />
                </svg>
                <input
                  id="login-user"
                  className="login-input"
                  type="text"
                  placeholder="tu.email@ejemplo.com"
                  value={usuario}
                  onChange={e => setUsuario(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="login-pass">Contraseña</label>
              <div className="login-input-wrap">
                <svg className="login-input-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <input
                  id="login-pass"
                  className="login-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ingresá tu contraseña"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-toggle-pass"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10C1.732 14.057 5.522 17 10 17c.898 0 1.763-.13 2.454-.303z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="login-spinner"></span>
                  Ingresando...
                </>
              ) : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default App
