import { useState, useEffect, useCallback } from 'react';
import SelectConCarga from './SelectConCarga';
import BuscadorAsync from './BuscadorAsync';
import CaratulaDerivacion from './CaratulaDerivacion';
import { fetchAuth, API } from '../auth';
import './derivaciones.css';
import './caratula-legajo.css';

/* ────────────────────────────────────────────────────────────────
 * Formulario de derivación reutilizable.
 *
 * Un solo componente cubre los tres modos:
 *   - 'crear'  : formulario vacío + búsqueda de afiliado (POST)
 *   - 'editar' : formulario cargado con una derivación (PUT)
 *   - 'ver'    : mismos campos, todos de solo lectura
 *
 * Se usa tanto en la pantalla de Derivaciones como en el Legajo, así
 * que la estética y la lógica viven en un único lugar.
 * ──────────────────────────────────────────────────────────────── */

export interface Derivacion {
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
  fecha_turno: string | null;
  diagnostico_tratamiento: string | null;
  destino: string | null;
  id_destino: number | null;
  id_cobertura: number | null;
  cobertura_prestacion: string | null;
  centro_medico: string | null;
  monto_prestacion: number | null;
  id_centro_medico: number | null;
  id_tipo_traslado: number | null;
  tipo_traslado: string | null;
  cant_acompanantes: number | null;
  monto_traslado: number | null;
  id_cobertura_alojamiento: number | null;
  cobertura_alojamiento: string | null;
  id_tipo_alojamiento: number | null;
  tipo_alojamiento: string | null;
  lugar_alojamiento: string | null;
  id_lugar_alojamiento: number | null;
  cant_noches: number | null;
  monto_alojamiento: number | null;
}

interface OpcionGuia {
  id: number;
  nombre: string;
}

interface AfiliadoBusqueda {
  documento: number;
  nombre_completo: string;
  nombre: string;
  apellido: string;
}

interface Patologia {
  pat_id: number;
  nombre: string;
  cie_clave: string;
  diagnostico?: string;
}

interface Diagnostico {
  codigo: string;
  descripcion: string;
}

interface FormData {
  nro_disposicion: string;
  fecha: string;
  afiliado_documento: number | null;
  afiliado_nombre: string;
  afiliado_credencial: string;
  afiliado_edad: number | null;
  afiliado_nacimiento: string | null;
  afiliado_sexo: string;
  expediente: string;
  tipo_patologia: string;
  diagnostico: string;
  fecha_turno: string;
  diagnostico_tratamiento: string;
  destino: string;
  id_destino: string;
  id_cobertura: string;
  id_centro_medico: string;
  monto_prestacion: string;
  id_tipo_traslado: string;
  cant_acompanantes: string;
  monto_traslado: string;
  id_cobertura_alojamiento: string;
  id_tipo_alojamiento: string;
  id_lugar_alojamiento: string;
  cant_noches: string;
  monto_alojamiento: string;
}

const emptyForm: FormData = {
  nro_disposicion: '',
  fecha: '',
  afiliado_documento: null,
  afiliado_nombre: '',
  afiliado_credencial: '',
  afiliado_edad: null,
  afiliado_nacimiento: null,
  afiliado_sexo: '',
  expediente: '',
  tipo_patologia: '',
  diagnostico: '',
  fecha_turno: '',
  diagnostico_tratamiento: '',
  destino: '',
  id_destino: '',
  id_cobertura: '',
  id_centro_medico: '',
  monto_prestacion: '',
  id_tipo_traslado: '',
  cant_acompanantes: '',
  monto_traslado: '',
  id_cobertura_alojamiento: '',
  id_tipo_alojamiento: '',
  id_lugar_alojamiento: '',
  cant_noches: '',
  monto_alojamiento: '',
};

/* ── Helpers compartidos (también los reutilizan las pantallas) ── */

export function formatMes(mes: string): string {
  const [y, m] = mes.split('-');
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  if (!y || !m) return mes;
  return `${meses[parseInt(m) - 1]} ${y}`;
}

export function formatFecha(f: string | null): string {
  if (!f) return '-';
  const [y, m, d] = f.slice(0, 10).split('-');
  if (!y || !m || !d) return f;
  return `${d}/${m}/${y}`;
}

