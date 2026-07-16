import { useState } from 'react';
import './globales.css';
import './afiliados.css';
import logoSiglas from './logo-siglas.svg';

/* ─── Types ──────────────────────────────────────────────────── */
interface FechasAfiliado {
  fecha_alta: string | null;
  fecha_baja: string | null;
  fecha_vto: string | null;
  fecha_carencia: string | null;
}

interface LaboralesData {
  empleador: string | null;
  legajo: number | null;
  expediente: string | null;
  fecha_ingreso: string | null;
  situacion_laboral: string | null;
  benef_jubilatorio: number | null;
  benef_jubilatorio2: number | null;
  tipo_otro_benef: string | null;
  resolucion: string | null;
  obs: string | null;
}

interface DomicilioData {
  domicilio: string;
  numero?: string;
  piso?: string;
  dpto?: string;
  localidad: string;
  provincia: string;
  c_postal: number | null;
}

interface TelefonoData {
  cod_area: string;
  numero: string;
  compania: string;
}

interface EmailData {
  descripcion: string;
}

interface TitularData {
  documento: number;
  nombre: string;
  apellido: string;
}

interface CoberturaData {
  tipo: string;
  desde: string | null;
  hasta: string | null;
}

interface CUDData {
  num_cud: number;
  fecha_emision: string | null;
  fecha_vto: string | null;
}

interface CronicoData {
  expediente: string | null;
  resolucion: string | null;
  porcentaje_disc: number | null;
  fecha_reexamen: string | null;
  fecha_baja: string | null;
  alta_medica: string | null;
  tot_perm: boolean;
  caja: string | null;
}

interface AfiliadoData {
  id_afiliado: number;
  barra: number;
  orden: number;
  documento: number;
  tipo_documento: string;
  cuil: string;
  nombre: string;
  apellido: string;
  nacimiento: string | null;
  fallecimiento: string | null;
  genero: string | null;
  estado_civil: string | null;
  categoria: string | null;
  parentesco: string | null;
  tipo_afiliado: string | null;
  discapacidad: string;
  obs: string | null;
  credencial: string | null;
  fechas: FechasAfiliado;
  laborales: LaboralesData | null;
  domicilios: DomicilioData[];
  telefonos: TelefonoData[];
  emails: EmailData[];
  titular: TitularData | null;
  coberturas: CoberturaData[];
  cud: CUDData | null;
  cronico: CronicoData | null;
}

/* ─── Mock data ──────────────────────────────────────────────── */
const MOCK: AfiliadoData = {
  id_afiliado: 123456,
  barra: 1,
  orden: 123456,
  documento: 28456789,
  tipo_documento: 'DNI',
  cuil: '20-28456789-4',
  nombre: 'Juan Carlos',
  apellido: 'Rodríguez',
  nacimiento: '1985-03-15',
  fallecimiento: null,
  genero: 'Masculino',
  estado_civil: 'Casado',
  categoria: 'IPS',
  parentesco: 'Titular',
  tipo_afiliado: 'Activo',
  discapacidad: 'Sí',
  obs: 'Afiliado con antigüedad desde 2010. Sin novedades pendientes.',
  credencial: '102837465910',
  fechas: {
    fecha_alta: '2010-01-15',
    fecha_baja: null,
    fecha_vto: '2026-12-31',
    fecha_carencia: null,
  },
  laborales: {
    empleador: 'Municipalidad de Posadas',
    legajo: 12345,
    expediente: null,
    fecha_ingreso: '2010-01-10',
    situacion_laboral: 'Activo',
    benef_jubilatorio: null,
    benef_jubilatorio2: null,
    tipo_otro_benef: null,
    resolucion: 'RES-001/2010',
    obs: null,
  },
  domicilios: [
    {
      domicilio: 'Av. San Martín',
      numero: '1234',
      piso: 'PB',
      dpto: 'A',
      localidad: 'Posadas',
      provincia: 'Misiones',
      c_postal: 3300,
    },
  ],
  telefonos: [
    { cod_area: '376', numero: '4512345', compania: 'Personal' },
    { cod_area: '376', numero: '4445566', compania: '' },
  ],
  emails: [
    { descripcion: 'jrodriguez@mail.com' },
  ],
  titular: null,
  coberturas: [
    { tipo: 'Serv. Ambulatorios',     desde: '2010-01-15', hasta: null },
    { tipo: 'Serv. Amb. 50% int.',    desde: null,         hasta: null },
    { tipo: 'Serv. Amb. 100% int.',   desde: null,         hasta: null },
  ],
  cud: {
    num_cud: 987654,
    fecha_emision: '2020-06-01',
    fecha_vto: '2025-06-01',
  },
  cronico: {
    expediente: 'EXP-045/2020',
    resolucion: 'RES-012/2020',
    porcentaje_disc: 65,
    fecha_reexamen: '2025-06-01',
    fecha_baja: null,
    alta_medica: null,
    tot_perm: false,
    caja: '3',
  },
};

