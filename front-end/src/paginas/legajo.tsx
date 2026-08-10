import { useState } from 'react';
import NavBar from './NavBar';
import logoSiglas from '../multimedia/logo-siglas.svg';
import { fetchAuth, API } from '../auth';
import './globales.css';
import './legajo.css';

interface Derivacion {
  id: number;
  mes: string;
  nro_disposicion: string | null;
  fecha: string | null;
  afiliado_documento: string;
  afiliado_nombre: string | null;
  afiliado_credencial: string | null;
  afiliado_edad: number | null;
  afiliado_sexo: string | null;
  expediente: string | null;
  tipo_patologia: string | null;
  diagnostico: string | null;
  tratamiento: string | null;
  fecha_turno: string | null;
  tipo_patologia_nombre: string | null;
  tratamiento_nombre: string | null;
  diagnostico_nombre: string | null;
  diagnostico_tratamiento: string | null;
  destino: string | null;
  cobertura_prestacion: string | null;
  centro_medico: string | null;
  monto_prestacion: number | null;
  tipo_traslado: string | null;
  cant_acompanantes: number | null;
  monto_traslado: number | null;
  cobertura_alojamiento: string | null;
  tipo_alojamiento: string | null;
  lugar_alojamiento: string | null;
  cant_noches: number | null;
  monto_alojamiento: number | null;
}

interface Afiliado {
  documento: number;
  nombre_completo: string;
  nombre: string;
  apellido: string;
  credencial: string | null;
  nacimiento: string | null;
  genero: string | null;
}

function formatFecha(f: string | null): string {
  if (!f) return '-';
  const [y, m, d] = f.slice(0, 10).split('-');
  if (!y || !m || !d) return f;
  return `${d}/${m}/${y}`;
}

function formatMes(mes: string): string {
  const [y, m] = mes.split('-');
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  if (!y || !m) return mes;
  return `${meses[parseInt(m) - 1]} ${y}`;
}

