import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoNombre from './logo-nombre.svg'
import './globales.css'

function App() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

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
      <div className="login-card">
        <div className="login-card-header">
          <img src={logoNombre} className="login-logo" alt="Obra Social IPS" />
        </div>
        <div className="login-card-body">
          <p className="login-subtitle">Derivaciones</p>
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label">Usuario</label>
              <input
                className="login-input"
                type="text"
                placeholder="Ingrese su usuario"
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="login-field">
              <label className="login-label">Contraseña</label>
              <input
                className="login-input"
                type="password"
                placeholder="Ingrese su contraseña"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && <p className="login-error">{error}</p>}
            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default App
