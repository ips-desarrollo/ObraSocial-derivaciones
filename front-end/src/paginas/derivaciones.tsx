import { useState, useEffect, useCallback } from 'react';
import NavBar from './NavBar';
import logoSiglas from '../multimedia/logo-siglas.svg';
import { fetchAuth, verificarSesion, API } from '../auth';
import FormularioDerivacion, {
  Derivacion,
  formatMes,
  formatFecha,
  esSoloLectura,
} from './FormularioDerivacion';
import './globales.css';
import './derivaciones.css';

function mesActual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function Derivaciones() {
  const soloLectura = esSoloLectura();
  const [derivaciones, setDerivaciones] = useState<Derivacion[]>([]);
  const [mesSeleccionado, setMesSeleccionado] = useState(mesActual());
  const [loading, setLoading] = useState(true);

  const [vista, setVista] = useState<'lista' | 'crear' | 'editar'>('lista');
  const [derivSel, setDerivSel] = useState<Derivacion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Derivacion | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [modalError, setModalError] = useState('');

  const cargarDerivaciones = useCallback(async () => {
    if (!verificarSesion()) return;
    setLoading(true);
    try {
      const res = await fetchAuth(`${API}/derivaciones?mes=${mesSeleccionado}`);
      if (!res.ok) throw new Error('Error al cargar derivaciones');
      setDerivaciones(await res.json());
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [mesSeleccionado]);

  useEffect(() => {
    cargarDerivaciones();
  }, [cargarDerivaciones]);

  function irACrear() {
    setDerivSel(null);
    setVista('crear');
  }

  function irAEditar(d: Derivacion) {
    setDerivSel(d);
    setVista('editar');
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
    if (!opciones.includes(mesSeleccionado)) {
      opciones.push(mesSeleccionado);
      opciones.sort();
    }
    return opciones;
  }

  /* ── Vista: Formulario (crear / editar) ── */
  if (vista === 'crear' || vista === 'editar') {
    return (
      <>
        <NavBar />
        <FormularioDerivacion
          modo={vista}
          mes={vista === 'editar' && derivSel ? derivSel.mes : mesSeleccionado}
          derivacion={derivSel}
          onVolver={volverALista}
          onGuardado={cargarDerivaciones}
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
          <select
            className="dv-mes-select"
            value={mesSeleccionado}
            onChange={(e) => setMesSeleccionado(e.target.value)}
          >
            {generarOpcionesMeses().map((m) => (
              <option key={m} value={m}>{formatMes(m)}</option>
            ))}
          </select>
          <div className="dv-toolbar-spacer" />
          {!soloLectura && (
            <button className="dv-btn dv-btn--primary" onClick={irACrear}>
              + Nueva Derivación
            </button>
          )}
        </div>

        <div className="dv-panel">
          <div className="dv-header">
            <img src={logoSiglas} alt="IPS" className="dv-header-logo" />
            <h1 className="dv-header-title">Derivaciones — {formatMes(mesSeleccionado)}</h1>
            <span className="dv-header-count">
              {derivaciones.length} derivación{derivaciones.length !== 1 ? 'es' : ''}
            </span>
          </div>

          <div className="dv-table-wrap">
            {loading ? (
              <p className="dv-empty">Cargando derivaciones...</p>
            ) : derivaciones.length === 0 ? (
              <p className="dv-empty">No hay derivaciones para {formatMes(mesSeleccionado)}</p>
            ) : (
              <table className="dv-table">
                <thead>
                  <tr>
                    <th>N° Disp.</th>
                    <th>DNI</th>
                    <th>Afiliado</th>
                    <th>Fecha</th>
                    {!soloLectura && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {derivaciones.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {d.nro_disposicion
                          ? <span className="dv-disp-badge">{d.nro_disposicion}</span>
                          : <span className="dv-cell-empty">-</span>}
                      </td>
                      <td className="dv-dni-cell">{d.afiliado_documento}</td>
                      <td className="dv-name-cell">{d.afiliado_nombre || '-'}</td>
                      <td className="dv-fecha-cell">{formatFecha(d.fecha)}</td>
                      {!soloLectura && (
                        <td>
                          <div className="dv-actions">
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