export function formatMonto(v: number | null): string {
  if (v == null) return '-';
  return `$${v.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}

export function montoTotal(d: Derivacion): number {
  return (d.monto_prestacion ?? 0) + (d.monto_traslado ?? 0) + (d.monto_alojamiento ?? 0);
}

export function esSoloLectura(): boolean {
  try {
    const u = localStorage.getItem('usuario');
    if (!u) return false;
    const roles: string[] = JSON.parse(u).roles || [];
    return roles.length === 1 && roles[0] === 'lectura';
  } catch { return false; }
}

// Formatea lo que el usuario escribe a formato AR (1.000,00) mientras tipea
function formatMontoInput(raw: string): string {
  if (raw == null) return '';
  let s = raw.replace(/[^\d,]/g, '');
  const iComa = s.indexOf(',');
  if (iComa !== -1) {
    s = s.slice(0, iComa + 1) + s.slice(iComa + 1).replace(/,/g, '');
  }
  let [ent, dec] = s.split(',');
  ent = ent.replace(/^0+(?=\d)/, '');
  ent = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dec !== undefined ? `${ent},${dec.slice(0, 2)}` : ent;
}

// Convierte un número a formato AR para mostrar en el input al editar
function numeroAMontoInput(v: number | null): string {
  if (v == null) return '';
  return v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Convierte el texto del input (1.000,00) a número para guardar
function parseMontoInput(s: string): number | null {
  if (!s) return null;
  const norm = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(norm);
  return isNaN(n) ? null : n;
}

// Edad a la fecha de la derivación (no a la fecha actual), para no romper el
// historial. Si no hay fecha de referencia, cae a la fecha de hoy.
function calcularEdad(nacimiento: string | null, referencia?: string | null): number | null {
  if (!nacimiento) return null;
  const nac = new Date(nacimiento);
  const ref = referencia ? new Date(referencia) : new Date();
  let edad = ref.getFullYear() - nac.getFullYear();
  const m = ref.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < nac.getDate())) edad--;
  return edad;
}

// Mapea una derivación existente al estado del formulario (editar / ver).
function derivacionAForm(d: Derivacion): FormData {
  return {
    nro_disposicion: d.nro_disposicion || '',
    fecha: d.fecha || '',
    afiliado_documento: Number(d.afiliado_documento) || null,
    afiliado_nombre: d.afiliado_nombre || '',
    afiliado_credencial: d.afiliado_credencial || '',
    afiliado_edad: d.afiliado_edad,
    afiliado_nacimiento: null,
    afiliado_sexo: d.afiliado_sexo || '',
    expediente: d.expediente || '',
    tipo_patologia: d.tipo_patologia || '',
    diagnostico: d.diagnostico || '',
    fecha_turno: d.fecha_turno || '',
    destino: d.destino || '',
    id_destino: d.id_destino != null ? String(d.id_destino) : '',
    id_cobertura: d.id_cobertura != null ? String(d.id_cobertura) : '',
    id_centro_medico: d.id_centro_medico != null ? String(d.id_centro_medico) : '',
    monto_prestacion: numeroAMontoInput(d.monto_prestacion),
    id_tipo_traslado: d.id_tipo_traslado != null ? String(d.id_tipo_traslado) : '',
    cant_acompanantes: d.cant_acompanantes != null ? String(d.cant_acompanantes) : '',
    monto_traslado: numeroAMontoInput(d.monto_traslado),
    id_cobertura_alojamiento: d.id_cobertura_alojamiento != null ? String(d.id_cobertura_alojamiento) : '',
    id_tipo_alojamiento: d.id_tipo_alojamiento != null ? String(d.id_tipo_alojamiento) : '',
    id_lugar_alojamiento: d.id_lugar_alojamiento != null ? String(d.id_lugar_alojamiento) : '',
    cant_noches: d.cant_noches != null ? String(d.cant_noches) : '',
    monto_alojamiento: numeroAMontoInput(d.monto_alojamiento),
    diagnostico_tratamiento: d.diagnostico_tratamiento || '',
  };
}

export type ModoFormulario = 'crear' | 'editar' | 'ver';

interface Props {
  modo: ModoFormulario;
  mes: string;                        // contexto de mes (título + body al guardar)
  derivacion?: Derivacion | null;     // datos a cargar en editar / ver
  onVolver: () => void;               // botón "volver"
  onGuardado?: () => void;            // se llama tras guardar OK
}

export default function FormularioDerivacion({ modo, mes, derivacion, onVolver, onGuardado }: Props) {
  const soloLectura = esSoloLectura();
  const soloVista = modo === 'ver';
  const roCls = soloVista ? ' dv-form-input--ro' : '';

  const [form, setForm] = useState<FormData>(() =>
    derivacion && modo !== 'crear' ? derivacionAForm(derivacion) : { ...emptyForm },
  );
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [verCaratula, setVerCaratula] = useState(false);

  const [busquedaAfiliado, setBusquedaAfiliado] = useState('');
  const [resultadosAfiliado, setResultadosAfiliado] = useState<AfiliadoBusqueda[]>([]);


  const [coberturas, setCoberturas] = useState<OpcionGuia[]>([]);
  const [tiposTraslado, setTiposTraslado] = useState<OpcionGuia[]>([]);
  const [tiposAlojamiento, setTiposAlojamiento] = useState<OpcionGuia[]>([]);
  const [centrosMedicos, setCentrosMedicos] = useState<OpcionGuia[]>([]);
  const [destinos, setDestinos] = useState<OpcionGuia[]>([]);
  const [lugaresAlojamiento, setLugaresAlojamiento] = useState<OpcionGuia[]>([]);

  // Carga de catálogos (guías) una sola vez.
  useEffect(() => {
    async function cargarGuias() {
      try {
        const [resCob, resTrasl, resAloj, resCentro, resDestino, resLugar] = await Promise.all([
          fetchAuth(`${API}/coberturas`),
          fetchAuth(`${API}/tipos-traslado`),
          fetchAuth(`${API}/tipos-alojamiento`),
          fetchAuth(`${API}/centros-medicos`),
          fetchAuth(`${API}/destinos`),
          fetchAuth(`${API}/lugares-alojamiento`),
        ]);
        if (resCob.ok) setCoberturas(await resCob.json());
        if (resTrasl.ok) setTiposTraslado(await resTrasl.json());
        if (resAloj.ok) setTiposAlojamiento(await resAloj.json());
        if (resCentro.ok) setCentrosMedicos(await resCentro.json());
        if (resDestino.ok) setDestinos(await resDestino.json());
        if (resLugar.ok) setLugaresAlojamiento(await resLugar.json());
      } catch {}
    }
    cargarGuias();
  }, []);

  // Buscadores asíncronos: en vez de bajar toda la tabla (miles de filas) al
  // navegador, el servidor filtra por texto y devuelve sólo las primeras N.
  const buscarPatologias = useCallback(async (q: string): Promise<Patologia[]> => {
    const res = await fetch(`${API}/patologias/buscar?q=${encodeURIComponent(q)}&limit=15`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }, []);

  const buscarDiagnosticos = useCallback(async (q: string): Promise<Diagnostico[]> => {
    const res = await fetch(`${API}/diagnosticos/buscar?q=${encodeURIComponent(q)}&limit=15`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }, []);

  // Lista paginada (para el popup "Ver todas"): bloques de 10 navegables.
  const listarPatologias = useCallback(async (q: string, page: number) => {
    const res = await fetch(`${API}/patologias/lista?q=${encodeURIComponent(q)}&page=${page}&limit=10`);
    if (!res.ok) return { items: [], total: 0, pages: 0 };
    const data = await res.json();
    return data && Array.isArray(data.items) ? data : { items: [], total: 0, pages: 0 };
  }, []);

  const listarDiagnosticos = useCallback(async (q: string, page: number) => {
    const res = await fetch(`${API}/diagnosticos/lista?q=${encodeURIComponent(q)}&page=${page}&limit=10`);
    if (!res.ok) return { items: [], total: 0, pages: 0 };
    const data = await res.json();
    return data && Array.isArray(data.items) ? data : { items: [], total: 0, pages: 0 };
  }, []);

  // Al abrir en editar/ver: carga patologías del afiliado para el contexto.
  useEffect(() => {
    if (modo === 'crear' || !derivacion) return;
    cargarPatologias(Number(derivacion.afiliado_documento));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const crearOpcion = useCallback(async (
    endpoint: string,
    setter: React.Dispatch<React.SetStateAction<OpcionGuia[]>>,
    nombre: string,
  ): Promise<OpcionGuia | null> => {
    const res = await fetchAuth(`${API}/${endpoint}?nombre=${encodeURIComponent(nombre)}`, { method: 'POST' });
    if (!res.ok) return null;
    const op: OpcionGuia = await res.json();
    setter(prev =>
      prev.some(x => x.id === op.id)
        ? prev
        : [...prev, op].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    );
    return op;
  }, []);

  const eliminarOpcion = useCallback(async (
    endpoint: string,
    setter: React.Dispatch<React.SetStateAction<OpcionGuia[]>>,
    op: OpcionGuia,
  ): Promise<boolean> => {
    const res = await fetchAuth(`${API}/${endpoint}/${op.id}`, { method: 'DELETE' });
    if (!res.ok) return false;
    setter(prev => prev.filter(x => x.id !== op.id));
    const idStr = String(op.id);
    setForm(f => {
      const next = { ...f };
      (Object.keys(next) as (keyof FormData)[]).forEach((k) => {
        if (typeof k === 'string' && k.startsWith('id_') && (next as any)[k] === idStr) {
          (next as any)[k] = '';
        }
      });
      return next;
    });
    return true;
  }, []);

  async function buscarAfiliado() {
    const q = busquedaAfiliado.trim();
    if (q.length < 2) {
      setResultadosAfiliado([]);
      return;
    }
    try {
      const campo = /^\d+$/.test(q) ? 'dni' : 'nombre';
      const res = await fetch(`${API}/afiliados/buscar?q=${encodeURIComponent(q)}&campo=${campo}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setResultadosAfiliado(data);
      }
    } catch {}
  }

  async function cargarPatologias(documento: number) {
    try {
      const res = await fetch(`${API}/patologias/afiliado/${documento}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.error) return;
      if (Array.isArray(data)) {
        // Solo autocompletamos patología/diagnóstico al crear (afiliado nuevo).
        if (modo === 'crear' && data.length > 0) {
          const primera = data[0];
          setForm(f => ({
            ...f,
            tipo_patologia: primera.nombre || '',
            diagnostico: primera.diagnostico || '',
          }));
        }
      }
    } catch (e) {
      console.error('Error al cargar patologías:', e);
    }
  }

  // Elegir una patología del buscador: setea el nombre y autocompleta el
  // diagnóstico sugerido de esa patología (si tiene).
  function seleccionarPatologia(pat: Patologia) {
    setForm(f => ({ ...f, tipo_patologia: pat.nombre, diagnostico: pat.diagnostico || '' }));
  }

  function seleccionarDiagnostico(d: Diagnostico) {
    updateForm('diagnostico', d.descripcion);
  }

  async function seleccionarAfiliado(af: AfiliadoBusqueda) {
    setResultadosAfiliado([]);
    setBusquedaAfiliado('');

    setForm(f => ({
      ...f,
      afiliado_documento: af.documento,
      afiliado_nombre: af.nombre_completo || `${af.apellido || ''} ${af.nombre || ''}`.trim(),
      afiliado_credencial: '',
      afiliado_edad: null,
      afiliado_sexo: '',
      tipo_patologia: '',
      diagnostico: '',
    }));

    try {
      const res = await fetch(`${API}/afiliados/${af.documento}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.error) return;

      setForm(f => ({
        ...f,
        afiliado_documento: data.documento,
        afiliado_nombre: data.nombre_completo || `${data.apellido || ''} ${data.nombre || ''}`.trim(),
        afiliado_credencial: data.credencial || '',
        afiliado_nacimiento: data.nacimiento || null,
        afiliado_edad: calcularEdad(data.nacimiento, f.fecha),
        afiliado_sexo: data.genero || '',
      }));

      await cargarPatologias(af.documento);
    } catch (e) {
      console.error('Error al cargar detalle del afiliado:', e);
    }
  }

  function updateForm(field: keyof FormData, value: string) {
    setForm(f => {
      const next = { ...f, [field]: value };
      if (field === 'fecha' && f.afiliado_nacimiento) {
        next.afiliado_edad = calcularEdad(f.afiliado_nacimiento, value);
      }
      return next;
    });
  }

  async function guardar() {
    if (!form.afiliado_documento) {
      setFormError('Debe seleccionar un afiliado');
      return;
    }
    if (!form.fecha) {
      setFormError('Debe indicar la fecha de la derivación');
      return;
    }

    setSaving(true);
    setFormError('');

    const body = {
      // El mes se deriva de la fecha de la derivación (no del contexto en que
      // se abrió el formulario): así una derivación con fecha 02/01/2027 cae en
      // Enero 2027 al buscar mes a mes, aunque se cargue en Agosto 2026.
      mes: form.fecha ? form.fecha.slice(0, 7) : mes,
      nro_disposicion: form.nro_disposicion || null,
      fecha: form.fecha || null,
      afiliado_documento: String(form.afiliado_documento),
      afiliado_nombre: form.afiliado_nombre || null,
      afiliado_credencial: form.afiliado_credencial || null,
      afiliado_edad: form.afiliado_edad,
      afiliado_sexo: form.afiliado_sexo || null,
      expediente: form.expediente || null,
      tipo_patologia: form.tipo_patologia || null,
      diagnostico: form.diagnostico || null,
      fecha_turno: form.fecha_turno || null,
      diagnostico_tratamiento: form.diagnostico_tratamiento || null,
      destino: form.destino || null,
      id_destino: form.id_destino ? parseInt(form.id_destino) : null,
      id_cobertura: form.id_cobertura ? parseInt(form.id_cobertura) : null,
      id_centro_medico: form.id_centro_medico ? parseInt(form.id_centro_medico) : null,
      monto_prestacion: parseMontoInput(form.monto_prestacion),
      id_tipo_traslado: form.id_tipo_traslado ? parseInt(form.id_tipo_traslado) : null,
      cant_acompanantes: form.cant_acompanantes ? parseInt(form.cant_acompanantes) : null,
      monto_traslado: parseMontoInput(form.monto_traslado),
      id_cobertura_alojamiento: form.id_cobertura_alojamiento ? parseInt(form.id_cobertura_alojamiento) : null,
      id_tipo_alojamiento: form.id_tipo_alojamiento ? parseInt(form.id_tipo_alojamiento) : null,
      id_lugar_alojamiento: form.id_lugar_alojamiento ? parseInt(form.id_lugar_alojamiento) : null,
      cant_noches: form.cant_noches ? parseInt(form.cant_noches) : null,
      monto_alojamiento: parseMontoInput(form.monto_alojamiento),
    };

    try {
      let res: Response;
      if (modo === 'crear') {
        res = await fetchAuth(`${API}/derivaciones`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      } else {
        res = await fetchAuth(`${API}/derivaciones/${derivacion!.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.detail || 'Error al guardar');
        setSaving(false);
        return;
      }

      onGuardado?.();
      onVolver();
    } catch (e: any) {
      setFormError(e.message || 'Error de conexión');
      setSaving(false);
    }
  }

  const titulo =
    modo === 'crear' ? 'Nueva Derivación'
    : modo === 'editar' ? 'Editar Derivación'
    : 'Detalle de Derivación';

  /* ── Vista: Carátula de la derivación ── */
  if (verCaratula && derivacion?.id) {
    return (
      <CaratulaDerivacion
        derivacionId={derivacion.id}
        nombreAfiliado={form.afiliado_nombre || '-'}
        onVolver={() => setVerCaratula(false)}
      />
    );
  }

  return (
    <div className="dv-page">
      <div className="dv-panel">
        {/* ── Header unificado: barra + búsqueda + afiliado ── */}
        <div className="dv-header dv-header--expanded">
          {/* Barra superior: volver + búsqueda + modo, todo a la misma altura */}
          <div className="dv-header-top">
            <button className="dv-header-volver" onClick={onVolver}>
              ← Volver
            </button>

            {!soloVista && (
              <div className="dv-header-search-wrap dv-search-wrap">
                <div className="dv-search-row">
                  <input
                    className="dv-header-search-input"
                    value={busquedaAfiliado}
                    onChange={(e) => setBusquedaAfiliado(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') buscarAfiliado(); }}
                    placeholder="Buscar afiliado por nombre o DNI..."
                  />
                  <button className="dv-btn dv-btn--search" onClick={() => buscarAfiliado()} type="button">
                    Buscar
                  </button>
                </div>
                {resultadosAfiliado.length > 0 && (
                  <div className="dv-search-results">
                    {resultadosAfiliado.map((af) => (
                      <div
                        key={af.documento}
                        className="dv-search-item"
                        onClick={() => seleccionarAfiliado(af)}
                      >
                        <span className="dv-search-item-name">{af.nombre_completo}</span>
                        <span className="dv-search-item-dni">DNI {af.documento}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <span className="dv-header-modo">{titulo}</span>
          </div>

          {/* Nombre del afiliado + datos, todo en una misma línea */}
          {(form.afiliado_nombre || soloVista || form.afiliado_documento) && (
            <div className="dv-header-afiliado">
              <span className="dv-header-afiliado-name">{form.afiliado_nombre || '-'}</span>

              {form.afiliado_documento && (
                <div className="dv-header-datos">
                  <div className="dv-header-dato">
                    <span className="dv-header-dato-label">DNI</span>
                    <span className="dv-header-dato-value">{form.afiliado_documento ?? '-'}</span>
                  </div>
                  <div className="dv-header-dato">
                    <span className="dv-header-dato-label">Credencial</span>
                    <span className="dv-header-dato-value">{form.afiliado_credencial || '-'}</span>
                  </div>
                  <div className="dv-header-dato">
                    <span className="dv-header-dato-label">Edad</span>
                    <span className="dv-header-dato-value">{form.afiliado_edad ?? '-'}</span>
                  </div>
                  <div className="dv-header-dato">
                    <span className="dv-header-dato-label">Sexo</span>
                    <span className="dv-header-dato-value">{form.afiliado_sexo || '-'}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Body: una sola columna ── */}
        <div className="dv-form-body dv-form-body--single">
            {/* Botón Carátula de Derivación (solo si la derivación ya existe) */}
            {derivacion?.id && (
              <button
                className="lg-caratula-btn"
                onClick={() => setVerCaratula(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                Carátula de Derivación
              </button>
            )}

            {/* Datos de la Derivación */}
            <div className="dv-form-group">
              <p className="dv-form-section">Datos de la Derivación</p>

              <div className="dv-form-derivacion">
                <div className="dv-form-field dv-df-disp">
                  <label className="dv-form-label">N° Disposición</label>
                  <input className={`dv-form-input${roCls}`} value={form.nro_disposicion} onChange={(e) => updateForm('nro_disposicion', e.target.value)} readOnly={soloVista} />
                </div>
                <div className="dv-form-field dv-df-fecha">
                  <label className="dv-form-label">Fecha</label>
                  <input className={`dv-form-input${roCls}`} type="date" value={form.fecha} onChange={(e) => updateForm('fecha', e.target.value)} readOnly={soloVista} />
                </div>
                <div className="dv-form-field dv-df-monto">
                  <label className="dv-form-label">Monto Prestación</label>
                  <input className={`dv-form-input${roCls}`} type="text" inputMode="decimal" value={form.monto_prestacion} onChange={(e) => updateForm('monto_prestacion', formatMontoInput(e.target.value))} placeholder="0,00" readOnly={soloVista} />
                </div>
                <div className="dv-form-field dv-df-exp">
                  <label className="dv-form-label">Expediente</label>
                  <input className={`dv-form-input${roCls}`} value={form.expediente} onChange={(e) => updateForm('expediente', e.target.value)} readOnly={soloVista} />
                </div>
                <SelectConCarga
                  className="dv-df-dest"
                  label="Destino"
                  value={form.id_destino}
                  opciones={destinos}
                  onChange={(v) => updateForm('id_destino', v)}
                  onCrear={(n) => crearOpcion('destinos', setDestinos, n)}
                  onEliminar={(o) => eliminarOpcion('destinos', setDestinos, o)}
                  disabled={soloVista || soloLectura}
                />
                <SelectConCarga
                  className="dv-df-centro"
                  label="Centro médico"
                  value={form.id_centro_medico}
                  opciones={centrosMedicos}
                  onChange={(v) => updateForm('id_centro_medico', v)}
                  onCrear={(n) => crearOpcion('centros-medicos', setCentrosMedicos, n)}
                  onEliminar={(o) => eliminarOpcion('centros-medicos', setCentrosMedicos, o)}
                  disabled={soloVista || soloLectura}
                />
                <SelectConCarga
                  className="dv-df-cob"
                  label="Cobertura Prestación"
                  value={form.id_cobertura}
                  opciones={coberturas}
                  onChange={(v) => updateForm('id_cobertura', v)}
                  onCrear={(n) => crearOpcion('coberturas', setCoberturas, n)}
                  onEliminar={(o) => eliminarOpcion('coberturas', setCoberturas, o)}
                  disabled={soloVista || soloLectura}
                />
              </div>
            </div>

            {/* Patología cargada (de SQL Server) */}
            <div className="dv-form-group">
              <p className="dv-form-section">Patología cargada</p>

              <div className="dv-form-patologia">
                {/* Patología: búsqueda por texto contra el servidor (trae de a 15) */}
                {!soloVista ? (
                  <BuscadorAsync<Patologia>
                    className="dv-fp-select"
                    label="Patología"
                    value={form.tipo_patologia}
                    buscar={buscarPatologias}
                    listar={listarPatologias}
                    getKey={(p) => String(p.pat_id)}
                    getTexto={(p) => p.nombre}
                    getDetalle={(p) => p.cie_clave}
                    onSelect={seleccionarPatologia}
                    onLimpiar={() => setForm(f => ({ ...f, tipo_patologia: '' }))}
                    placeholder="Buscar patología por nombre..."
                  />
                ) : (
                  <div className="dv-form-field dv-fp-select">
                    <label className="dv-form-label">Patología</label>
                    <input className={`dv-form-input${roCls}`} value={form.tipo_patologia} readOnly placeholder="—" />
                  </div>
                )}
                {!soloVista ? (
                  <BuscadorAsync<Diagnostico>
                    className="dv-fp-diag"
                    label="Diagnóstico"
                    value={form.diagnostico}
                    buscar={buscarDiagnosticos}
                    listar={listarDiagnosticos}
                    getKey={(d) => d.codigo}
                    getTexto={(d) => d.descripcion}
                    getDetalle={(d) => d.codigo}
                    onSelect={seleccionarDiagnostico}
                    onLimpiar={() => updateForm('diagnostico', '')}
                    placeholder="Buscar diagnóstico por código o descripción..."
                  />
                ) : (
                  <div className="dv-form-field dv-fp-diag">
                    <label className="dv-form-label">Diagnóstico</label>
                    <input className={`dv-form-input${roCls}`} value={form.diagnostico} readOnly placeholder="—" />
                  </div>
                )}
                <div className="dv-form-field dv-fp-fecha">
                  <label className="dv-form-label">Fecha de turno</label>
                  <input
                    className={`dv-form-input${roCls}`}
                    type="date"
                    value={form.fecha_turno}
                    onChange={(e) => updateForm('fecha_turno', e.target.value)}
                    readOnly={soloVista}
                  />
                </div>
              </div>
            </div>

            {/* Traslado */}
            <div className="dv-form-group">
              <p className="dv-form-section">Traslado</p>

              <div className="dv-form-row-3">
                <div className="dv-form-field">
                  <label className="dv-form-label">Acompañantes</label>
                  <input className={`dv-form-input${roCls}`} type="number" value={form.cant_acompanantes} onChange={(e) => updateForm('cant_acompanantes', e.target.value)} readOnly={soloVista} />
                </div>
                <SelectConCarga
                  label="Tipo"
                  value={form.id_tipo_traslado}
                  opciones={tiposTraslado}
                  onChange={(v) => updateForm('id_tipo_traslado', v)}
                  onCrear={(n) => crearOpcion('tipos-traslado', setTiposTraslado, n)}
                  onEliminar={(o) => eliminarOpcion('tipos-traslado', setTiposTraslado, o)}
                  disabled={soloVista || soloLectura}
                />
                <div className="dv-form-field">
                  <label className="dv-form-label">Monto</label>
                  <input className={`dv-form-input${roCls}`} type="text" inputMode="decimal" value={form.monto_traslado} onChange={(e) => updateForm('monto_traslado', formatMontoInput(e.target.value))} placeholder="0,00" readOnly={soloVista} />
                </div>
              </div>
            </div>

            {/* Alojamiento */}
            <div className="dv-form-group">
              <p className="dv-form-section">Alojamiento</p>

              <div className="dv-form-row-3">
                <SelectConCarga
                  label="Cobertura"
                  value={form.id_cobertura_alojamiento}
                  opciones={coberturas}
                  onChange={(v) => updateForm('id_cobertura_alojamiento', v)}
                  onCrear={(n) => crearOpcion('coberturas', setCoberturas, n)}
                  onEliminar={(o) => eliminarOpcion('coberturas', setCoberturas, o)}
                  disabled={soloVista || soloLectura}
                />
                <SelectConCarga
                  label="Tipo"
                  value={form.id_tipo_alojamiento}
                  opciones={tiposAlojamiento}
                  onChange={(v) => updateForm('id_tipo_alojamiento', v)}
                  onCrear={(n) => crearOpcion('tipos-alojamiento', setTiposAlojamiento, n)}
                  onEliminar={(o) => eliminarOpcion('tipos-alojamiento', setTiposAlojamiento, o)}
                  disabled={soloVista || soloLectura}
                />
                <SelectConCarga
                  label="Lugar"
                  value={form.id_lugar_alojamiento}
                  opciones={lugaresAlojamiento}
                  onChange={(v) => updateForm('id_lugar_alojamiento', v)}
                  onCrear={(n) => crearOpcion('lugares-alojamiento', setLugaresAlojamiento, n)}
                  onEliminar={(o) => eliminarOpcion('lugares-alojamiento', setLugaresAlojamiento, o)}
                  disabled={soloVista || soloLectura}
                />
              </div>

              <div className="dv-form-row">
                <div className="dv-form-field">
                  <label className="dv-form-label">Cant. noches</label>
                  <input className={`dv-form-input${roCls}`} type="number" value={form.cant_noches} onChange={(e) => updateForm('cant_noches', e.target.value)} readOnly={soloVista} />
                </div>
                <div className="dv-form-field">
                  <label className="dv-form-label">Monto</label>
                  <input className={`dv-form-input${roCls}`} type="text" inputMode="decimal" value={form.monto_alojamiento} onChange={(e) => updateForm('monto_alojamiento', formatMontoInput(e.target.value))} placeholder="0,00" readOnly={soloVista} />
                </div>
              </div>
            </div>

          {/* ── Monto total (ancho completo) ── */}
          <div className="dv-form-total dv-form-footer">
              <span className="dv-form-total-label">Monto Total</span>
              <span className="dv-form-total-value">
                {formatMonto(
                  (parseMontoInput(form.monto_prestacion) ?? 0) +
                    (parseMontoInput(form.monto_traslado) ?? 0) +
                    (parseMontoInput(form.monto_alojamiento) ?? 0)
                )}
              </span>
            </div>

            {/* ── Footer (ancho completo) ── */}
            {!soloVista && (
              <>
                {formError && <p className="dv-form-error dv-form-footer">{formError}</p>}

                <div className="dv-form-actions dv-form-footer">
                  <button className="dv-btn dv-btn--outline" onClick={onVolver}>
                    Cancelar
                  </button>
                  <button className="dv-btn dv-btn--primary" onClick={guardar} disabled={saving}>
                    {saving ? 'Guardando...' : modo === 'crear' ? 'Crear Derivación' : 'Guardar Cambios'}
                  </button>
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  );
}
