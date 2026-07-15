import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [backStatus, setBackStatus] = useState({ loading: true, data: null, error: null })
  const [dbStatus, setDbStatus] = useState({ loading: false, data: null, error: null })
  
  // En producción, Dokploy inyectará VITE_API_URL. En local usamos el puerto de FastAPI (8000)
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  useEffect(() => {
    fetch(`${API_URL}/`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        return res.json()
      })
      .then(data => {
        setBackStatus({ loading: false, data, error: null })
      })
      .catch(err => {
        setBackStatus({ loading: false, data: null, error: err.message })
      })
  }, [API_URL])

  const testDatabase = () => {
    setDbStatus({ loading: true, data: null, error: null })
    fetch(`${API_URL}/db-test`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        return res.json()
      })
      .then(data => {
        setDbStatus({ loading: false, data, error: null })
      })
      .catch(err => {
        setDbStatus({ loading: false, data: null, error: err.message })
      })
  }

  return (
    <div className="container">
      <header className="header">
        <span className="logo">🏥</span>
        <h1>Obra Social</h1>
        <p className="subtitle">Consola de Control del Proyecto</p>
      </header>

      <main className="grid">
        {/* Tarjeta de Backend */}
        <div className="card">
          <div className="card-header">
            <span className="badge-tech">Python</span>
            <h2>Servicio Backend (FastAPI)</h2>
          </div>
          <p className="card-desc">Conexión en tiempo real con el servidor de la API.</p>
          
          {backStatus.loading && <p className="status loading">Comprobando conexión con FastAPI...</p>}
          
          {backStatus.error && (
            <div className="status error">
              <p className="status-title">🔴 Desconectado</p>
              <p className="status-detail">Asegúrate de tener el backend corriendo en el puerto 8000 o configura la variable en Dokploy.</p>
              <small className="error-text">{backStatus.error}</small>
            </div>
          )}
          
          {backStatus.data && (
            <div className="status success">
              <p className="status-title">🟢 Conectado con Éxito</p>
              <pre className="code-block">{JSON.stringify(backStatus.data, null, 2)}</pre>
            </div>
          )}
          
          <p className="card-info">Endpoint: <code>{API_URL}/</code></p>
        </div>

        {/* Tarjeta de Base de Datos */}
        <div className="card">
          <div className="card-header">
            <span className="badge-tech">PostgreSQL</span>
            <h2>Base de Datos (Dokploy / Local)</h2>
          </div>
          <p className="card-desc">Prueba la conexión a tu PostgreSQL desde el Backend de Python.</p>
          
          <button className="btn" onClick={testDatabase} disabled={dbStatus.loading}>
            {dbStatus.loading ? 'Verificando...' : 'Probar Conexión SQL'}
          </button>
          
          {dbStatus.data && (
            <div className={`status ${dbStatus.data.status === 'connected' ? 'success' : 'error'}`}>
              <p className="status-title">
                {dbStatus.data.status === 'connected' ? '🟢 Conexión Exitosa' : '🔴 Error de Conexión'}
              </p>
              <p className="status-detail">{dbStatus.data.message}</p>
              {dbStatus.data.error && <small className="error-text">{dbStatus.data.error}</small>}
              {dbStatus.data.database && (
                <pre className="code-block">
                  {JSON.stringify({ database: dbStatus.data.database, host: dbStatus.data.host }, null, 2)}
                </pre>
              )}
            </div>
          )}
          
          {dbStatus.error && (
            <div className="status error">
              <p className="status-title">🔴 Error de red/API</p>
              <small className="error-text">{dbStatus.error}</small>
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <p>Estructura base lista para desplegar en tu VPS con <strong>Dokploy</strong></p>
      </footer>
    </div>
  )
}

export default App
