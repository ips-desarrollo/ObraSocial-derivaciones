import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import logoSiglas from '../multimedia/logo-siglas.svg';
import { fetchAuth, verificarSesion, API } from '../auth';
import { Derivacion, formatFecha } from './FormularioDerivacion';
import './globales.css';
import './inicioTramites.css';

function getUserName(): string {
  try {
    const u = localStorage.getItem('usuario');
    if (!u) return '';
    const parsed = JSON.parse(u);
    return parsed.nombre || parsed.email || '';
  } catch {
    return '';
  }
}

export default function InicioTramites() {
  const navigate = useNavigate();
  const [derivaciones, setDerivaciones] = useState<Derivacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroMes, setFiltroMes] = useState('todos');

  const nombre = getUserName();

  const cargarDerivaciones = useCallback(async () => {
    if (!verificarSesion()) return;
    setLoading(true);
    try {
      const url = filtroMes === 'todos'
        ? `${API}/derivaciones`
        : `${API}/derivaciones?mes=${filtroMes}`;
      const res = await fetchAuth(url);
      if (!res.ok) throw new Error('Error al cargar derivaciones');
      setDerivaciones(await res.json());
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filtroMes]);

  useEffect(() => {
    cargarDerivaciones();
  }, [cargarDerivaciones]);

  function generarOpcionesMeses(): string[] {
    const opciones: string[] = [];
    const hoy = new Date();
    for (let i = 11; i >= -1; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      opciones.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return opciones;
  }

  function formatMesLabel(mes: string): string {
    const [y, m] = mes.split('-');
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    return `${meses[parseInt(m, 10) - 1]} ${y}`;
  }

  const filtradas = derivaciones.filter((d) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      (d.afiliado_nombre && d.afiliado_nombre.toLowerCase().includes(q)) ||
      (d.afiliado_documento && d.afiliado_documento.toLowerCase().includes(q)) ||
      (d.nro_disposicion && d.nro_disposicion.toLowerCase().includes(q)) ||
      (d.destino && d.destino.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <NavBar />
      <div className="it-page">
        <div className="it-toolbar">
          {nombre && (
            <span className="it-welcome">
              Hola, <strong>{nombre}</strong>
            </span>
          )}
          <div className="it-toolbar-spacer" />

          <select
            className="it-filter-select"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
          >
            <option value="todos">Todos los meses</option>
            {generarOpcionesMeses().map((m) => (
              <option key={m} value={m}>{formatMesLabel(m)}</option>
            ))}
          </select>

          <input
            className="it-search-input"
            type="text"
            placeholder="Buscar por nombre, DNI, disposición o destino..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="it-panel">
          <div className="it-header">
            <img src={logoSiglas} alt="IPS" className="it-header-logo" />
            <h1 className="it-header-title">Últimas Derivaciones</h1>
            <span className="it-header-count">
              {filtradas.length} derivación{filtradas.length !== 1 ? 'es' : ''}
            </span>
          </div>

          <div className="it-table-wrap">
            {loading ? (
              <p className="it-empty">Cargando derivaciones...</p>
            ) : filtradas.length === 0 ? (
              <p className="it-empty">
                {busqueda.trim()
                  ? 'No se encontraron derivaciones con esa búsqueda'
                  : 'No hay derivaciones para mostrar'}
              </p>
            ) : (
              <table className="it-table">
                <thead>
                  <tr>
                    <th>N° Disp.</th>
                    <th>DNI</th>
                    <th>Afiliado</th>
                    <th>Destino</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((d) => (
                    <tr key={d.id} onClick={() => navigate('/derivaciones')}>
                      <td>
                        {d.nro_disposicion
                          ? <span className="it-disp-badge">{d.nro_disposicion}</span>
                          : <span className="it-cell-empty">-</span>}
                      </td>
                      <td className="it-dni-cell">{d.afiliado_documento}</td>
                      <td className="it-name-cell">{d.afiliado_nombre || '-'}</td>
                      <td className="it-destino-cell">{d.destino || '-'}</td>
                      <td className="it-fecha-cell">{formatFecha(d.fecha)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
