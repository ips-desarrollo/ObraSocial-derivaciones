import { useState, useEffect, useRef } from 'react';
import { fetchAuth, API } from '../auth';
import { esSoloLectura } from './FormularioDerivacion';
import './caratula-legajo.css';

/** Áreas intervinientes posibles, en el orden del documento Word original. */
const AREAS = [
  'Ingreso al sector',
  'Pase a Auditoría',
  'Auditoría Médica',
  'Auditoría Oftalmológica (en caso de corresponder)',
  'Planilla de PET (en caso de corresponder)',
  'Envío a MEDITAR',
  'TURNO MEDITAR/PROPIO',
  'Notificación de Turno',
  'Autorización excepcional de Traslado, alojamiento, o acompañantes adicionales (en caso de corresponder)',
  'Trámite de TyA',
  'Emisión de pasajes',
  'Voucher de alojamiento',
  'Pase a Disposición',
  'Disposición',
  'Entrega al afiliado de la documentación',
  'Archivo',
];

interface Movimiento {
  id: number;
  area: string;
  creado_en: string | null;
  agente: string | null;
}

function formatearFechaHora(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Modo = 'ver' | 'movimiento';

interface Props {
  derivacionId: number;
  nombreAfiliado: string;
  onVolver: () => void;
  modoInicial?: Modo;
}

export default function CaratulaDerivacion({
  derivacionId,
  nombreAfiliado,
  onVolver,
  modoInicial = 'ver',
}: Props) {
  const soloLectura = esSoloLectura();
  const [modo, setModo] = useState<Modo>(soloLectura ? 'ver' : modoInicial);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Formulario de nuevo movimiento
  const [area, setArea] = useState('');
  const [ddAbierto, setDdAbierto] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);

  // Cerrar el desplegable al hacer click fuera
  useEffect(() => {
    if (!ddAbierto) return;
    function onClickFuera(e: MouseEvent) {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) {
        setDdAbierto(false);
      }
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [ddAbierto]);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivacionId]);

  async function cargar() {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAuth(`${API}/caratulas/derivacion/${derivacionId}/movimientos`);
      if (res.ok) {
        setMovimientos(await res.json());
      } else {
        setMovimientos([]);
      }
    } catch (e: any) {
      setError(e.message || 'Error al cargar el historial');
    } finally {
      setLoading(false);
    }
  }

  async function guardarMovimiento() {
    if (!area) {
      setError('Seleccione un área interviniente.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetchAuth(`${API}/caratulas/derivacion/${derivacionId}/movimientos`, {
        method: 'POST',
        body: JSON.stringify({ area }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || 'Error al guardar el movimiento');
      }
      setArea('');
      await cargar();
      setModo('ver');
    } catch (e: any) {
      setError(e.message || 'Error al guardar el movimiento');
    } finally {
      setSaving(false);
    }
  }

  const actual = movimientos.length > 0 ? movimientos[movimientos.length - 1] : null;

  return (
    <div className="cl-page">
      <div className="cl-panel">
        {/* Header */}
        <div className="cl-header">
          <button className="cl-btn cl-btn--back" onClick={onVolver}>← Volver</button>
          <h2 className="cl-header-title">Carátula de Derivación</h2>
          <div className="cl-header-actions">
            <div className="cl-tabs">
              <button
                className={`cl-tab${modo === 'ver' ? ' cl-tab--active' : ''}`}
                onClick={() => setModo('ver')}
              >
                Ver carátula
              </button>
              {!soloLectura && (
                <button
                  className={`cl-tab${modo === 'movimiento' ? ' cl-tab--active' : ''}`}
                  onClick={() => setModo('movimiento')}
                >
                  Movimiento
                </button>
              )}
            </div>
          </div>
        </div>

        {error && <p className="cl-error">{error}</p>}

        <div className="cl-body">
          {/* Datos del afiliado */}
          <div className="cl-section">
            <div className="cl-field">
              <label className="cl-label">Apellido y nombre del Afiliado</label>
              <input className="cl-input cl-input--ro" value={nombreAfiliado} readOnly />
            </div>
            {actual && (
              <div className="cl-actual">
                <span className="cl-actual-label">Estado actual</span>
                <span className="cl-actual-area">{actual.area}</span>
              </div>
            )}
          </div>

          {/* ── Registrar movimiento ── */}
          {modo === 'movimiento' && !soloLectura && (
            <div className="cl-section">
              <p className="cl-form-title">Registrar movimiento</p>
              <div className="cl-field">
                <label className="cl-label">Área interviniente</label>
                <div className="cl-dd" ref={ddRef}>
                  <button
                    type="button"
                    className={`cl-dd-btn${area ? '' : ' cl-dd-btn--placeholder'}${ddAbierto ? ' cl-dd-btn--open' : ''}`}
                    onClick={() => setDdAbierto((o) => !o)}
                  >
                    <span className="cl-dd-btn-text">{area || 'Seleccione un área...'}</span>
                    <svg className="cl-dd-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {ddAbierto && (
                    <ul className="cl-dd-list" role="listbox">
                      {AREAS.map((a) => (
                        <li key={a}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={a === area}
                            className={`cl-dd-opt${a === area ? ' cl-dd-opt--sel' : ''}`}
                            onClick={() => { setArea(a); setDdAbierto(false); }}
                          >
                            {a}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <p className="cl-hint">
                Se guardará con la fecha y hora actual, y con su usuario como agente.
              </p>
              <div className="cl-form-actions">
                <button
                  className="cl-btn cl-btn--success"
                  onClick={guardarMovimiento}
                  disabled={saving || !area}
                >
                  {saving ? 'Guardando...' : 'Guardar movimiento'}
                </button>
              </div>
            </div>
          )}

          {/* ── Ver carátula: historial ── */}
          {modo === 'ver' && (
            <div className="cl-section">
              <p className="cl-form-title">Historial de movimientos</p>
              {loading ? (
                <p className="cl-loading">Cargando...</p>
              ) : movimientos.length === 0 ? (
                <p className="cl-empty-text">
                  Todavía no hay movimientos registrados para esta derivación.
                </p>
              ) : (
                <ul className="cl-timeline">
                  {movimientos.map((m, idx) => {
                    const esActual = idx === movimientos.length - 1;
                    return (
                      <li key={m.id} className={`cl-tl-item${esActual ? ' cl-tl-item--actual' : ''}`}>
                        <div className="cl-tl-dot" />
                        <div className="cl-tl-content">
                          <div className="cl-tl-head">
                            <span className="cl-tl-area">{m.area}</span>
                            {esActual && <span className="cl-tl-badge">Actual</span>}
                          </div>
                          <div className="cl-tl-meta">
                            <span>{formatearFechaHora(m.creado_en)}</span>
                            <span className="cl-tl-agente">{m.agente || '-'}</span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
