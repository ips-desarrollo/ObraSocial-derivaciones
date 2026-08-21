import { useState, useEffect, useCallback } from 'react';
import NavBar from './NavBar';
import logoSiglas from '../multimedia/logo-siglas.svg';
import { fetchAuth, verificarSesion, API } from '../auth';
import FormularioDerivacion, {
  Derivacion,
  formatFecha,
  esSoloLectura,
} from './FormularioDerivacion';
import CaratulaDerivacion from './CaratulaDerivacion';
import './globales.css';
import './derivaciones.css';
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
  const soloLectura = esSoloLectura();
  const [derivaciones, setDerivaciones] = useState<Derivacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroMes, setFiltroMes] = useState('todos');

  const [vista, setVista] = useState<'lista' | 'editar' | 'caratula'>('lista');
  const [derivSel, setDerivSel] = useState<Derivacion | null>(null);
  const [caratulaModo, setCaratulaModo] = useState<'ver' | 'movimiento'>('ver');
  const [deleteTarget, setDeleteTarget] = useState<Derivacion | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [modalError, setModalError] = useState('');

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

  function irAEditar(d: Derivacion) {
    setDerivSel(d);
    setVista('editar');
  }

  function irACaratula(d: Derivacion, modo: 'ver' | 'movimiento') {
    setDerivSel(d);
    setCaratulaModo(modo);
    setVista('caratula');
  }

  function volverALista() {
    setVista('lista');
  }

  function abrirEliminar(d: Derivacion) {
    setDeleteTarget(d);
    setModalError('');
    setModalEliminar(true);
  }

  function cerrarModalEliminar() {
    setModalEliminar(false);
    setModalError('');
    setSaving(false);
  }

  async function confirmarEliminar() {
    if (!deleteTarget) return;
    setSaving(true);
    setModalError('');
    try {
      const res = await fetchAuth(`${API}/derivaciones/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.detail || 'Error al eliminar');
        setSaving(false);
        return;
      }
      cerrarModalEliminar();
      cargarDerivaciones();
    } catch (e: any) {
      setModalError(e.message || 'Error de conexión');
      setSaving(false);
    }
  }

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

  /* ── Vista: Formulario (editar) ── */
  if (vista === 'editar' && derivSel) {
    return (
      <>
        <NavBar />
        <FormularioDerivacion
          modo="editar"
          mes={derivSel.mes}
          derivacion={derivSel}
          onVolver={volverALista}
          onGuardado={cargarDerivaciones}
        />
      </>
    );
  }

  /* ── Vista: Carátula de derivación ── */
  if (vista === 'caratula' && derivSel) {
    return (
      <>
        <NavBar />
        <CaratulaDerivacion
          derivacionId={derivSel.id}
          nombreAfiliado={derivSel.afiliado_nombre || '-'}
          onVolver={volverALista}
          modoInicial={caratulaModo}
        />
      </>
    );
  }

  /* ── Vista: Listado ── */
  return (
    <>
      <NavBar />
      <div className="dv-page">
        <div className="dv-toolbar">
          {nombre && (
            <span className="it-welcome">
              Hola, <strong>{nombre}</strong>
            </span>
          )}
          <div className="dv-toolbar-spacer" />

          <select
            className="dv-mes-select"
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

        <div className="dv-panel">
          <div className="dv-header">
            <img src={logoSiglas} alt="IPS" className="dv-header-logo" />
            <h1 className="dv-header-title">Últimas Derivaciones</h1>
            <span className="dv-header-count">
              {filtradas.length} derivación{filtradas.length !== 1 ? 'es' : ''}
            </span>
          </div>

          <div className="dv-table-wrap">
            {loading ? (
              <p className="dv-empty">Cargando derivaciones...</p>
            ) : filtradas.length === 0 ? (
              <p className="dv-empty">
                {busqueda.trim()
                  ? 'No se encontraron derivaciones con esa búsqueda'
                  : 'No hay derivaciones para mostrar'}
              </p>
            ) : (
              <table className="dv-table">
                <thead>
                  <tr>
                    <th>N° Disp.</th>
                    <th>DNI</th>
                    <th>Afiliado</th>
                    <th>Destino</th>
                    <th>Fecha</th>
                    {!soloLectura && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {d.nro_disposicion
                          ? <span className="dv-disp-badge">{d.nro_disposicion}</span>
                          : <span className="dv-cell-empty">-</span>}
                      </td>
                      <td className="dv-dni-cell">{d.afiliado_documento}</td>
                      <td className="dv-name-cell">{d.afiliado_nombre || '-'}</td>
                      <td className="it-destino-cell">{d.destino || '-'}</td>
                      <td className="dv-fecha-cell">{formatFecha(d.fecha)}</td>
                      {!soloLectura && (
                        <td>
                          <div className="dv-actions">
                            <button className="dv-btn dv-btn--outline dv-btn--sm" onClick={() => irACaratula(d, 'ver')}>
                              Ver carátula
                            </button>
                            <button className="dv-btn dv-btn--outline dv-btn--sm" onClick={() => irACaratula(d, 'movimiento')}>
                              Movimiento
                            </button>
                            <button className="dv-btn dv-btn--outline dv-btn--sm" onClick={() => irAEditar(d)}>
                              Editar
                            </button>
                            <button className="dv-btn dv-btn--danger dv-btn--sm" onClick={() => abrirEliminar(d)}>
                              Eliminar
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal Eliminar (solo confirmación) */}
      {modalEliminar && deleteTarget && (
        <div className="dv-modal-overlay" onClick={cerrarModalEliminar}>
          <div className="dv-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="dv-modal-title">Eliminar Derivación</h2>
            <p className="dv-confirm-text">
              ¿Estás seguro de que querés eliminar la derivación de{' '}
              <span className="dv-confirm-name">{deleteTarget.afiliado_nombre}</span>
              {deleteTarget.nro_disposicion ? ` (Disp. ${deleteTarget.nro_disposicion})` : ''}?
              <br />
              Esta acción no se puede deshacer.
            </p>
            {modalError && <p className="dv-form-error">{modalError}</p>}
            <div className="dv-modal-btns">
              <button className="dv-btn dv-btn--outline" onClick={cerrarModalEliminar}>
                Cancelar
              </button>
              <button className="dv-btn dv-btn--danger" onClick={confirmarEliminar} disabled={saving}>
                {saving ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
