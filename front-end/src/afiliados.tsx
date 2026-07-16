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

function initials(nombre: string, apellido: string): string {
  return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase();
}

/* ─── Component ──────────────────────────────────────────────── */
export default function Afiliados() {
  const af = MOCK;
  const [busqueda, setBusqueda] = useState('');

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    // TODO: conectar con backend — buscar por DNI o nombre
    console.log('Buscar:', busqueda);
  }

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
        <button type="button" className="af-btn af-btn--outline">
          <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="15" height="15">
            <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-8.5 8.5a2 2 0 0 1-.828.5l-3 .75a.5.5 0 0 1-.621-.621l.75-3a2 2 0 0 1 .5-.828l8.5-8.5z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Editar
        </button>
      </div>

      <div className="af-panel">

      {/* ── HEADER ── */}
      <header className="af-header">
        <img src={logoSiglas} alt="IPS" className="af-logo" />

        <div className="af-identity">
          <h1 className="af-name">{af.apellido}, {af.nombre}</h1>
          <div className="af-meta">
            <span className="af-meta-item">{af.tipo_documento} {fmtDoc(af.documento)}</span>
            <span className="af-meta-item">CUIL {af.cuil}</span>
            {af.parentesco && <span className="af-meta-item">{af.parentesco}</span>}
            {af.categoria  && <span className="af-meta-item">{af.categoria}</span>}
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
                <span className="af-value">{fmtDate(af.nacimiento)}</span>
              </div>
              <div className="af-field">
                <span className="af-label">Fallecimiento</span>
                <span className={`af-value ${af.fallecimiento ? 'af-value--danger' : ''}`}>
                  {fmtDate(af.fallecimiento)}
                </span>
              </div>
              <div className="af-field">
                <span className="af-label">Sexo</span>
                <span className="af-value">{af.genero ?? '—'}</span>
              </div>
              <div className="af-field">
                <span className="af-label">Estado Civil</span>
                <span className="af-value">{af.estado_civil ?? '—'}</span>
              </div>
              <div className="af-field">
                <span className="af-label">Incapacitado</span>
                <span className="af-value">{af.discapacidad}</span>
              </div>
              <div className="af-field">
                <span className="af-label">Tipo de Afiliado</span>
                <span className="af-value">{af.tipo_afiliado ?? '—'}</span>
              </div>
            </div>
          </section>

          {af.titular && (
            <section className="af-section">
              <h3 className="af-section-title">Titular de la Obra Social</h3>
              <div className="af-fields">
                <div className="af-field">
                  <span className="af-label">Documento</span>
                  <span className="af-value">{fmtDoc(af.titular.documento)}</span>
                </div>
                <div className="af-field af-field--full">
                  <span className="af-label">Apellido y Nombre</span>
                  <span className="af-value">{af.titular.apellido}, {af.titular.nombre}</span>
                </div>
              </div>
            </section>
          )}

          {af.laborales && (
            <section className="af-section af-section--grow">
              <h3 className="af-section-title">Laborales</h3>
              <div className="af-fields af-fields--compact">
                <div className="af-field af-field--full">
                  <span className="af-label">Empleador</span>
                  <span className="af-value">{af.laborales.empleador ?? '—'}</span>
                </div>
                <div className="af-field">
                  <span className="af-label">Legajo Laboral</span>
                  <span className="af-value">{af.laborales.legajo ?? '—'}</span>
                </div>
                <div className="af-field">
                  <span className="af-label">Categoría</span>
                  <span className="af-value">{af.categoria ?? '—'}</span>
                </div>
                <div className="af-field">
                  <span className="af-label">Fecha de Ingreso</span>
                  <span className="af-value">{fmtDate(af.laborales.fecha_ingreso)}</span>
                </div>
                <div className="af-field">
                  <span className="af-label">Situación Laboral</span>
                  <span className="af-value">{af.laborales.situacion_laboral ?? '—'}</span>
                </div>
                <div className="af-field">
                  <span className="af-label">Tipo Afiliado</span>
                  <span className="af-value">{af.laborales.tipo_otro_benef ?? '—'}</span>
                </div>
                <div className="af-field af-field--full">
                  <span className="af-label">Resolución IPS</span>
                  <span className="af-value">{af.laborales.resolucion ?? '—'}</span>
                </div>
                <div className="af-field">
                  <span className="af-label">Expte. Jubilación</span>
                  <span className="af-value">{af.laborales.expediente ?? '—'}</span>
                </div>
                <div className="af-field">
                  <span className="af-label">Otro Beneficio</span>
                  <span className="af-value">{af.laborales.benef_jubilatorio2 ?? '—'}</span>
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
            <div className="af-credencial-box">
              {af.credencial ? (
                <span className="af-credencial-num">{af.credencial}</span>
              ) : (
                <span className="af-credencial-empty">Sin credencial</span>
              )}
            </div>
          </section>

          <section className="af-section">
            <h3 className="af-section-title">Fechas</h3>
            <div className="af-fields">
              <div className="af-field">
                <span className="af-label">Alta</span>
                <span className="af-value">{fmtDate(af.fechas.fecha_alta)}</span>
              </div>
              <div className="af-field">
                <span className="af-label">Vtos.</span>
                <span className="af-value">{fmtDate(af.fechas.fecha_vto)}</span>
              </div>
              <div className="af-field">
                <span className="af-label">Baja</span>
                <span className="af-value">{fmtDate(af.fechas.fecha_baja)}</span>
              </div>
              <div className="af-field">
                <span className="af-label">Carencia</span>
                <span className="af-value">{fmtDate(af.fechas.fecha_carencia)}</span>
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
                {af.coberturas.map((cob, i) => (
                  <tr key={i}>
                    <td>{cob.tipo}</td>
                    <td>{fmtDate(cob.desde)}</td>
                    <td>{fmtDate(cob.hasta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {af.obs && (
            <section className="af-section af-section--grow">
              <h3 className="af-section-title">OBS.</h3>
              <p className="af-obs-text">{af.obs}</p>
            </section>
          )}

        </div>
      </div>

      {/* ── CAPACIDADES DIFERENTES STRIP ── */}
      {af.discapacidad !== 'No' && (
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
                  <span className="af-value">{af.cronico?.expediente ?? '—'}</span>
                </div>
                <div className="af-field">
                  <span className="af-label">Resolución</span>
                  <span className="af-value">{af.cronico?.resolucion ?? '—'}</span>
                </div>
                <div className="af-field">
                  <span className="af-label">Porcentaje</span>
                  <span className="af-value">
                    {af.cronico?.porcentaje_disc != null ? `${af.cronico.porcentaje_disc}%` : '—'}
                  </span>
                </div>
                <div className="af-field">
                  <span className="af-label">Tot. y Perm.</span>
                  <span className={`af-value ${af.cronico?.tot_perm ? 'af-value--warning' : ''}`}>
                    {af.cronico?.tot_perm ? 'Sí' : 'No'}
                  </span>
                </div>
                <div className="af-field">
                  <span className="af-label">Caja N°</span>
                  <span className="af-value">{af.cronico?.caja ?? '—'}</span>
                </div>
              </div>
            </div>

            <div className="af-disc-group">
              <span className="af-disc-group-label">Fechas</span>
              <div className="af-fields">
                <div className="af-field">
                  <span className="af-label">Reexamen</span>
                  <span className="af-value">{fmtDate(af.cronico?.fecha_reexamen ?? null)}</span>
                </div>
                <div className="af-field">
                  <span className="af-label">Baja</span>
                  <span className="af-value">{fmtDate(af.cronico?.fecha_baja ?? null)}</span>
                </div>
                <div className="af-field af-field--full">
                  <span className="af-label">Alta Médica</span>
                  <span className="af-value">{fmtDate(af.cronico?.alta_medica ?? null)}</span>
                </div>
              </div>
            </div>

            <div className="af-disc-group">
              <span className="af-disc-group-label">CUD</span>
              <div className="af-fields">
                <div className="af-field af-field--full">
                  <span className="af-label">N° CUD</span>
                  <span className="af-value">{af.cud?.num_cud ?? '—'}</span>
                </div>
                <div className="af-field">
                  <span className="af-label">Emisión</span>
                  <span className="af-value">{fmtDate(af.cud?.fecha_emision ?? null)}</span>
                </div>
                <div className="af-field">
                  <span className="af-label">Vencimiento</span>
                  <span className="af-value">{fmtDate(af.cud?.fecha_vto ?? null)}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── CONTACTO STRIP ── */}
      <div className="af-contact-strip">

        <section className="af-section">
          <h3 className="af-section-title">Domicilios</h3>
          {af.domicilios.length === 0 ? (
            <p className="af-empty">Sin domicilios registrados</p>
          ) : (
            <table className="af-dom-table">
              <thead>
                <tr>
                  <th>Dir. Calle</th>
                  <th>Número</th>
                  <th>Piso</th>
                  <th>Dpto</th>
                  <th>Provincia</th>
                  <th>Localidad</th>
                  <th>Cód. Postal</th>
                </tr>
              </thead>
              <tbody>
                {af.domicilios.map((dom, i) => (
                  <tr key={i}>
                    <td>{dom.domicilio}</td>
                    <td>{dom.numero ?? '—'}</td>
                    <td>{dom.piso ?? '—'}</td>
                    <td>{dom.dpto ?? '—'}</td>
                    <td>{dom.provincia}</td>
                    <td>{dom.localidad}</td>
                    <td>{dom.c_postal ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="af-section">
          <h3 className="af-section-title">Teléfonos</h3>
          {af.telefonos.length === 0 ? (
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
                {af.telefonos.map((t, i) => (
                  <tr key={i}>
                    <td>{t.cod_area}</td>
                    <td>{t.numero}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="af-section">
          <h3 className="af-section-title">Correos Electrónicos</h3>
          {af.emails.length === 0 ? (
            <p className="af-empty">Sin correos registrados</p>
          ) : (
            <div className="af-contact-list">
              {af.emails.map((e, i) => (
                <div key={i} className="af-contact-item">
                  <span className="af-contact-valor">{e.descripcion}</span>
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
