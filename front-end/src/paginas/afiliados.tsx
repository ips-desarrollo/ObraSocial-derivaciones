import { useState, useEffect, useRef } from 'react';
import NavBar from './NavBar';
import { fetchAuth, verificarSesion, API } from '../auth';
import './globales.css';
import './afiliados.css';
import logoSiglas from '../multimedia/logo-siglas.svg';

/* ─── Types ──────────────────────────────────────────────────── */
interface FechasAfiliado {
  fecha_alta: string | null;
  fecha_baja: string | null;
  fecha_vto: string | null;
  fecha_carencia: string | null;
}

interface EmpleadorOption {
  codigo: number;
  organismo: string;
}

interface LaboralesData {
  empleador: string | null;
  empleador_codigo: number | null;
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
  tipo: 'telefono' | 'celular';
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
  cud_id: number | null;
  cud_fecha: string | null;
  cud_fecha_emision: string | null;
  cud_fecha_vto: string | null;
  cud_path: string | null;
  cud_archivo: string | null;
  cud_numero: number | null;
  cud_numero_alfa: string | null;
  cud_nro_caja: number | null;
  cud_obs: string | null;
}

interface CronicoData {
  alta_medica: string | null;
  baja: string | null;
  reexamen: string | null;
  expediente: string | null;
  resolucion: string | null;
  obs: string | null;
  alta: string | null;
  porcentaje_incapacidad: number | null;
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
  nombre_completo: string;
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

/* ─── Afiliado vacío ─────────────────────────────────────────── */
/* Estado inicial sin datos: el front arranca limpio y sólo se llena
   con lo que devuelve la base de datos al seleccionar un afiliado. */
const VACIO: AfiliadoData = {
  id_afiliado: 0,
  barra: 0,
  orden: 0,
  documento: 0,
  tipo_documento: 'DNI',
  cuil: '',
  nombre: '',
  apellido: '',
  nombre_completo: '',
  nacimiento: null,
  fallecimiento: null,
  genero: null,
  estado_civil: null,
  categoria: null,
  parentesco: null,
  tipo_afiliado: null,
  discapacidad: 'No',
  obs: null,
  credencial: null,
  fechas: {
    fecha_alta: null,
    fecha_baja: null,
    fecha_vto: null,
    fecha_carencia: null,
  },
  laborales: {
    empleador: null,
    empleador_codigo: null,
    legajo: null,
    expediente: null,
    fecha_ingreso: null,
    situacion_laboral: null,
    benef_jubilatorio: null,
    benef_jubilatorio2: null,
    tipo_otro_benef: null,
    resolucion: null,
    obs: null,
  },
  domicilios: [],
  telefonos: [],
  emails: [],
  titular: null,
  coberturas: [],
  cud: null,
  cronico: null,
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

interface ResultadoBusqueda {
  id_afiliado: number;
  nombre_completo?: string;
  nombre?: string;
  apellido?: string;
  documento: number;
}

/* ─── Render helpers (fuera del componente para identidad estable) ── */
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

const FV = ({
  val, className,
}: {
  val: string; className?: string;
}) => <span className={`af-value${className ? ` ${className}` : ''}`}>{val || '—'}</span>;

/* ─── Persistencia (sobrevive al recargar la página) ─────────── */
const STORAGE_KEY = 'af_estado';

interface EstadoGuardado {
  af: AfiliadoData;
  busquedaNombre: string;
  busquedaDni: string;
}

function cargarEstado(): EstadoGuardado | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EstadoGuardado) : null;
  } catch {
    return null;
  }
}

/* ─── Component ──────────────────────────────────────────────── */
function esSoloLectura(): boolean {
  try {
    const u = localStorage.getItem('usuario');
    if (!u) return false;
    const roles: string[] = JSON.parse(u).roles || [];
    return roles.length === 1 && roles[0] === 'lectura';
  } catch { return false; }
}

