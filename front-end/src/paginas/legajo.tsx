import { useState } from 'react';
import NavBar from './NavBar';
import logoSiglas from '../multimedia/logo-siglas.svg';
import { fetchAuth, API } from '../auth';
import FormularioDerivacion, {
  Derivacion,
  formatFecha,
  formatMonto,
  montoTotal,
  esSoloLectura,
} from './FormularioDerivacion';
import './globales.css';
import './legajo.css';

interface Afiliado {
  documento: number;
  nombre_completo: string;
  nombre: string;
  apellido: string;
  credencial: string | null;
  nacimiento: string | null;
  genero: string | null;
}

export default function Legajo() {
  const soloLectura = esSoloLectura();
  const [documento, setDocumento] = useState('');
  const [afiliado, setAfiliado] = useState<Afiliado | null>(null);
  const [derivaciones, setDerivaciones] = useState<Derivacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [buscado, setBuscado] = useState(false);
  const [detalle, setDetalle] = useState<{ modo: 'ver' | 'editar'; deriv: Derivacion } | null>(null);

  async function buscarLegajo() {
    const doc = documento.trim();
    if (!doc) {
      setError('Ingresá un número de documento');
      return;
    }
    setLoading(true);
    setError('');
    setDetalle(null);
    try {
      const [resAf, resDer] = await Promise.all([
        fetchAuth(`${API}/afiliados/${encodeURIComponent(doc)}`),
        fetchAuth(`${API}/derivaciones?documento=${encodeURIComponent(doc)}`),
      ]);

      if (resAf.ok) {
        const dataAf = await resAf.json();
        setAfiliado(dataAf && !dataAf.error ? dataAf : null);
      } else {
        setAfiliado(null);
      }

      if (resDer.ok) {
        const dataDer = await resDer.json();
        setDerivaciones(Array.isArray(dataDer) ? dataDer : []);
      } else {
        setDerivaciones([]);
      }
    } catch (e: any) {
      setError(e.message || 'Error al buscar el legajo');
      setAfiliado(null);
      setDerivaciones([]);
    } finally {
      setLoading(false);
      setBuscado(true);
    }
  }

  const nombreAfiliado =
    afiliado?.nombre_completo ||
    (afiliado ? `${afiliado.apellido || ''} ${afiliado.nombre || ''}`.trim() : '') ||
    (derivaciones[0]?.afiliado_nombre ?? '');

  /* ── Vista: Detalle de una derivación (ver / editar) ── */
  if (detalle) {
    return (
      <>
        <NavBar />
        <FormularioDerivacion
          modo={detalle.modo}
          mes={detalle.deriv.mes}
          derivacion={detalle.deriv}
          onVolver={() => setDetalle(null)}
          onGuardado={buscarLegajo}
        />
      </>
    );
  }

  /* ── Vista: Legajo (búsqueda + listado) ── */
  return (
    <>
      <NavBar />
      <div className="lg-page">
        <div className="lg-panel">
          <div className="lg-header lg-header--search">
            <img src={logoSiglas} alt="IPS" className="lg-header-logo" />
            <div className="lg-search-wrap">
              <div className="lg-search-row">
                <input
                  className="lg-search-input"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') buscarLegajo(); }}
                  placeholder="Buscar legajo por documento..."
                  inputMode="numeric"
                />
                <button className="lg-btn lg-btn--search" onClick={buscarLegajo} disabled={loading}>
                  {loading ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </div>
          </div>

          <div className="lg-body">
            {error && <p className="lg-msg lg-msg--error">{error}</p>}

            {!buscado && !error && (
              <p className="lg-empty">Ingresá un documento para ver el legajo del afiliado.</p>
            )}

            {buscado && !loading && (
              <>
                {(afiliado || nombreAfiliado) && (
                  <div className="lg-afiliado-card">
                    <div className="lg-afiliado-avatar">
                      {(nombreAfiliado || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="lg-afiliado-info">
                      <span className="lg-afiliado-name">{nombreAfiliado || '-'}</span>
                      <div className="lg-afiliado-meta">
                        <span>DNI {documento.trim()}</span>
                        {afiliado?.credencial && <span>Credencial {afiliado.credencial}</span>}
                        {afiliado?.genero && <span>{afiliado.genero}</span>}
                      </div>
                    </div>
                    <span className="lg-afiliado-count">
                      {derivaciones.length} derivación{derivaciones.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                )}

                {derivaciones.length === 0 ? (
                  <p className="lg-empty">
                    {afiliado
                      ? 'Este afiliado no tiene derivaciones cargadas.'
                      : 'No se encontró ningún afiliado con ese documento.'}
                  </p>
                ) : (
                  <div className="lg-table-wrap">
                    <table className="lg-table">
                      <thead>
                        <tr>
                          <th>N° Disp.</th>
                          <th>Fecha</th>
                          <th>Fecha turno</th>
                          <th>Tipo patología</th>
                          <th>Diagnóstico</th>
                          <th>Tratamiento</th>
                          <th>Monto Total</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {derivaciones.map((d) => (
                          <tr key={d.id} className="lg-row">
                            <td>
                              {d.nro_disposicion
                                ? <span className="lg-disp-badge">{d.nro_disposicion}</span>
                                : <span className="lg-cell-empty">-</span>}
                            </td>
                            <td className="lg-fecha-cell">{formatFecha(d.fecha)}</td>
                            <td className="lg-fecha-cell">{formatFecha(d.fecha_turno)}</td>
                            <td>{d.tipo_patologia_nombre || '-'}</td>
                            <td>{d.diagnostico_nombre || '-'}</td>
                            <td>{d.tratamiento || d.tratamiento_nombre || '-'}</td>
                            <td className="lg-monto-cell">{formatMonto(montoTotal(d))}</td>
                            <td>
                              <div className="lg-actions">
                                <button
                                  className="dv-btn dv-btn--outline dv-btn--sm"
                                  onClick={() => setDetalle({ modo: 'ver', deriv: d })}
                                >
                                  Ver
                                </button>
                                {!soloLectura && (
                                  <button
                                    className="dv-btn dv-btn--primary dv-btn--sm"
                                    onClick={() => setDetalle({ modo: 'editar', deriv: d })}
                                  >
                                    Editar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
