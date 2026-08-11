import { useState, useEffect } from 'react';
import { fetchAuth, API } from '../auth';
import { esSoloLectura } from './FormularioDerivacion';
import './caratula-legajo.css';

/** Pasos fijos de la carátula, en el orden del documento Word original. */
const PASOS = [
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

interface Paso {
  nombre: string;
  area: string;
  fecha: string;
  agente: string;
  /** Campo extra para "Trámite de TyA" y "Disposición" */
  nro?: string;
}

interface CaratulaData {
  id?: number;
  documento: string;
  nro_legajo: string;
  fecha_inicio: string;
  pasos: Paso[];
  observaciones: string;
}

function pasosVacios(): Paso[] {
  return PASOS.map((nombre) => ({ nombre, area: '', fecha: '', agente: '' }));
}

function caratulaVacia(documento: string): CaratulaData {
  return {
    documento,
    nro_legajo: '',
    fecha_inicio: '',
    pasos: pasosVacios(),
    observaciones: '',
  };
}

interface Props {
  documento: string;
  nombreAfiliado: string;
  onVolver: () => void;
}

export default function CaratulaLegajo({ documento, nombreAfiliado, onVolver }: Props) {
  const soloLectura = esSoloLectura();
  const [caratula, setCaratula] = useState<CaratulaData>(caratulaVacia(documento));
  const [existe, setExiste] = useState(false);
  const [editando, setEditando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  /** Copia para descartar cambios */
  const [backup, setBackup] = useState<CaratulaData | null>(null);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documento]);

  async function cargar() {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAuth(`${API}/caratulas/${encodeURIComponent(documento)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          // Merge: asegurar que todos los pasos existen (por si se agregaron después)
          const pasosGuardados: Paso[] = data.pasos || [];
          const pasosMerged = PASOS.map((nombre) => {
            const found = pasosGuardados.find((p: Paso) => p.nombre === nombre);
            return found || { nombre, area: '', fecha: '', agente: '' };
          });
          setCaratula({ ...data, pasos: pasosMerged });
          setExiste(true);
          setEditando(false);
        } else {
          setCaratula(caratulaVacia(documento));
          setExiste(false);
          setEditando(false);
        }
      } else {
        setCaratula(caratulaVacia(documento));
        setExiste(false);
      }
    } catch (e: any) {
      setError(e.message || 'Error al cargar la carátula');
    } finally {
      setLoading(false);
    }
  }

  function iniciarCreacion() {
    setEditando(true);
    setCaratula(caratulaVacia(documento));
  }

  function iniciarEdicion() {
    setBackup(JSON.parse(JSON.stringify(caratula)));
    setEditando(true);
  }

  function cancelarEdicion() {
    if (backup) {
      setCaratula(backup);
      setBackup(null);
    }
    setEditando(false);
  }

  function updateField(field: keyof CaratulaData, value: string) {
    setCaratula((prev) => ({ ...prev, [field]: value }));
  }

  function updatePaso(idx: number, field: keyof Paso, value: string) {
    setCaratula((prev) => {
      const pasos = [...prev.pasos];
      pasos[idx] = { ...pasos[idx], [field]: value };
      return { ...prev, pasos };
    });
  }

  async function guardar() {
    setSaving(true);
    setError('');
    setShowConfirm(false);
    try {
      const body = {
        documento: caratula.documento,
        nro_legajo: caratula.nro_legajo,
        fecha_inicio: caratula.fecha_inicio || null,
        pasos: caratula.pasos,
        observaciones: caratula.observaciones,
      };

      let res: Response;
      if (existe) {
        res = await fetchAuth(`${API}/caratulas/${encodeURIComponent(documento)}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        res = await fetchAuth(`${API}/caratulas`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || 'Error al guardar');
      }

      setEditando(false);
      setBackup(null);
      await cargar();
    } catch (e: any) {
      setError(e.message || 'Error al guardar la carátula');
    } finally {
      setSaving(false);
    }
  }

  const disabled = !editando;

  if (loading) {
    return (
      <div className="cl-page">
        <div className="cl-panel">
          <div className="cl-header">
            <button className="cl-btn cl-btn--back" onClick={onVolver}>← Volver</button>
            <h2 className="cl-header-title">Carátula del Legajo</h2>
          </div>
          <div className="cl-body"><p className="cl-loading">Cargando...</p></div>
        </div>
      </div>
    );
  }

  /* Si no existe y no está creando → pantalla para crear */
  if (!existe && !editando) {
    return (
      <div className="cl-page">
        <div className="cl-panel">
          <div className="cl-header">
            <button className="cl-btn cl-btn--back" onClick={onVolver}>← Volver</button>
            <h2 className="cl-header-title">Carátula del Legajo</h2>
          </div>
          <div className="cl-body cl-body--empty">
            <p className="cl-empty-text">Este afiliado no tiene carátula de legajo creada.</p>
            {!soloLectura && (
              <button className="cl-btn cl-btn--primary cl-btn--lg" onClick={iniciarCreacion}>
                Crear Carátula del Legajo
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cl-page">
      <div className="cl-panel">
        {/* Header */}
        <div className="cl-header">
          <button className="cl-btn cl-btn--back" onClick={editando && existe ? cancelarEdicion : onVolver}>
            ← {editando && existe ? 'Cancelar' : 'Volver'}
          </button>
          <h2 className="cl-header-title">Carátula del Legajo</h2>
          <div className="cl-header-actions">
            {existe && !editando && !soloLectura && (
              <button className="cl-btn cl-btn--primary" onClick={iniciarEdicion}>
                Editar
              </button>
            )}
            {editando && (
              <button
                className="cl-btn cl-btn--success"
                onClick={() => setShowConfirm(true)}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            )}
          </div>
        </div>

        {error && <p className="cl-error">{error}</p>}

        <div className="cl-body">
          {/* Encabezado de la carátula */}
          <div className="cl-section">
            <div className="cl-field-row">
              <div className="cl-field">
                <label className="cl-label">N° Legajo</label>
                <input
                  className={`cl-input${disabled ? ' cl-input--ro' : ''}`}
                  value={caratula.nro_legajo}
                  onChange={(e) => updateField('nro_legajo', e.target.value)}
                  readOnly={disabled}
                  placeholder={editando ? 'Ingrese N° de legajo' : '-'}
                />
              </div>
              <div className="cl-field">
                <label className="cl-label">Fecha de inicio</label>
                <input
                  type="date"
                  className={`cl-input${disabled ? ' cl-input--ro' : ''}`}
                  value={caratula.fecha_inicio || ''}
                  onChange={(e) => updateField('fecha_inicio', e.target.value)}
                  readOnly={disabled}
                />
              </div>
            </div>
            <div className="cl-field">
              <label className="cl-label">Apellido y nombre del Afiliado</label>
              <input
                className="cl-input cl-input--ro"
                value={nombreAfiliado}
                readOnly
              />
            </div>
          </div>

          {/* Tabla de pasos */}
          <div className="cl-section">
            <div className="cl-table-wrap">
              <table className="cl-table">
                <thead>
                  <tr>
                    <th className="cl-th-paso">Etapa</th>
                    <th>Área interviniente</th>
                    <th>Fecha</th>
                    <th>Agente</th>
                  </tr>
                </thead>
                <tbody>
                  {caratula.pasos.map((paso, idx) => {
                    const tieneNro = paso.nombre === 'Trámite de TyA' || paso.nombre === 'Disposición';
                    return (
                      <tr key={idx} className="cl-row">
                        <td className="cl-td-paso">
                          <span>{paso.nombre}</span>
                          {tieneNro && (
                            <div className="cl-nro-inline">
                              <span className="cl-nro-label">N°</span>
                              <input
                                className={`cl-input cl-input--sm${disabled ? ' cl-input--ro' : ''}`}
                                value={paso.nro || ''}
                                onChange={(e) => updatePaso(idx, 'nro', e.target.value)}
                                readOnly={disabled}
                                placeholder={editando ? '...' : '-'}
                              />
                            </div>
                          )}
                        </td>
                        <td>
                          <input
                            className={`cl-input cl-input--cell${disabled ? ' cl-input--ro' : ''}`}
                            value={paso.area}
                            onChange={(e) => updatePaso(idx, 'area', e.target.value)}
                            readOnly={disabled}
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            className={`cl-input cl-input--cell${disabled ? ' cl-input--ro' : ''}`}
                            value={paso.fecha}
                            onChange={(e) => updatePaso(idx, 'fecha', e.target.value)}
                            readOnly={disabled}
                          />
                        </td>
                        <td>
                          <input
                            className={`cl-input cl-input--cell${disabled ? ' cl-input--ro' : ''}`}
                            value={paso.agente}
                            onChange={(e) => updatePaso(idx, 'agente', e.target.value)}
                            readOnly={disabled}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Observaciones */}
          <div className="cl-section">
            <label className="cl-label">OBSERVACIONES</label>
            <textarea
              className={`cl-textarea${disabled ? ' cl-input--ro' : ''}`}
              value={caratula.observaciones}
              onChange={(e) => updateField('observaciones', e.target.value)}
              readOnly={disabled}
              rows={4}
              placeholder={editando ? 'Escriba observaciones...' : '-'}
            />
          </div>
        </div>
      </div>

      {/* Modal de confirmación */}
      {showConfirm && (
        <div className="cl-overlay" onClick={() => setShowConfirm(false)}>
          <div className="cl-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cl-modal-title">Confirmar cambios</h3>
            <p className="cl-modal-text">
              ¿Está seguro de que desea guardar los cambios en la carátula del legajo?
            </p>
            <div className="cl-modal-actions">
              <button
                className="cl-btn cl-btn--outline"
                onClick={() => setShowConfirm(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className="cl-btn cl-btn--success"
                onClick={guardar}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Sí, guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
