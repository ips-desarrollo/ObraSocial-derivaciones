import { useState, useEffect, useCallback } from 'react';
import NavBar from './NavBar';
import logoSiglas from '../multimedia/logo-siglas.svg';
import { fetchAuth, verificarSesion, API } from '../auth';
import './globales.css';
import './derivaciones.css';

interface Derivacion {
  id: number;
  mes: string;
  nro_disposicion: string | null;
  fecha: string | null;
  afiliado_documento: number;
  afiliado_nombre: string | null;
  afiliado_credencial: string | null;
  afiliado_edad: number | null;
  afiliado_sexo: string | null;
  destino: string | null;
  cobertura_prestacion: string | null;
  centro_medico: string | null;
  monto_prestacion: number | null;
  expediente: string | null;
  cant_acompanantes: number | null;
  tipo_traslado: string | null;
  monto_traslado: number | null;
  cobertura_alojamiento: string | null;
  tipo_alojamiento: string | null;
  lugar_alojamiento: string | null;
  cant_noches_alojamiento: number | null;
  monto_alojamiento: number | null;
  tipo_patologia: string | null;
  diagnostico: string | null;
  tratamiento: string | null;
  fecha_turno: string | null;
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
  afiliado_sexo: string;
  destino: string;
  cobertura_prestacion: string;
  centro_medico: string;
  monto_prestacion: string;
  expediente: string;
  cant_acompanantes: string;
  tipo_traslado: string;
  monto_traslado: string;
  cobertura_alojamiento: string;
  tipo_alojamiento: string;
  lugar_alojamiento: string;
  cant_noches_alojamiento: string;
  monto_alojamiento: string;
  tipo_patologia: string;
  diagnostico: string;
  tratamiento: string;
  fecha_turno: string;
}

const emptyForm: FormData = {
  nro_disposicion: '',
  fecha: '',
  afiliado_documento: null,
  afiliado_nombre: '',
  afiliado_credencial: '',
  afiliado_edad: null,
  afiliado_sexo: '',
  destino: '',
  cobertura_prestacion: '',
  centro_medico: '',
  monto_prestacion: '',
  expediente: '',
  cant_acompanantes: '',
  tipo_traslado: '',
  monto_traslado: '',
  cobertura_alojamiento: '',
  tipo_alojamiento: '',
  lugar_alojamiento: '',
  cant_noches_alojamiento: '',
  monto_alojamiento: '',
  tipo_patologia: '',
  diagnostico: '',
  tratamiento: '',
  fecha_turno: '',
};