function formatMonto(v: number | null): string {
  if (v == null) return '-';
  return `$${v.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}

function montoTotal(d: Derivacion): number {
  return (d.monto_prestacion ?? 0) + (d.monto_traslado ?? 0) + (d.monto_alojamiento ?? 0);
}

export default function Legajo() {
  const [documento, setDocumento] = useState('');
  const [afiliado, setAfiliado] = useState<Afiliado | null>(null);
  const [derivaciones, setDerivaciones] = useState<Derivacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [buscado, setBuscado] = useState(false);
  const [seleccionada, setSeleccionada] = useState<Derivacion | null>(null);

  async function buscarLegajo() {
    const doc = documento.trim();
    if (!doc) {
      setError('Ingresá un número de documento');
      return;
    }
    setLoading(true);
    setError('');
    setSeleccionada(null);
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

  /* ── Vista: Detalle de una derivación ── */
  if (seleccionada) {
    const d = seleccionada;
    return (
      <>
        <NavBar />
        <div className="lg-page">
          <div className="lg-toolbar">
            <button className="lg-btn lg-btn--outline" onClick={() => setSeleccionada(null)}>
              ← Volver al legajo
            </button>
            <div className="lg-toolbar-spacer" />
            <h1 className="lg-toolbar-title">
              {d.nro_disposicion ? `Disposición ${d.nro_disposicion}` : 'Derivación'}
            </h1>
            <div className="lg-toolbar-spacer" />
            <span className="lg-toolbar-mes">{formatMes(d.mes)}</span>
          </div>

          <div className="lg-panel">
            <div className="lg-header">
              <img src={logoSiglas} alt="IPS" className="lg-header-logo" />
              <div className="lg-header-info">
                <h1 className="lg-header-title">{d.afiliado_nombre || nombreAfiliado || '-'}</h1>
                <span className="lg-header-sub">DNI {d.afiliado_documento}</span>
              </div>
              <span className="lg-header-fecha">{formatFecha(d.fecha)}</span>
            </div>

            <div className="lg-detalle">
              <section className="lg-detalle-group">
                <p className="lg-detalle-section">Datos de la Derivación</p>
                <div className="lg-detalle-grid">
                  <Campo label="N° Disposición" value={d.nro_disposicion} />
                  <Campo label="Fecha" value={formatFecha(d.fecha)} />
                  <Campo label="Expediente" value={d.expediente} />
                  <Campo label="Destino" value={d.destino} />
                  <Campo label="Centro médico" value={d.centro_medico} />
                  <Campo label="Cobertura" value={d.cobertura_prestacion} />
                  <Campo label="Monto prestación" value={formatMonto(d.monto_prestacion)} />
                </div>
              </section>

              <section className="lg-detalle-group">
                <p className="lg-detalle-section">Datos del Afiliado</p>
                <div className="lg-detalle-grid">
                  <Campo label="DNI" value={String(d.afiliado_documento)} />
                  <Campo label="Credencial" value={d.afiliado_credencial} />
                  <Campo label="Edad" value={d.afiliado_edad != null ? String(d.afiliado_edad) : null} />
                  <Campo label="Sexo" value={d.afiliado_sexo} />
                </div>
              </section>

              <section className="lg-detalle-group">
                <p className="lg-detalle-section">Patología y Tratamiento</p>
                <div className="lg-detalle-grid">
                  <Campo label="Patología" value={d.tipo_patologia || d.tipo_patologia_nombre} />
                  <Campo label="Diagnóstico" value={d.diagnostico || d.diagnostico_nombre} full />
                  <Campo label="Tratamiento" value={d.tratamiento || d.tratamiento_nombre} />
                  <Campo label="Fecha de turno" value={formatFecha(d.fecha_turno)} />
                </div>
              </section>

              <section className="lg-detalle-group">
                <p className="lg-detalle-section">Traslado</p>
                <div className="lg-detalle-grid">
                  <Campo label="Tipo" value={d.tipo_traslado} />
                  <Campo label="Acompañantes" value={d.cant_acompanantes != null ? String(d.cant_acompanantes) : null} />
                  <Campo label="Monto" value={formatMonto(d.monto_traslado)} />
                </div>
              </section>

              <section className="lg-detalle-group">
                <p className="lg-detalle-section">Alojamiento</p>
                <div className="lg-detalle-grid">
                  <Campo label="Cobertura" value={d.cobertura_alojamiento} />
                  <Campo label="Tipo" value={d.tipo_alojamiento} />
                  <Campo label="Lugar" value={d.lugar_alojamiento} />
                  <Campo label="Cant. noches" value={d.cant_noches != null ? String(d.cant_noches) : null} />
                  <Campo label="Monto" value={formatMonto(d.monto_alojamiento)} />
                </div>
              </section>

              <div className="lg-detalle-total">
                <span className="lg-detalle-total-label">Monto Total</span>
                <span className="lg-detalle-total-value">{formatMonto(montoTotal(d))}</span>
              </div>
            </div>
          </div>
        </div>
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
                          <th>Patología</th>
                          <th>Tratamiento</th>
                          <th>Monto Total</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {derivaciones.map((d) => (
                          <tr key={d.id} className="lg-row" onClick={() => setSeleccionada(d)}>
                            <td>
                              {d.nro_disposicion
                                ? <span className="lg-disp-badge">{d.nro_disposicion}</span>
                                : <span className="lg-cell-empty">-</span>}
                            </td>
                            <td className="lg-fecha-cell">{formatFecha(d.fecha)}</td>
                            <td>{d.tipo_patologia || d.tipo_patologia_nombre || '-'}</td>
                            <td>{d.tratamiento || d.tratamiento_nombre || '-'}</td>
                            <td className="lg-monto-cell">{formatMonto(montoTotal(d))}</td>
                            <td className="lg-arrow-cell">→</td>
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

function Campo({ label, value, full }: { label: string; value: string | null | undefined; full?: boolean }) {
  return (
    <div className={`lg-campo${full ? ' lg-campo--full' : ''}`}>
      <span className="lg-campo-label">{label}</span>
      <span className="lg-campo-value">{value || '-'}</span>
    </div>
  );
}
