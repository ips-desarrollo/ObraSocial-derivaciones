import { useState, useEffect, useCallback } from 'react';
import SelectConCarga from './SelectConCarga';
import { fetchAuth, API } from '../auth';
import './derivaciones.css';

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
  tratamiento: string | null;
  fecha_turno: string | null;
  id_tipo_patologia: number | null;
  id_tratamiento: number | null;
  id_diagnostico: number | null;
  tipo_patologia_nombre: string | null;
  tratamiento_nombre: string | null;
  diagnostico_nombre: string | null;
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
  tratamiento: string;
  fecha_turno: string;
  id_tipo_patologia: string;
  id_tratamiento: string;
  id_diagnostico: string;
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
  tratamiento: '',
  fecha_turno: '',
  id_tipo_patologia: '',
  id_tratamiento: '',
  id_diagnostico: '',
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
    tratamiento: d.tratamiento || '',
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
    id_tipo_patologia: d.id_tipo_patologia != null ? String(d.id_tipo_patologia) : '',
    id_tratamiento: d.id_tratamiento != null ? String(d.id_tratamiento) : '',
    id_diagnostico: d.id_diagnostico != null ? String(d.id_diagnostico) : '',
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

  const [busquedaAfiliado, setBusquedaAfiliado] = useState('');
  const [resultadosAfiliado, setResultadosAfiliado] = useState<AfiliadoBusqueda[]>([]);

  const [patologiasAfiliado, setPatologiasAfiliado] = useState<Patologia[]>([]);
  const [diagnosticosDisponibles, setDiagnosticosDisponibles] = useState<Diagnostico[]>([]);
  const [cieClave, setCieClave] = useState('');

  const [coberturas, setCoberturas] = useState<OpcionGuia[]>([]);
  const [tiposTraslado, setTiposTraslado] = useState<OpcionGuia[]>([]);
  const [tiposAlojamiento, setTiposAlojamiento] = useState<OpcionGuia[]>([]);
  const [tiposPatologia, setTiposPatologia] = useState<OpcionGuia[]>([]);
  const [tratamientos, setTratamientos] = useState<OpcionGuia[]>([]);
  const [centrosMedicos, setCentrosMedicos] = useState<OpcionGuia[]>([]);
  const [destinos, setDestinos] = useState<OpcionGuia[]>([]);
  const [lugaresAlojamiento, setLugaresAlojamiento] = useState<OpcionGuia[]>([]);
  const [diagnosticos, setDiagnosticos] = useState<OpcionGuia[]>([]);

  // Carga de catálogos (guías) una sola vez.
  useEffect(() => {
    async function cargarGuias() {
      try {
        const [resCob, resTrasl, resAloj, resTipoPat, resTrat, resCentro, resDestino, resLugar] = await Promise.all([
          fetchAuth(`${API}/coberturas`),
          fetchAuth(`${API}/tipos-traslado`),
          fetchAuth(`${API}/tipos-alojamiento`),
          fetchAuth(`${API}/tipos-patologia`),
          fetchAuth(`${API}/tratamientos`),
          fetchAuth(`${API}/centros-medicos`),
          fetchAuth(`${API}/destinos`),
          fetchAuth(`${API}/lugares-alojamiento`),
        ]);
        if (resCob.ok) setCoberturas(await resCob.json());
        if (resTrasl.ok) setTiposTraslado(await resTrasl.json());
        if (resAloj.ok) setTiposAlojamiento(await resAloj.json());
        if (resTipoPat.ok) setTiposPatologia(await resTipoPat.json());
        if (resTrat.ok) setTratamientos(await resTrat.json());
        if (resCentro.ok) setCentrosMedicos(await resCentro.json());
        if (resDestino.ok) setDestinos(await resDestino.json());
        if (resLugar.ok) setLugaresAlojamiento(await resLugar.json());
      } catch {}
    }
    cargarGuias();
  }, []);

  // Al abrir en editar/ver: carga diagnósticos del tipo y patologías del afiliado
  // para que se vean los valores seleccionados.
  useEffect(() => {
    if (modo === 'crear' || !derivacion) return;
    if (derivacion.id_tipo_patologia != null) {
      cargarDiagnosticosPatologia(String(derivacion.id_tipo_patologia));
    }
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

  const cargarDiagnosticosPatologia = useCallback(async (idTipoPat: string) => {
    if (!idTipoPat) {
      setDiagnosticos([]);
      return;
    }
    try {
      const res = await fetchAuth(`${API}/diagnosticos-patologia?id_tipo_patologia=${idTipoPat}`);
      setDiagnosticos(res.ok ? await res.json() : []);
    } catch {
      setDiagnosticos([]);
    }
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
        setPatologiasAfiliado(data);
        // Solo autocompletamos patología/diagnóstico al crear (afiliado nuevo).
        if (modo === 'crear' && data.length > 0) {
          const primera = data[0];
          setForm(f => ({
            ...f,
            tipo_patologia: primera.nombre || '',
            diagnostico: primera.diagnostico || '',
          }));
          if (primera.cie_clave) {
            setCieClave(primera.cie_clave);
            await cargarDiagnosticos(primera.cie_clave);
          }
        }
      }
    } catch (e) {
      console.error('Error al cargar patologías:', e);
    }
  }

  async function cargarDiagnosticos(clave: string) {
    if (!clave) {
      setDiagnosticosDisponibles([]);
      return;
    }
    try {
      const res = await fetch(`${API}/diagnosticos/${encodeURIComponent(clave)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.error) return;
      if (Array.isArray(data)) setDiagnosticosDisponibles(data);
    } catch (e) {
      console.error('Error al cargar diagnósticos:', e);
    }
  }

  function seleccionarPatologia(nombre: string) {
    const pat = patologiasAfiliado.find(p => p.nombre === nombre);
    const diagDesc = pat?.diagnostico || '';
    setForm(f => ({ ...f, tipo_patologia: nombre, diagnostico: diagDesc }));
    setDiagnosticosDisponibles([]);
    if (pat && pat.cie_clave) {
      setCieClave(pat.cie_clave);
      cargarDiagnosticos(pat.cie_clave);
    } else {
      setCieClave('');
    }
  }

  async function seleccionarAfiliado(af: AfiliadoBusqueda) {
    setResultadosAfiliado([]);
    setBusquedaAfiliado('');
    setPatologiasAfiliado([]);
    setDiagnosticosDisponibles([]);
    setCieClave('');

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

  function cambiarTipoPatologia(value: string) {
    setForm(f => ({ ...f, id_tipo_patologia: value, id_diagnostico: '' }));
    cargarDiagnosticosPatologia(value);
  }

  async function crearDiagnostico(nombre: string): Promise<OpcionGuia | null> {
    const idTipoPat = form.id_tipo_patologia;
    if (!idTipoPat) return null;
    const res = await fetchAuth(
      `${API}/diagnosticos-patologia?id_tipo_patologia=${idTipoPat}&nombre=${encodeURIComponent(nombre)}`,
      { method: 'POST' },
    );
    if (!res.ok) return null;
    const op: OpcionGuia = await res.json();
    setDiagnosticos(prev =>
      prev.some(x => x.id === op.id)
        ? prev
        : [...prev, op].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    );
    return op;
  }

  async function eliminarDiagnostico(op: OpcionGuia): Promise<boolean> {
    const res = await fetchAuth(`${API}/diagnosticos-patologia/${op.id}`, { method: 'DELETE' });
    if (!res.ok) return false;
    setDiagnosticos(prev => prev.filter(x => x.id !== op.id));
    setForm(f => (f.id_diagnostico === String(op.id) ? { ...f, id_diagnostico: '' } : f));
    return true;
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
      mes,
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
      tratamiento: form.tratamiento || null,
      fecha_turno: form.fecha_turno || null,
      id_tipo_patologia: form.id_tipo_patologia ? parseInt(form.id_tipo_patologia) : null,
      id_tratamiento: form.id_tratamiento ? parseInt(form.id_tratamiento) : null,
      id_diagnostico: form.id_diagnostico ? parseInt(form.id_diagnostico) : null,
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

  return (
    <div className="dv-page">
      <div className="dv-toolbar">
        <button className="dv-btn dv-btn--outline" onClick={onVolver}>
          ← Volver
        </button>
        <div className="dv-toolbar-spacer" />
        <h1 className="dv-toolbar-title">{titulo}</h1>
        <div className="dv-toolbar-spacer" />
        <span className="dv-toolbar-mes">{formatMes(mes)}</span>
      </div>

      <div className="dv-panel">
        <div className="dv-header dv-header--search">
          {soloVista ? (
            <span className="dv-header-afiliado-name">
              {form.afiliado_nombre || '-'}
              {form.afiliado_documento ? ` — DNI ${form.afiliado_documento}` : ''}
            </span>
          ) : (
            <>
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
              {form.afiliado_nombre && (
                <span className="dv-header-afiliado-name">{form.afiliado_nombre}</span>
              )}
            </>
          )}
        </div>

        <div className="dv-form-body">
          {/* ── Columna izquierda ── */}
          <div className="dv-form-col">
            {/* Afiliado */}
            <div className="dv-form-group">
              <p className="dv-form-section">Datos del Afiliado</p>

              <div className="dv-form-row-afiliado">
                <div className="dv-form-field">
                  <label className="dv-form-label">DNI</label>
                  <input className="dv-form-input dv-form-input--ro" value={form.afiliado_documento ?? ''} readOnly />
                </div>
                <div className="dv-form-field">
                  <label className="dv-form-label">Credencial</label>
                  <input className="dv-form-input dv-form-input--ro" value={form.afiliado_credencial} readOnly />
                </div>
                <div className="dv-form-field">
                  <label className="dv-form-label">Edad</label>
                  <input className="dv-form-input dv-form-input--ro" value={form.afiliado_edad ?? ''} readOnly />
                </div>
                <div className="dv-form-field">
                  <label className="dv-form-label">Sexo</label>
                  <input className="dv-form-input dv-form-input--ro" value={form.afiliado_sexo} readOnly />
                </div>
              </div>
            </div>

            {/* Patología cargada (read-only) */}
            <div className="dv-form-group">
              <p className="dv-form-section">Patología cargada</p>

              <div className="dv-form-field">
                <label className="dv-form-label">Patología</label>
                <input className="dv-form-input dv-form-input--ro" value={form.tipo_patologia} readOnly />
              </div>

              <div className="dv-form-field">
                <label className="dv-form-label">Diagnóstico</label>
                <textarea
                  className="dv-form-textarea dv-form-input--ro"
                  value={form.diagnostico}
                  readOnly
                />
              </div>
            </div>

            {/* Tratamiento */}
            <div className="dv-form-group dv-form-group--grow">
              <p className="dv-form-section">Tratamiento</p>

              <div className="dv-form-row">
                <SelectConCarga
                  label="Tipo de patología"
                  value={form.id_tipo_patologia}
                  opciones={tiposPatologia}
                  onChange={(v) => cambiarTipoPatologia(v)}
                  onCrear={(n) => crearOpcion('tipos-patologia', setTiposPatologia, n)}
                  onEliminar={(o) => eliminarOpcion('tipos-patologia', setTiposPatologia, o)}
                  disabled={soloVista || soloLectura}
                />
                <div className="dv-form-field">
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

              <SelectConCarga
                label="Diagnóstico"
                value={form.id_diagnostico}
                opciones={diagnosticos}
                onChange={(v) => updateForm('id_diagnostico', v)}
                onCrear={crearDiagnostico}
                onEliminar={eliminarDiagnostico}
                disabled={soloVista || soloLectura || !form.id_tipo_patologia}
              />
              {!soloVista && !form.id_tipo_patologia && (
                <span className="dv-form-hint">Elegí primero un tipo de patología para cargar el diagnóstico.</span>
              )}

              <SelectConCarga
                label="Tratamiento"
                value={form.id_tratamiento}
                opciones={tratamientos}
                onChange={(v) => updateForm('id_tratamiento', v)}
                onCrear={(n) => crearOpcion('tratamientos', setTratamientos, n)}
                onEliminar={(o) => eliminarOpcion('tratamientos', setTratamientos, o)}
                disabled={soloVista || soloLectura}
              />
            </div>
          </div>

          {/* ── Columna derecha ── */}
          <div className="dv-form-col">
            {/* Derivación */}
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
            <div className="dv-form-group dv-form-group--grow">
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