function mesActual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMes(mes: string): string {
  const [y, m] = mes.split('-');
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${meses[parseInt(m) - 1]} ${y}`;
}

function formatMonto(v: number | null): string {
  if (v == null) return '-';
  return `$${v.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}

function calcularEdad(nacimiento: string | null): number | null {
  if (!nacimiento) return null;
  const nac = new Date(nacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

function esSoloLectura(): boolean {
  try {
    const u = localStorage.getItem('usuario');
    if (!u) return false;
    const roles: string[] = JSON.parse(u).roles || [];
    return roles.length === 1 && roles[0] === 'lectura';
  } catch { return false; }
}

export default function Derivaciones() {
  const soloLectura = esSoloLectura();
  const [derivaciones, setDerivaciones] = useState<Derivacion[]>([]);
  const [mesSeleccionado, setMesSeleccionado] = useState(mesActual());
  const [loading, setLoading] = useState(true);

  const [vista, setVista] = useState<'lista' | 'crear' | 'editar'>('lista');
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Derivacion | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [modalError, setModalError] = useState('');

  const [busquedaAfiliado, setBusquedaAfiliado] = useState('');
  const [resultadosAfiliado, setResultadosAfiliado] = useState<AfiliadoBusqueda[]>([]);

  const [patologiasAfiliado, setPatologiasAfiliado] = useState<Patologia[]>([]);
  const [diagnosticosDisponibles, setDiagnosticosDisponibles] = useState<Diagnostico[]>([]);
  const [cieClave, setCieClave] = useState('');

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
      if (!res.ok) {
        console.error('Error al cargar patologías:', res.status);
        return;
      }
      const data = await res.json();
      if (data && data.error) {
        console.error('Error patologías:', data.error);
        return;
      }
      if (Array.isArray(data)) {
        setPatologiasAfiliado(data);
        if (data.length > 0) {
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
      if (!res.ok) {
        console.error('Error al cargar diagnósticos:', res.status);
        return;
      }
      const data = await res.json();
      if (data && data.error) {
        console.error('Error diagnósticos:', data.error);
        return;
      }
      if (Array.isArray(data)) setDiagnosticosDisponibles(data);
    } catch (e) {
      console.error('Error al cargar diagnósticos:', e);
    }
  }

  function seleccionarPatologia(nombre: string) {
    const pat = patologiasAfiliado.find(p => p.nombre === nombre);
    const diagDesc = pat?.diagnostico || '';
    setForm(f => ({
      ...f,
      tipo_patologia: nombre,
      diagnostico: diagDesc,
    }));
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
      if (!res.ok) {
        console.error('Error al obtener detalle del afiliado:', res.status);
        return;
      }
      const data = await res.json();
      if (data.error) {
        console.error('Error del backend:', data.error);
        return;
      }

      setForm(f => ({
        ...f,
        afiliado_documento: data.documento,
        afiliado_nombre: data.nombre_completo || `${data.apellido || ''} ${data.nombre || ''}`.trim(),
        afiliado_credencial: data.credencial || '',
        afiliado_edad: calcularEdad(data.nacimiento),
        afiliado_sexo: data.genero || '',
      }));

      await cargarPatologias(af.documento);
    } catch (e) {
      console.error('Error al cargar detalle del afiliado:', e);
    }
  }

  function irACrear() {
    setForm({ ...emptyForm });
    setEditId(null);
    setFormError('');
    setBusquedaAfiliado('');
    setResultadosAfiliado([]);
    setPatologiasAfiliado([]);
    setDiagnosticosDisponibles([]);
    setCieClave('');
    setVista('crear');
  }

  async function irAEditar(d: Derivacion) {
    setForm({
      nro_disposicion: d.nro_disposicion || '',
      fecha: d.fecha || '',
      afiliado_documento: d.afiliado_documento,
      afiliado_nombre: d.afiliado_nombre || '',
      afiliado_credencial: d.afiliado_credencial || '',
      afiliado_edad: d.afiliado_edad,
      afiliado_sexo: d.afiliado_sexo || '',
      destino: d.destino || '',
      cobertura_prestacion: d.cobertura_prestacion || '',
      centro_medico: d.centro_medico || '',
      monto_prestacion: d.monto_prestacion != null ? String(d.monto_prestacion) : '',
      expediente: d.expediente || '',
      cant_acompanantes: d.cant_acompanantes != null ? String(d.cant_acompanantes) : '',
      tipo_traslado: d.tipo_traslado || '',
      monto_traslado: d.monto_traslado != null ? String(d.monto_traslado) : '',
      cobertura_alojamiento: d.cobertura_alojamiento || '',
      tipo_alojamiento: d.tipo_alojamiento || '',
      lugar_alojamiento: d.lugar_alojamiento || '',
      cant_noches_alojamiento: d.cant_noches_alojamiento != null ? String(d.cant_noches_alojamiento) : '',
      monto_alojamiento: d.monto_alojamiento != null ? String(d.monto_alojamiento) : '',
      tipo_patologia: d.tipo_patologia || '',
      diagnostico: d.diagnostico || '',
      tratamiento: d.tratamiento || '',
      fecha_turno: d.fecha_turno || '',
    });
    setEditId(d.id);
    setFormError('');
    setBusquedaAfiliado('');
    setResultadosAfiliado([]);
    setPatologiasAfiliado([]);
    setDiagnosticosDisponibles([]);
    setCieClave('');
    setVista('editar');
    await cargarPatologias(d.afiliado_documento);
  }

  function volverALista() {
    setVista('lista');
    setFormError('');
    setSaving(false);
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

  function updateForm(field: keyof FormData, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function guardar() {
    if (!form.afiliado_documento) {
      setFormError('Debe seleccionar un afiliado');
      return;
    }

    setSaving(true);
    setFormError('');

    const body = {
      mes: mesSeleccionado,
      nro_disposicion: form.nro_disposicion || null,
      fecha: form.fecha || null,
      afiliado_documento: form.afiliado_documento,
      afiliado_nombre: form.afiliado_nombre || null,
      afiliado_credencial: form.afiliado_credencial || null,
      afiliado_edad: form.afiliado_edad,
      afiliado_sexo: form.afiliado_sexo || null,
      destino: form.destino || null,
      cobertura_prestacion: form.cobertura_prestacion || null,
      centro_medico: form.centro_medico || null,
      monto_prestacion: form.monto_prestacion ? parseFloat(form.monto_prestacion) : null,
      expediente: form.expediente || null,
      cant_acompanantes: form.cant_acompanantes ? parseInt(form.cant_acompanantes) : null,
      tipo_traslado: form.tipo_traslado || null,
      monto_traslado: form.monto_traslado ? parseFloat(form.monto_traslado) : null,
      cobertura_alojamiento: form.cobertura_alojamiento || null,
      tipo_alojamiento: form.tipo_alojamiento || null,
      lugar_alojamiento: form.lugar_alojamiento || null,
      cant_noches_alojamiento: form.cant_noches_alojamiento ? parseInt(form.cant_noches_alojamiento) : null,
      monto_alojamiento: form.monto_alojamiento ? parseFloat(form.monto_alojamiento) : null,
      tipo_patologia: form.tipo_patologia || null,
      diagnostico: form.diagnostico || null,
      tratamiento: form.tratamiento || null,
      fecha_turno: form.fecha_turno || null,
    };

    try {
      let res: Response;
      if (vista === 'crear') {
        res = await fetchAuth(`${API}/derivaciones`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      } else {
        res = await fetchAuth(`${API}/derivaciones/${editId}`, {
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

      volverALista();
      cargarDerivaciones();
    } catch (e: any) {
      setFormError(e.message || 'Error de conexión');
      setSaving(false);
    }
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
        <div className="dv-page">
          <div className="dv-toolbar">
            <button className="dv-btn dv-btn--outline" onClick={volverALista}>
              ← Volver al listado
            </button>
            <div className="dv-toolbar-spacer" />
            <h1 className="dv-toolbar-title">
              {vista === 'crear' ? 'Nueva Derivación' : 'Editar Derivación'}
            </h1>
            <div className="dv-toolbar-spacer" />
            <span className="dv-toolbar-mes">{formatMes(mesSeleccionado)}</span>
          </div>

          <div className="dv-panel">
            <div className="dv-header dv-header--search">
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
            </div>

            <div className="dv-form-body">
              {/* ── Columna izquierda ── */}
              <div className="dv-form-col">
                {/* Afiliado */}
                <div className="dv-form-group">
                  <p className="dv-form-section">Datos del Afiliado</p>

                  <div className="dv-form-row-3">
                    <div className="dv-form-field">
                      <label className="dv-form-label">DNI</label>
                      <input className="dv-form-input dv-form-input--ro" value={form.afiliado_documento ?? ''} readOnly />
                    </div>
                    <div className="dv-form-field">
                      <label className="dv-form-label">Credencial</label>
                      <input className="dv-form-input dv-form-input--ro" value={form.afiliado_credencial} readOnly />
                    </div>
                    <div className="dv-form-field dv-form-field--narrow">
                      <label className="dv-form-label">Edad</label>
                      <input className="dv-form-input dv-form-input--ro" value={form.afiliado_edad ?? ''} readOnly />
                    </div>
                  </div>

                  <div className="dv-form-field dv-form-field--narrow">
                    <label className="dv-form-label">Sexo</label>
                    <input className="dv-form-input dv-form-input--ro" value={form.afiliado_sexo} readOnly />
                  </div>
                </div>

                {/* Patología */}
                <div className="dv-form-group">
                  <p className="dv-form-section">Patología y Tratamiento</p>

                  <div className="dv-form-row">
                    <div className="dv-form-field">
                      <label className="dv-form-label">Tipo de patología</label>
                      {patologiasAfiliado.length > 0 ? (
                        <select
                          className="dv-form-input"
                          value={form.tipo_patologia}
                          onChange={(e) => seleccionarPatologia(e.target.value)}
                        >
                          <option value="">— Seleccionar —</option>
                          {patologiasAfiliado.map((p) => (
                            <option key={p.pat_id} value={p.nombre}>{p.nombre}</option>
                          ))}
                        </select>
                      ) : (
                        <input className="dv-form-input" value={form.tipo_patologia} onChange={(e) => updateForm('tipo_patologia', e.target.value)} placeholder="Sin patologías registradas" />
                      )}
                    </div>
                    <div className="dv-form-field">
                      <label className="dv-form-label">Fecha de turno</label>
                      <input className="dv-form-input" type="date" value={form.fecha_turno} onChange={(e) => updateForm('fecha_turno', e.target.value)} />
                    </div>
                  </div>

                  <div className="dv-form-field">
                    <label className="dv-form-label">Diagnóstico</label>
                    <textarea
                      className="dv-form-textarea"
                      value={form.diagnostico}
                      onChange={(e) => updateForm('diagnostico', e.target.value)}
                      placeholder={patologiasAfiliado.length > 0 ? "Diagnóstico de la patología" : "Sin patología registrada"}
                    />
                    {diagnosticosDisponibles.length > 1 && (
                      <select
                        className="dv-form-input"
                        style={{ marginTop: '4px' }}
                        onChange={(e) => {
                          if (e.target.value) updateForm('diagnostico', e.target.value);
                        }}
                      >
                        <option value="">— Opciones adicionales de diagnóstico —</option>
                        {diagnosticosDisponibles.map((d, i) => (
                          <option key={i} value={d.descripcion}>{d.descripcion}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="dv-form-field">
                    <label className="dv-form-label">Tratamiento</label>
                    <textarea className="dv-form-textarea" value={form.tratamiento} onChange={(e) => updateForm('tratamiento', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* ── Columna derecha ── */}
              <div className="dv-form-col">
                {/* Derivación */}
                <div className="dv-form-group">
                  <p className="dv-form-section">Datos de la Derivación</p>

                  <div className="dv-form-row">
                    <div className="dv-form-field">
                      <label className="dv-form-label">N° Disposición</label>
                      <input className="dv-form-input" value={form.nro_disposicion} onChange={(e) => updateForm('nro_disposicion', e.target.value)} />
                    </div>
                    <div className="dv-form-field">
                      <label className="dv-form-label">Fecha</label>
                      <input className="dv-form-input" type="date" value={form.fecha} onChange={(e) => updateForm('fecha', e.target.value)} />
                    </div>
                  </div>

                  <div className="dv-form-row">
                    <div className="dv-form-field">
                      <label className="dv-form-label">Expediente</label>
                      <input className="dv-form-input" value={form.expediente} onChange={(e) => updateForm('expediente', e.target.value)} />
                    </div>
                    <div className="dv-form-field">
                      <label className="dv-form-label">Destino</label>
                      <input className="dv-form-input" value={form.destino} onChange={(e) => updateForm('destino', e.target.value)} />
                    </div>
                  </div>

                  <div className="dv-form-row">
                    <div className="dv-form-field">
                      <label className="dv-form-label">Centro médico</label>
                      <input className="dv-form-input" value={form.centro_medico} onChange={(e) => updateForm('centro_medico', e.target.value)} />
                    </div>
                    <div className="dv-form-field">
                      <label className="dv-form-label">Cobertura Prestación</label>
                      <input className="dv-form-input" value={form.cobertura_prestacion} onChange={(e) => updateForm('cobertura_prestacion', e.target.value)} />
                    </div>
                  </div>

                  <div className="dv-form-field dv-form-field--narrow">
                    <label className="dv-form-label">Monto Prestación</label>
                    <input className="dv-form-input" type="number" step="0.01" value={form.monto_prestacion} onChange={(e) => updateForm('monto_prestacion', e.target.value)} placeholder="0.00" />
                  </div>
                </div>

                {/* Traslado */}
                <div className="dv-form-group">
                  <p className="dv-form-section">Traslado</p>

                  <div className="dv-form-row-3">
                    <div className="dv-form-field">
                      <label className="dv-form-label">Acompañantes</label>
                      <input className="dv-form-input" type="number" value={form.cant_acompanantes} onChange={(e) => updateForm('cant_acompanantes', e.target.value)} />
                    </div>
                    <div className="dv-form-field">
                      <label className="dv-form-label">Tipo</label>
                      <input className="dv-form-input" value={form.tipo_traslado} onChange={(e) => updateForm('tipo_traslado', e.target.value)} />
                    </div>
                    <div className="dv-form-field">
                      <label className="dv-form-label">Monto</label>
                      <input className="dv-form-input" type="number" step="0.01" value={form.monto_traslado} onChange={(e) => updateForm('monto_traslado', e.target.value)} placeholder="0.00" />
                    </div>
                  </div>
                </div>

                {/* Alojamiento */}
                <div className="dv-form-group">
                  <p className="dv-form-section">Alojamiento</p>

                  <div className="dv-form-row-3">
                    <div className="dv-form-field">
                      <label className="dv-form-label">Cobertura</label>
                      <input className="dv-form-input" value={form.cobertura_alojamiento} onChange={(e) => updateForm('cobertura_alojamiento', e.target.value)} />
                    </div>
                    <div className="dv-form-field">
                      <label className="dv-form-label">Tipo</label>
                      <input className="dv-form-input" value={form.tipo_alojamiento} onChange={(e) => updateForm('tipo_alojamiento', e.target.value)} />
                    </div>
                    <div className="dv-form-field">
                      <label className="dv-form-label">Lugar</label>
                      <input className="dv-form-input" value={form.lugar_alojamiento} onChange={(e) => updateForm('lugar_alojamiento', e.target.value)} />
                    </div>
                  </div>

                  <div className="dv-form-row">
                    <div className="dv-form-field">
                      <label className="dv-form-label">Cant. noches</label>
                      <input className="dv-form-input" type="number" value={form.cant_noches_alojamiento} onChange={(e) => updateForm('cant_noches_alojamiento', e.target.value)} />
                    </div>
                    <div className="dv-form-field">
                      <label className="dv-form-label">Monto</label>
                      <input className="dv-form-input" type="number" step="0.01" value={form.monto_alojamiento} onChange={(e) => updateForm('monto_alojamiento', e.target.value)} placeholder="0.00" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Footer (ancho completo) ── */}
              {formError && <p className="dv-form-error dv-form-footer">{formError}</p>}

              <div className="dv-form-actions dv-form-footer">
                <button className="dv-btn dv-btn--outline" onClick={volverALista}>
                  Cancelar
                </button>
                <button className="dv-btn dv-btn--primary" onClick={guardar} disabled={saving}>
                  {saving ? 'Guardando...' : vista === 'crear' ? 'Crear Derivación' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
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
                    <th>Fecha</th>
                    <th>Afiliado</th>
                    <th>DNI</th>
                    <th>Credencial</th>
                    <th>Edad</th>
                    <th>Sexo</th>
                    <th>Destino</th>
                    <th>Cob. Prestación</th>
                    <th>Centro Médico</th>
                    <th>Monto Prest.</th>
                    <th>Expediente</th>
                    <th>Acomp.</th>
                    <th>Tipo Traslado</th>
                    <th>Monto Trasl.</th>
                    <th>Cob. Aloj.</th>
                    <th>Tipo Aloj.</th>
                    <th>Lugar Aloj.</th>
                    <th>Noches</th>
                    <th>Monto Aloj.</th>
                    <th>Tipo Patología</th>
                    <th>Diagnóstico</th>
                    <th>Tratamiento</th>
                    <th>Fecha Turno</th>
                    {!soloLectura && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {derivaciones.map((d) => (
                    <tr key={d.id}>
                      <td>{d.nro_disposicion || '-'}</td>
                      <td>{d.fecha || '-'}</td>
                      <td className="dv-name-cell">{d.afiliado_nombre || '-'}</td>
                      <td>{d.afiliado_documento}</td>
                      <td>{d.afiliado_credencial || '-'}</td>
                      <td>{d.afiliado_edad ?? '-'}</td>
                      <td>{d.afiliado_sexo || '-'}</td>
                      <td>{d.destino || '-'}</td>
                      <td>{d.cobertura_prestacion || '-'}</td>
                      <td>{d.centro_medico || '-'}</td>
                      <td className="dv-monto-cell">{formatMonto(d.monto_prestacion)}</td>
                      <td>{d.expediente || '-'}</td>
                      <td>{d.cant_acompanantes ?? '-'}</td>
                      <td>{d.tipo_traslado || '-'}</td>
                      <td className="dv-monto-cell">{formatMonto(d.monto_traslado)}</td>
                      <td>{d.cobertura_alojamiento || '-'}</td>
                      <td>{d.tipo_alojamiento || '-'}</td>
                      <td>{d.lugar_alojamiento || '-'}</td>
                      <td>{d.cant_noches_alojamiento ?? '-'}</td>
                      <td className="dv-monto-cell">{formatMonto(d.monto_alojamiento)}</td>
                      <td>{d.tipo_patologia || '-'}</td>
                      <td>{d.diagnostico || '-'}</td>
                      <td>{d.tratamiento || '-'}</td>
                      <td>{d.fecha_turno || '-'}</td>
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