/* ─── Helpers ────────────────────────────────────────────────── */
function fmtDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-AR');
}

function fmtDoc(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/* ─── Component ──────────────────────────────────────────────── */
export default function Afiliados() {
  const [af, setAf] = useState<AfiliadoData>(MOCK);
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState<AfiliadoData>(deepCopy(MOCK));

  /* ── Updaters ── */
  const upd = (patch: Partial<AfiliadoData>) =>
    setDraft(d => ({ ...d, ...patch }));
  const updFechas = (patch: Partial<FechasAfiliado>) =>
    setDraft(d => ({ ...d, fechas: { ...d.fechas, ...patch } }));
  const updLab = (patch: Partial<LaboralesData>) =>
    setDraft(d => ({ ...d, laborales: d.laborales ? { ...d.laborales, ...patch } : null }));
  const updCronico = (patch: Partial<CronicoData>) =>
    setDraft(d => ({ ...d, cronico: d.cronico ? { ...d.cronico, ...patch } : null }));
  const updCud = (patch: Partial<CUDData>) =>
    setDraft(d => ({ ...d, cud: d.cud ? { ...d.cud, ...patch } : null }));
  const updDom = (i: number, patch: Partial<DomicilioData>) =>
    setDraft(d => {
      const doms = [...d.domicilios];
      doms[i] = { ...doms[i], ...patch };
      return { ...d, domicilios: doms };
    });
  const updTel = (i: number, patch: Partial<TelefonoData>) =>
    setDraft(d => {
      const tels = [...d.telefonos];
      tels[i] = { ...tels[i], ...patch };
      return { ...d, telefonos: tels };
    });
  const updEmail = (i: number, patch: Partial<EmailData>) =>
    setDraft(d => {
      const emails = [...d.emails];
      emails[i] = { ...emails[i], ...patch };
      return { ...d, emails };
    });
  const updCob = (i: number, patch: Partial<CoberturaData>) =>
    setDraft(d => {
      const cobs = [...d.coberturas];
      cobs[i] = { ...cobs[i], ...patch };
      return { ...d, coberturas: cobs };
    });

  function handleEditar() { setEditando(true); }
  function handleGuardar() { setAf(deepCopy(draft)); setEditando(false); }
  function handleCancelar() { setDraft(deepCopy(af)); setEditando(false); }

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    console.log('Buscar:', busqueda);
  }

  /* ── Render helpers ── */
  const EI = ({
    value, onChange, type = 'text', placeholder,
  }: {
    value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
  }) => (
    <input
      className="af-edit-input"
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  );

  const ES = ({
    value, onChange, options,
  }: {
    value: string; onChange: (v: string) => void; options: string[];
  }) => (
    <select className="af-edit-select" value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  /* ── Field: muestra span en vista, input/select en edición ── */
  const FV = ({
    val, className,
  }: {
    val: string; className?: string;
  }) => <span className={`af-value${className ? ` ${className}` : ''}`}>{val || '—'}</span>;

  return (
    <div className="af-page">

      {/* ── BARRA DE BÚSQUEDA ── */}
      <div className="af-toolbar">
        <form className="af-search-form" onSubmit={handleBuscar}>
          <div className="af-search-wrap">
            <svg className="af-search-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7"/>
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
            <input
              className="af-search-input"
              type="text"
              placeholder="Buscar por DNI o nombre..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              autoComplete="off"
            />
          </div>
          <button type="submit" className="af-btn af-btn--primary">Buscar</button>
        </form>

        {editando ? (
          <div className="af-toolbar-edit-btns">
            <button type="button" className="af-btn af-btn--primary" onClick={handleGuardar}>
              <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
                <path d="M4 10.5l4.5 4.5 7.5-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Guardar
            </button>
            <button type="button" className="af-btn af-btn--cancel" onClick={handleCancelar}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" className="af-btn af-btn--outline" onClick={handleEditar}>
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="15" height="15">
              <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-8.5 8.5a2 2 0 0 1-.828.5l-3 .75a.5.5 0 0 1-.621-.621l.75-3a2 2 0 0 1 .5-.828l8.5-8.5z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Editar
          </button>
        )}
      </div>

      <div className={`af-panel${editando ? ' af-panel--editing' : ''}`}>

        {/* ── HEADER ── */}
        <header className="af-header">
          <img src={logoSiglas} alt="IPS" className="af-logo" />
          <div className="af-identity">

            <h1 className="af-name">
              {editando ? (
                <>
                  <input
                    className="af-hdr-inline"
                    type="text"
                    value={draft.apellido}
                    onChange={e => upd({ apellido: e.target.value })}
                  />
                  <span className="af-hdr-sep">, </span>
                  <input
                    className="af-hdr-inline"
                    type="text"
                    value={draft.nombre}
                    onChange={e => upd({ nombre: e.target.value })}
                  />
                </>
              ) : (
                <>{draft.apellido}, {draft.nombre}</>
              )}
            </h1>

            <div className="af-meta">
              <span className="af-meta-item">
                {editando ? (
                  <>
                    <select
                      className="af-hdr-inline af-hdr-inline--sm"
                      value={draft.tipo_documento}
                      onChange={e => upd({ tipo_documento: e.target.value })}
                    >
                      {['DNI', 'LC', 'LE', 'Pasaporte', 'CI'].map(o => <option key={o}>{o}</option>)}
                    </select>
                    {' '}
                    <input
                      className="af-hdr-inline af-hdr-inline--sm"
                      type="number"
                      value={draft.documento}
                      onChange={e => upd({ documento: Number(e.target.value) })}
                    />
                  </>
                ) : (
                  <>{draft.tipo_documento} {fmtDoc(draft.documento)}</>
                )}
              </span>

              <span className="af-meta-item">
                {editando ? (
                  <>
                    {'CUIL '}
                    <input
                      className="af-hdr-inline af-hdr-inline--sm"
                      type="text"
                      value={draft.cuil}
                      onChange={e => upd({ cuil: e.target.value })}
                    />
                  </>
                ) : (
                  <>CUIL {draft.cuil}</>
                )}
              </span>

              <span className="af-meta-item">
                {editando ? (
                  <select
                    className="af-hdr-inline af-hdr-inline--sm"
                    value={draft.parentesco ?? ''}
                    onChange={e => upd({ parentesco: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {['Titular', 'Cónyuge', 'Hijo/a', 'Otro'].map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <>{draft.parentesco ?? '—'}</>
                )}
              </span>

              <span className="af-meta-item">
                {editando ? (
                  <input
                    className="af-hdr-inline af-hdr-inline--sm"
                    type="text"
                    placeholder="Categoría"
                    value={draft.categoria ?? ''}
                    onChange={e => upd({ categoria: e.target.value || null })}
                  />
                ) : (
                  <>{draft.categoria ?? '—'}</>
                )}
              </span>
            </div>

          </div>
        </header>

        {/* ── BODY ── */}
        <div className="af-body">

          {/* Columna izquierda */}
          <div className="af-col">

            <section className="af-section">
              <h3 className="af-section-title">Datos Personales</h3>
              <div className="af-fields">

                <div className="af-field">
                  <span className="af-label">Nacimiento</span>
                  {editando
                    ? <EI type="date" value={draft.nacimiento ?? ''} onChange={v => upd({ nacimiento: v || null })} />
                    : <FV val={fmtDate(draft.nacimiento)} />}
                </div>

                <div className="af-field">
                  <span className="af-label">Fallecimiento</span>
                  {editando
                    ? <EI type="date" value={draft.fallecimiento ?? ''} onChange={v => upd({ fallecimiento: v || null })} />
                    : <FV val={fmtDate(draft.fallecimiento)} className={draft.fallecimiento ? 'af-value--danger' : ''} />}
                </div>

                <div className="af-field">
                  <span className="af-label">Sexo</span>
                  {editando
                    ? <ES
                        value={draft.genero ?? ''}
                        onChange={v => upd({ genero: v })}
                        options={['Masculino', 'Femenino', 'No Binario']}
                      />
                    : <FV val={draft.genero ?? '—'} />}
                </div>

                <div className="af-field">
                  <span className="af-label">Estado Civil</span>
                  {editando
                    ? <ES
                        value={draft.estado_civil ?? ''}
                        onChange={v => upd({ estado_civil: v })}
                        options={['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión Convivencial']}
                      />
                    : <FV val={draft.estado_civil ?? '—'} />}
                </div>

                <div className="af-field">
                  <span className="af-label">Incapacitado</span>
                  {editando
                    ? <ES
                        value={draft.discapacidad}
                        onChange={v => upd({ discapacidad: v })}
                        options={['No', 'Sí']}
                      />
                    : <FV val={draft.discapacidad} />}
                </div>

                <div className="af-field">
                  <span className="af-label">Tipo de Afiliado</span>
                  {editando
                    ? <ES
                        value={draft.tipo_afiliado ?? ''}
                        onChange={v => upd({ tipo_afiliado: v })}
                        options={['Activo', 'Pasivo', 'Jubilado', 'Pensionado']}
                      />
                    : <FV val={draft.tipo_afiliado ?? '—'} />}
                </div>

              </div>
            </section>

            {draft.titular && (
              <section className="af-section">
                <h3 className="af-section-title">Titular de la Obra Social</h3>
                <div className="af-fields">
                  <div className="af-field">
                    <span className="af-label">Documento</span>
                    <span className="af-value">{fmtDoc(draft.titular.documento)}</span>
                  </div>
                  <div className="af-field af-field--full">
                    <span className="af-label">Apellido y Nombre</span>
                    <span className="af-value">{draft.titular.apellido}, {draft.titular.nombre}</span>
                  </div>
                </div>
              </section>
            )}

            {draft.laborales && (
              <section className="af-section af-section--grow">
                <h3 className="af-section-title">Laborales</h3>
                <div className="af-fields af-fields--compact">

                  <div className="af-field af-field--full">
                    <span className="af-label">Empleador</span>
                    {editando
                      ? <EI value={draft.laborales.empleador ?? ''} onChange={v => updLab({ empleador: v || null })} />
                      : <FV val={draft.laborales.empleador ?? '—'} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Legajo Laboral</span>
                    {editando
                      ? <EI type="number" value={draft.laborales.legajo?.toString() ?? ''} onChange={v => updLab({ legajo: v ? Number(v) : null })} />
                      : <FV val={draft.laborales.legajo?.toString() ?? '—'} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Categoría</span>
                    {editando
                      ? <EI value={draft.categoria ?? ''} onChange={v => upd({ categoria: v || null })} />
                      : <FV val={draft.categoria ?? '—'} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Fecha de Ingreso</span>
                    {editando
                      ? <EI type="date" value={draft.laborales.fecha_ingreso ?? ''} onChange={v => updLab({ fecha_ingreso: v || null })} />
                      : <FV val={fmtDate(draft.laborales.fecha_ingreso)} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Situación Laboral</span>
                    {editando
                      ? <EI value={draft.laborales.situacion_laboral ?? ''} onChange={v => updLab({ situacion_laboral: v || null })} />
                      : <FV val={draft.laborales.situacion_laboral ?? '—'} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Tipo Afiliado</span>
                    {editando
                      ? <EI value={draft.laborales.tipo_otro_benef ?? ''} onChange={v => updLab({ tipo_otro_benef: v || null })} />
                      : <FV val={draft.laborales.tipo_otro_benef ?? '—'} />}
                  </div>

                  <div className="af-field af-field--full">
                    <span className="af-label">Resolución IPS</span>
                    {editando
                      ? <EI value={draft.laborales.resolucion ?? ''} onChange={v => updLab({ resolucion: v || null })} />
                      : <FV val={draft.laborales.resolucion ?? '—'} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Expte. Jubilación</span>
                    {editando
                      ? <EI value={draft.laborales.expediente ?? ''} onChange={v => updLab({ expediente: v || null })} />
                      : <FV val={draft.laborales.expediente ?? '—'} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Otro Beneficio</span>
                    {editando
                      ? <EI type="number" value={draft.laborales.benef_jubilatorio2?.toString() ?? ''} onChange={v => updLab({ benef_jubilatorio2: v ? Number(v) : null })} />
                      : <FV val={draft.laborales.benef_jubilatorio2?.toString() ?? '—'} />}
                  </div>

                </div>
              </section>
            )}

          </div>

          {/* Columna derecha */}
          <div className="af-col">

            {/* CREDENCIAL */}
            <section className="af-section af-credencial-section">
              <h3 className="af-section-title">Credencial</h3>
              {editando ? (
                <EI value={draft.credencial ?? ''} onChange={v => upd({ credencial: v || null })} placeholder="N° credencial" />
              ) : (
                <div className="af-credencial-box">
                  {draft.credencial
                    ? <span className="af-credencial-num">{draft.credencial}</span>
                    : <span className="af-credencial-empty">Sin credencial</span>}
                </div>
              )}
            </section>

            <section className="af-section">
              <h3 className="af-section-title">Fechas</h3>
              <div className="af-fields">

                <div className="af-field">
                  <span className="af-label">Alta</span>
                  {editando
                    ? <EI type="date" value={draft.fechas.fecha_alta ?? ''} onChange={v => updFechas({ fecha_alta: v || null })} />
                    : <FV val={fmtDate(draft.fechas.fecha_alta)} />}
                </div>

                <div className="af-field">
                  <span className="af-label">Vtos.</span>
                  {editando
                    ? <EI type="date" value={draft.fechas.fecha_vto ?? ''} onChange={v => updFechas({ fecha_vto: v || null })} />
                    : <FV val={fmtDate(draft.fechas.fecha_vto)} />}
                </div>

                <div className="af-field">
                  <span className="af-label">Baja</span>
                  {editando
                    ? <EI type="date" value={draft.fechas.fecha_baja ?? ''} onChange={v => updFechas({ fecha_baja: v || null })} />
                    : <FV val={fmtDate(draft.fechas.fecha_baja)} />}
                </div>

                <div className="af-field">
                  <span className="af-label">Carencia</span>
                  {editando
                    ? <EI type="date" value={draft.fechas.fecha_carencia ?? ''} onChange={v => updFechas({ fecha_carencia: v || null })} />
                    : <FV val={fmtDate(draft.fechas.fecha_carencia)} />}
                </div>

              </div>
            </section>

            <section className="af-section">
              <h3 className="af-section-title">Coberturas</h3>
              <table className="af-cob-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Desde</th>
                    <th>Hasta</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.coberturas.map((cob, i) => (
                    <tr key={i}>
                      <td>{cob.tipo}</td>
                      <td className="af-cob-date-cell">
                        {editando
                          ? <EI type="date" value={cob.desde ?? ''} onChange={v => updCob(i, { desde: v || null })} />
                          : fmtDate(cob.desde)}
                      </td>
                      <td className="af-cob-date-cell">
                        {editando
                          ? <EI type="date" value={cob.hasta ?? ''} onChange={v => updCob(i, { hasta: v || null })} />
                          : fmtDate(cob.hasta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="af-section af-section--grow">
              <h3 className="af-section-title">OBS.</h3>
              {editando
                ? (
                  <textarea
                    className="af-edit-textarea"
                    value={draft.obs ?? ''}
                    onChange={e => upd({ obs: e.target.value || null })}
                    rows={4}
                  />
                )
                : <p className="af-obs-text">{draft.obs ?? '—'}</p>}
            </section>

          </div>
        </div>

        {/* ── CAPACIDADES DIFERENTES STRIP ── */}
        {draft.discapacidad !== 'No' && (
          <div className="af-disc-strip">
            <div className="af-disc-header">
              <span className="af-disc-title">Capacidades Diferentes</span>
            </div>
            <div className="af-disc-groups">

              <div className="af-disc-group">
                <span className="af-disc-group-label">Crónico</span>
                <div className="af-fields">

                  <div className="af-field">
                    <span className="af-label">Expediente</span>
                    {editando
                      ? <EI value={draft.cronico?.expediente ?? ''} onChange={v => updCronico({ expediente: v || null })} />
                      : <FV val={draft.cronico?.expediente ?? '—'} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Resolución</span>
                    {editando
                      ? <EI value={draft.cronico?.resolucion ?? ''} onChange={v => updCronico({ resolucion: v || null })} />
                      : <FV val={draft.cronico?.resolucion ?? '—'} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Porcentaje</span>
                    {editando
                      ? <EI type="number" value={draft.cronico?.porcentaje_disc?.toString() ?? ''} onChange={v => updCronico({ porcentaje_disc: v ? Number(v) : null })} />
                      : <FV val={draft.cronico?.porcentaje_disc != null ? `${draft.cronico.porcentaje_disc}%` : '—'} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Tot. y Perm.</span>
                    {editando
                      ? <ES
                          value={draft.cronico?.tot_perm ? 'Sí' : 'No'}
                          onChange={v => updCronico({ tot_perm: v === 'Sí' })}
                          options={['No', 'Sí']}
                        />
                      : <FV val={draft.cronico?.tot_perm ? 'Sí' : 'No'} className={draft.cronico?.tot_perm ? 'af-value--warning' : ''} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Caja N°</span>
                    {editando
                      ? <EI value={draft.cronico?.caja ?? ''} onChange={v => updCronico({ caja: v || null })} />
                      : <FV val={draft.cronico?.caja ?? '—'} />}
                  </div>

                </div>
              </div>

              <div className="af-disc-group">
                <span className="af-disc-group-label">Fechas</span>
                <div className="af-fields">

                  <div className="af-field">
                    <span className="af-label">Reexamen</span>
                    {editando
                      ? <EI type="date" value={draft.cronico?.fecha_reexamen ?? ''} onChange={v => updCronico({ fecha_reexamen: v || null })} />
                      : <FV val={fmtDate(draft.cronico?.fecha_reexamen ?? null)} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Baja</span>
                    {editando
                      ? <EI type="date" value={draft.cronico?.fecha_baja ?? ''} onChange={v => updCronico({ fecha_baja: v || null })} />
                      : <FV val={fmtDate(draft.cronico?.fecha_baja ?? null)} />}
                  </div>

                  <div className="af-field af-field--full">
                    <span className="af-label">Alta Médica</span>
                    {editando
                      ? <EI type="date" value={draft.cronico?.alta_medica ?? ''} onChange={v => updCronico({ alta_medica: v || null })} />
                      : <FV val={fmtDate(draft.cronico?.alta_medica ?? null)} />}
                  </div>

                </div>
              </div>

              <div className="af-disc-group">
                <span className="af-disc-group-label">CUD</span>
                <div className="af-fields">

                  <div className="af-field af-field--full">
                    <span className="af-label">N° CUD</span>
                    {editando
                      ? <EI type="number" value={draft.cud?.num_cud?.toString() ?? ''} onChange={v => updCud({ num_cud: v ? Number(v) : 0 })} />
                      : <FV val={draft.cud?.num_cud?.toString() ?? '—'} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Emisión</span>
                    {editando
                      ? <EI type="date" value={draft.cud?.fecha_emision ?? ''} onChange={v => updCud({ fecha_emision: v || null })} />
                      : <FV val={fmtDate(draft.cud?.fecha_emision ?? null)} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Vencimiento</span>
                    {editando
                      ? <EI type="date" value={draft.cud?.fecha_vto ?? ''} onChange={v => updCud({ fecha_vto: v || null })} />
                      : <FV val={fmtDate(draft.cud?.fecha_vto ?? null)} />}
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── DOMICILIOS (ancho completo) ── */}
        <section className="af-section">
          <h3 className="af-section-title">Domicilios</h3>
          {draft.domicilios.length === 0 ? (
            <p className="af-empty">Sin domicilios registrados</p>
          ) : (
            <table className="af-dom-table">
              <thead>
                <tr>
                  <th className="af-dom-col--calle">Calle</th>
                  <th className="af-dom-col--num">N°</th>
                  <th className="af-dom-col--sm">Piso</th>
                  <th className="af-dom-col--sm">Dpto</th>
                  <th className="af-dom-col--loc">Localidad</th>
                  <th className="af-dom-col--loc">Provincia</th>
                  <th className="af-dom-col--cp">C.P.</th>
                </tr>
              </thead>
              <tbody>
                {draft.domicilios.map((dom, i) => (
                  <tr key={i}>
                    <td className="af-dom-col--calle">{editando ? <EI value={dom.domicilio} onChange={v => updDom(i, { domicilio: v })} /> : dom.domicilio}</td>
                    <td className="af-dom-col--num">{editando ? <EI value={dom.numero ?? ''} onChange={v => updDom(i, { numero: v || undefined })} /> : (dom.numero ?? '—')}</td>
                    <td className="af-dom-col--sm">{editando ? <EI value={dom.piso ?? ''} onChange={v => updDom(i, { piso: v || undefined })} /> : (dom.piso ?? '—')}</td>
                    <td className="af-dom-col--sm">{editando ? <EI value={dom.dpto ?? ''} onChange={v => updDom(i, { dpto: v || undefined })} /> : (dom.dpto ?? '—')}</td>
                    <td className="af-dom-col--loc">{editando ? <EI value={dom.localidad} onChange={v => updDom(i, { localidad: v })} /> : dom.localidad}</td>
                    <td className="af-dom-col--loc">{editando ? <EI value={dom.provincia} onChange={v => updDom(i, { provincia: v })} /> : dom.provincia}</td>
                    <td className="af-dom-col--cp">{editando ? <EI type="number" value={dom.c_postal?.toString() ?? ''} onChange={v => updDom(i, { c_postal: v ? Number(v) : null })} /> : (dom.c_postal ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ── TEL / EMAIL STRIP ── */}
        <div className="af-contact-strip">

          <section className="af-section">
            <h3 className="af-section-title">Teléfonos</h3>
            {draft.telefonos.length === 0 ? (
              <p className="af-empty">Sin teléfonos</p>
            ) : (
              <table className="af-tel-table">
                <thead>
                  <tr>
                    <th>Cód. Área</th>
                    <th>Número</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.telefonos.map((t, i) => (
                    <tr key={i}>
                      <td>{editando ? <EI value={t.cod_area} onChange={v => updTel(i, { cod_area: v })} /> : t.cod_area}</td>
                      <td>{editando ? <EI value={t.numero} onChange={v => updTel(i, { numero: v })} /> : t.numero}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="af-section">
            <h3 className="af-section-title">Correos Electrónicos</h3>
            {draft.emails.length === 0 ? (
              <p className="af-empty">Sin correos registrados</p>
            ) : (
              <div className="af-contact-list">
                {draft.emails.map((e, i) => (
                  <div key={i} className="af-contact-item">
                    {editando
                      ? <EI value={e.descripcion} onChange={v => updEmail(i, { descripcion: v })} />
                      : <span className="af-contact-valor">{e.descripcion}</span>}
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

      </div>

    </div>
  );
}