export default function Afiliados() {
  const guardado = cargarEstado();
  const soloLectura = esSoloLectura();
  const [af, setAf] = useState<AfiliadoData>(guardado?.af ?? VACIO);
  const [busquedaNombre, setBusquedaNombre] = useState(guardado?.busquedaNombre ?? '');
  const [busquedaDni, setBusquedaDni] = useState(guardado?.busquedaDni ?? '');
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState<AfiliadoData>(deepCopy(guardado?.af ?? VACIO));
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [campoActivo, setCampoActivo] = useState<'nombre' | 'dni' | null>(null);
  const [indiceActivo, setIndiceActivo] = useState(-1);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [empleadores, setEmpleadores] = useState<EmpleadorOption[]>([]);
  const [buscando, setBuscando] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    verificarSesion();
    fetch(`${API}/empleadores`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEmpleadores(data); })
      .catch(() => {});
  }, []);

  /* Cierra el desplegable de resultados al hacer clic fuera de la barra de búsqueda. */
  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setCampoActivo(null);
        setResultados([]);
        setIndiceActivo(-1);
      }
    }
    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, []);

  /* Guarda el afiliado cargado y lo buscado, para que sobreviva al recargar. */
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ af, busquedaNombre, busquedaDni }),
      );
    } catch {
      /* almacenamiento no disponible: se ignora */
    }
  }, [af, busquedaNombre, busquedaDni]);

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
  const addTel = (tipo: 'telefono' | 'celular') =>
    setDraft(d => ({
      ...d,
      telefonos: [...d.telefonos, { cod_area: '', numero: '', compania: '', tipo }],
    }));
  const removeTel = (i: number) =>
    setDraft(d => ({ ...d, telefonos: d.telefonos.filter((_, idx) => idx !== i) }));
  const addEmail = () =>
    setDraft(d => ({ ...d, emails: [...d.emails, { descripcion: '' }] }));
  const removeEmail = (i: number) =>
    setDraft(d => ({ ...d, emails: d.emails.filter((_, idx) => idx !== i) }));
  const updCob = (i: number, patch: Partial<CoberturaData>) =>
    setDraft(d => {
      const cobs = [...d.coberturas];
      cobs[i] = { ...cobs[i], ...patch };
      return { ...d, coberturas: cobs };
    });

  function handleEditar() { setEditando(true); }

  /* Al presionar Guardar: si hubo cambios, pide confirmación; si no, sólo cierra. */
  function handleGuardar() {
    setErrorGuardar(null);
    const huboCambios = JSON.stringify(draft) !== JSON.stringify(af);
    if (!huboCambios) { setEditando(false); return; }
    setConfirmando(true);
  }

  function handleCancelar() { setDraft(deepCopy(af)); setEditando(false); }

  /* El usuario marcó "No" en el cartel: no se guarda nada, sigue en edición. */
  function cancelarConfirmacion() { setConfirmando(false); }

  /* El usuario marcó "Sí": impacta los cambios en la base de datos. */
  async function confirmarGuardar() {
    if (!verificarSesion()) return;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const res = await fetchAuth(`${API}/afiliados/${af.documento}`, {
        method: 'PUT',
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorGuardar(data.error || 'No se pudieron guardar los cambios.');
        return;
      }
      setAf(deepCopy(draft));
      setEditando(false);
      setConfirmando(false);
    } catch {
      setErrorGuardar('No se pudo conectar con el servidor.');
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutarBusqueda() {
    const tieneNombre = busquedaNombre.trim().length >= 2;
    const tieneDni = busquedaDni.trim().length >= 2;
    if (!tieneNombre && !tieneDni) return;

    const campo = tieneDni ? 'dni' : 'nombre';
    const q = tieneDni ? busquedaDni : busquedaNombre;

    setErrorBusqueda(null);
    setBuscando(true);
    try {
      const res = await fetch(
        `${API}/afiliados/buscar?q=${encodeURIComponent(q.trim())}&campo=${campo}`
      );
      const data = await res.json();
      if (data.error) { setErrorBusqueda(data.error); setResultados([]); }
      else setResultados(data);
      setIndiceActivo(-1);
      setCampoActivo(campo);
    } catch {
      setErrorBusqueda('No se pudo conectar con el servidor.');
      setCampoActivo(campo);
    } finally {
      setBuscando(false);
    }
  }

  function handleChangeNombre(e: React.ChangeEvent<HTMLInputElement>) {
    setBusquedaNombre(e.target.value);
  }

  function handleChangeDni(e: React.ChangeEvent<HTMLInputElement>) {
    setBusquedaDni(e.target.value.replace(/\D/g, ''));
  }

  function handleKeyDownBusqueda(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (campoActivo && resultados.length > 0) {
        const sel = indiceActivo >= 0 ? resultados[indiceActivo] : resultados[0];
        if (sel) { seleccionarAfiliado(sel); return; }
      }
      ejecutarBusqueda();
    } else if (campoActivo) {
      if (e.key === 'ArrowDown') {
        if (resultados.length === 0) return;
        e.preventDefault();
        setIndiceActivo(i => (i + 1) % resultados.length);
      } else if (e.key === 'ArrowUp') {
        if (resultados.length === 0) return;
        e.preventDefault();
        setIndiceActivo(i => (i <= 0 ? resultados.length - 1 : i - 1));
      } else if (e.key === 'Escape') {
        setCampoActivo(null);
        setResultados([]);
        setIndiceActivo(-1);
      }
    }
  }

  function nombreMostrar(r: ResultadoBusqueda): string {
    if (r.nombre_completo) return r.nombre_completo.trim();
    return `${(r.apellido ?? '').trim()} ${(r.nombre ?? '').trim()}`.trim();
  }

  const TIPO_DOC: Record<number, string> = { 1: 'DNI', 2: 'LC', 3: 'LE', 4: 'Pasaporte', 5: 'CI' };

  async function seleccionarAfiliado(r: ResultadoBusqueda) {
    setResultados([]);
    setCampoActivo(null);
    setIndiceActivo(-1);
    // Se limpian ambos campos de búsqueda para agilizar la siguiente búsqueda.
    setBusquedaNombre('');
    setBusquedaDni('');
    try {
      const res = await fetch(`${API}/afiliados/${r.documento}`);
      const data = await res.json();
      if (!res.ok || data.error || typeof data.documento !== 'number') {
        setErrorBusqueda(data.error || data.detail || 'No se pudo cargar el afiliado.');
        return;
      }

      const nuevo: AfiliadoData = {
        ...deepCopy(af),
        credencial: data.credencial ?? null,
        documento: data.documento,
        cuil: data.cuil ?? '',
        nombre: data.nombre ?? '',
        apellido: data.apellido ?? '',
        nombre_completo: data.nombre_completo ?? '',
        tipo_documento: TIPO_DOC[data.tipo_documento] ?? 'DNI',
        parentesco: data.parentesco != null ? String(data.parentesco) : null,
        categoria: data.categoria != null ? String(data.categoria) : null,
        nacimiento: data.nacimiento ?? null,
        fallecimiento: data.fallecimiento ?? null,
        genero: data.genero ?? null,
        estado_civil: data.estado_civil ?? null,
        discapacidad: data.discapacidad ?? 'No',
        obs: data.obs ?? null,
        tipo_afiliado: data.tipo_afiliado != null ? String(data.tipo_afiliado) : null,
        fechas: {
          fecha_alta: data.fechas?.fecha_alta ?? null,
          fecha_baja: data.fechas?.fecha_baja ?? null,
          fecha_vto: data.fechas?.fecha_vto ?? null,
          fecha_carencia: data.fechas?.fecha_carencia ?? null,
        },
        laborales: {
          empleador: data.laborales?.empleador ?? null,
          empleador_codigo: data.laborales?.empleador_codigo ?? null,
          legajo: data.laborales?.legajo ?? null,
          expediente: data.laborales?.expediente ?? null,
          fecha_ingreso: data.laborales?.fecha_ingreso ?? null,
          situacion_laboral: data.laborales?.situacion_laboral ?? null,
          benef_jubilatorio: data.laborales?.benef_jubilatorio ?? null,
          benef_jubilatorio2: data.laborales?.benef_jubilatorio2 ?? null,
          tipo_otro_benef: null,
          resolucion: data.laborales?.resolucion ?? null,
          obs: null,
        },
        domicilios: Array.isArray(data.domicilios)
          ? data.domicilios.map((d: Partial<DomicilioData>) => ({
              domicilio: d.domicilio ?? '',
              numero: d.numero ?? undefined,
              piso: d.piso ?? undefined,
              dpto: d.dpto ?? undefined,
              localidad: d.localidad ?? '',
              provincia: d.provincia ?? '',
              c_postal: d.c_postal ?? null,
            }))
          : [],
        telefonos: Array.isArray(data.telefonos)
          ? data.telefonos.map((t: Partial<TelefonoData>) => ({
              cod_area: '',
              numero: t.numero ?? '',
              compania: '',
              tipo: (t.tipo as 'telefono' | 'celular') ?? 'telefono',
            }))
          : [],
        emails: Array.isArray(data.emails)
          ? data.emails.map((e: Partial<EmailData>) => ({
              descripcion: e.descripcion ?? '',
            }))
          : [],
        cronico: data.cronico ? {
          alta_medica: data.cronico.alta_medica ?? null,
          baja: data.cronico.baja ?? null,
          reexamen: data.cronico.reexamen ?? null,
          expediente: data.cronico.expediente ?? null,
          resolucion: data.cronico.resolucion ?? null,
          obs: data.cronico.obs ?? null,
          alta: data.cronico.alta ?? null,
          porcentaje_incapacidad: data.cronico.porcentaje_incapacidad ?? null,
        } : null,
        cud: data.cud ? {
          cud_id: data.cud.cud_id ?? null,
          cud_fecha: data.cud.cud_fecha ?? null,
          cud_fecha_emision: data.cud.cud_fecha_emision ?? null,
          cud_fecha_vto: data.cud.cud_fecha_vto ?? null,
          cud_path: data.cud.cud_path ?? null,
          cud_archivo: data.cud.cud_archivo ?? null,
          cud_numero: data.cud.cud_numero ?? null,
          cud_numero_alfa: data.cud.cud_numero_alfa ?? null,
          cud_nro_caja: data.cud.cud_nro_caja ?? null,
          cud_obs: data.cud.cud_obs ?? null,
        } : null,
      };
      setAf(nuevo);
      setDraft(deepCopy(nuevo));
    } catch {
      setErrorBusqueda('No se pudo conectar con el servidor.');
    }
  }

  return (
    <>
    <NavBar />
    <div className="af-page">

      {/* ── BARRA DE BÚSQUEDA ── */}
      <div className="af-toolbar">
        <div className="af-search-form" ref={searchRef}>
          <div className="af-search-wrap">
            <svg className="af-search-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7"/>
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
            <input
              className="af-search-input"
              type="text"
              placeholder="Buscar por nombre..."
              value={busquedaNombre}
              onChange={handleChangeNombre}
              onKeyDown={handleKeyDownBusqueda}
              autoComplete="off"
            />
          </div>

          <div className="af-search-wrap af-search-wrap--dni">
            <svg className="af-search-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7"/>
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
            <input
              className="af-search-input"
              type="text"
              inputMode="numeric"
              placeholder="Buscar por DNI..."
              value={busquedaDni}
              onChange={handleChangeDni}
              onKeyDown={handleKeyDownBusqueda}
              autoComplete="off"
            />
          </div>

          <button
            type="button"
            className="af-btn af-btn--primary af-btn--buscar"
            onClick={ejecutarBusqueda}
            disabled={buscando || (busquedaNombre.trim().length < 2 && busquedaDni.trim().length < 2)}
          >
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7"/>
              <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
            {buscando ? 'Buscando…' : 'Buscar'}
          </button>

          {campoActivo && (resultados.length > 0 || errorBusqueda) && (
            <ul className="af-search-dropdown af-search-dropdown--below-form">
              {errorBusqueda && (
                <li className="af-search-dropdown-error">{errorBusqueda}</li>
              )}
              {resultados.length === 0 && !errorBusqueda && (
                <li className="af-search-dropdown-empty">Sin resultados</li>
              )}
              {resultados.map((r, idx) => (
                <li
                  key={r.id_afiliado}
                  className={`af-search-dropdown-item${indiceActivo === idx ? ' af-search-dropdown-item--active' : ''}`}
                  onMouseDown={() => seleccionarAfiliado(r)}
                  onMouseEnter={() => setIndiceActivo(idx)}
                >
                  <span className="af-search-nombre">{nombreMostrar(r)}</span>
                  <span className="af-search-doc">DNI {fmtDoc(r.documento)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!soloLectura && (editando ? (
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
        ))}
      </div>

      <div className={`af-panel${editando ? ' af-panel--editing' : ''}`}>

        {/* ── HEADER ── */}
        <header className="af-header">
          <div className="af-identity">

            <h1 className="af-name">
              {editando ? (
                <input
                  className="af-hdr-inline"
                  type="text"
                  value={draft.nombre_completo}
                  onChange={e => upd({ nombre_completo: e.target.value })}
                />
              ) : (
                <>{draft.nombre_completo || `${draft.apellido}, ${draft.nombre}`}</>
              )}
            </h1>

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
                    ? <EI value={draft.estado_civil ?? ''} onChange={v => upd({ estado_civil: v || null })} />
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

          {/* Columna derecha */}
          <div className="af-col">

            {/* DNI / CUIL / CREDENCIAL */}
            <section className="af-section af-credencial-section">
              <div className="af-id-cards">

                <div className="af-id-card">
                  <span className="af-id-card-label">{draft.tipo_documento}</span>
                  <span className="af-id-card-value">{fmtDoc(draft.documento)}</span>
                </div>

                <div className="af-id-card">
                  <span className="af-id-card-label">CUIL</span>
                  <span className="af-id-card-value">{draft.cuil || '—'}</span>
                </div>

                <div className="af-id-card af-id-card--credencial">
                  <span className="af-id-card-label">Credencial</span>
                  {draft.credencial
                    ? <span className="af-id-card-value af-id-card-value--credencial">{draft.credencial}</span>
                    : <span className="af-credencial-empty">Sin credencial</span>}
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
                      ? (
                        <select
                          className="af-edit-select af-edit-select--empleador"
                          value={
                            draft.laborales.empleador_codigo?.toString()
                            ?? empleadores.find(em => em.organismo === draft.laborales.empleador)?.codigo.toString()
                            ?? ''
                          }
                          onChange={e => {
                            const cod = e.target.value ? Number(e.target.value) : null;
                            const emp = empleadores.find(em => em.codigo === cod);
                            updLab({ empleador_codigo: cod, empleador: emp?.organismo ?? null });
                          }}
                        >
                          <option value="">— Seleccionar —</option>
                          {empleadores.map(em => (
                            <option key={em.codigo} value={em.codigo}>{em.organismo}</option>
                          ))}
                        </select>
                      )
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
                      ? <EI value={draft.tipo_afiliado ?? ''} onChange={v => upd({ tipo_afiliado: v || null })} />
                      : <FV val={draft.tipo_afiliado ?? '—'} />}
                  </div>

                  <div className="af-field">
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
                    <span className="af-label">Beneficio</span>
                    {editando
                      ? <EI type="number" value={draft.laborales.benef_jubilatorio?.toString() ?? ''} onChange={v => updLab({ benef_jubilatorio: v ? Number(v) : null })} />
                      : <FV val={draft.laborales.benef_jubilatorio?.toString() ?? '—'} />}
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
                    <span className="af-label">Alta Médica</span>
                    {editando
                      ? <EI type="date" value={draft.cronico?.alta_medica ?? ''} onChange={v => updCronico({ alta_medica: v || null })} />
                      : <FV val={fmtDate(draft.cronico?.alta_medica ?? null)} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Baja</span>
                    {editando
                      ? <EI type="date" value={draft.cronico?.baja ?? ''} onChange={v => updCronico({ baja: v || null })} />
                      : <FV val={fmtDate(draft.cronico?.baja ?? null)} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Reexamen</span>
                    {editando
                      ? <EI type="date" value={draft.cronico?.reexamen ?? ''} onChange={v => updCronico({ reexamen: v || null })} />
                      : <FV val={fmtDate(draft.cronico?.reexamen ?? null)} />}
                  </div>

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

                  <div className="af-field af-field--full">
                    <span className="af-label">OBS</span>
                    {editando
                      ? <EI value={draft.cronico?.obs ?? ''} onChange={v => updCronico({ obs: v || null })} />
                      : <FV val={draft.cronico?.obs ?? '—'} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Alta</span>
                    {editando
                      ? <EI type="date" value={draft.cronico?.alta ?? ''} onChange={v => updCronico({ alta: v || null })} />
                      : <FV val={fmtDate(draft.cronico?.alta ?? null)} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">% Incapacidad</span>
                    {editando
                      ? <EI type="number" value={draft.cronico?.porcentaje_incapacidad?.toString() ?? ''} onChange={v => updCronico({ porcentaje_incapacidad: v ? Number(v) : null })} />
                      : <FV val={draft.cronico?.porcentaje_incapacidad != null ? `${draft.cronico.porcentaje_incapacidad}%` : '—'} />}
                  </div>

                </div>
              </div>

              <div className="af-disc-group">
                <span className="af-disc-group-label">CUD</span>
                <div className="af-fields">

                  <div className="af-field">
                    <span className="af-label">ID</span>
                    <FV val={draft.cud?.cud_id?.toString() ?? '—'} />
                  </div>

                  <div className="af-field">
                    <span className="af-label">N° CUD</span>
                    {editando
                      ? <EI type="number" value={draft.cud?.cud_numero?.toString() ?? ''} onChange={v => updCud({ cud_numero: v ? Number(v) : null })} />
                      : <FV val={draft.cud?.cud_numero?.toString() ?? '—'} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">N° Alfa</span>
                    {editando
                      ? <EI value={draft.cud?.cud_numero_alfa ?? ''} onChange={v => updCud({ cud_numero_alfa: v || null })} />
                      : <FV val={draft.cud?.cud_numero_alfa ?? '—'} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Fecha</span>
                    {editando
                      ? <EI type="date" value={draft.cud?.cud_fecha ?? ''} onChange={v => updCud({ cud_fecha: v || null })} />
                      : <FV val={fmtDate(draft.cud?.cud_fecha ?? null)} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Emisión</span>
                    {editando
                      ? <EI type="date" value={draft.cud?.cud_fecha_emision ?? ''} onChange={v => updCud({ cud_fecha_emision: v || null })} />
                      : <FV val={fmtDate(draft.cud?.cud_fecha_emision ?? null)} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Vencimiento</span>
                    {editando
                      ? <EI type="date" value={draft.cud?.cud_fecha_vto ?? ''} onChange={v => updCud({ cud_fecha_vto: v || null })} />
                      : <FV val={fmtDate(draft.cud?.cud_fecha_vto ?? null)} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Path</span>
                    {editando
                      ? <EI value={draft.cud?.cud_path ?? ''} onChange={v => updCud({ cud_path: v || null })} />
                      : <FV val={draft.cud?.cud_path ?? '—'} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">Archivo</span>
                    {editando
                      ? <EI value={draft.cud?.cud_archivo ?? ''} onChange={v => updCud({ cud_archivo: v || null })} />
                      : <FV val={draft.cud?.cud_archivo ?? '—'} />}
                  </div>

                  <div className="af-field">
                    <span className="af-label">N° Caja</span>
                    {editando
                      ? <EI type="number" value={draft.cud?.cud_nro_caja?.toString() ?? ''} onChange={v => updCud({ cud_nro_caja: v ? Number(v) : null })} />
                      : <FV val={draft.cud?.cud_nro_caja?.toString() ?? '—'} />}
                  </div>

                  <div className="af-field af-field--full">
                    <span className="af-label">OBS</span>
                    {editando
                      ? <EI value={draft.cud?.cud_obs ?? ''} onChange={v => updCud({ cud_obs: v || null })} />
                      : <FV val={draft.cud?.cud_obs ?? '—'} />}
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
            {draft.telefonos.length === 0 && !editando ? (
              <p className="af-empty">Sin teléfonos</p>
            ) : (
              <>
                <table className="af-tel-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Número</th>
                      {editando && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {draft.telefonos.map((t, i) => (
                      <tr key={i}>
                        <td>{t.tipo === 'celular' ? 'Celular' : 'Teléfono'}</td>
                        <td>{editando ? <EI value={t.numero} onChange={v => updTel(i, { numero: v })} /> : t.numero}</td>
                        {editando && (
                          <td>
                            <button type="button" className="af-btn-remove" title="Quitar" onClick={() => removeTel(i)}>✕</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {editando && (
                  <div className="af-add-btns">
                    {!draft.telefonos.some(t => t.tipo === 'telefono') && (
                      <button type="button" className="af-btn af-btn--add" onClick={() => addTel('telefono')}>+ Teléfono</button>
                    )}
                    {!draft.telefonos.some(t => t.tipo === 'celular') && (
                      <button type="button" className="af-btn af-btn--add" onClick={() => addTel('celular')}>+ Celular</button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          <section className="af-section">
            <h3 className="af-section-title">Correos Electrónicos</h3>
            {draft.emails.length === 0 && !editando ? (
              <p className="af-empty">Sin correos registrados</p>
            ) : (
              <>
                <div className="af-contact-list">
                  {draft.emails.map((e, i) => (
                    <div key={i} className="af-contact-item">
                      {editando
                        ? <>
                            <EI value={e.descripcion} onChange={v => updEmail(i, { descripcion: v })} />
                            <button type="button" className="af-btn-remove" title="Quitar" onClick={() => removeEmail(i)}>✕</button>
                          </>
                        : <span className="af-contact-valor">{e.descripcion}</span>}
                    </div>
                  ))}
                </div>
                {editando && draft.emails.length === 0 && (
                  <div className="af-add-btns">
                    <button type="button" className="af-btn af-btn--add" onClick={addEmail}>+ Correo Electrónico</button>
                  </div>
                )}
              </>
            )}
          </section>

        </div>

      </div>

      {/* ── CARTEL DE CONFIRMACIÓN AL GUARDAR ── */}
      {confirmando && (
        <div className="af-modal-overlay" onMouseDown={cancelarConfirmacion}>
          <div className="af-modal" onMouseDown={e => e.stopPropagation()}>
            <h2 className="af-modal-title">Confirmar cambios</h2>
            <p className="af-modal-text">
              ¿Estás seguro que querés guardar los cambios realizados?
            </p>
            {errorGuardar && <p className="af-modal-error">{errorGuardar}</p>}
            <div className="af-modal-btns">
              <button
                type="button"
                className="af-btn af-btn--primary"
                onClick={confirmarGuardar}
                disabled={guardando}
              >
                {guardando ? 'Guardando…' : 'Sí'}
              </button>
              <button
                type="button"
                className="af-btn af-btn--cancel"
                onClick={cancelarConfirmacion}
                disabled={guardando}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}
