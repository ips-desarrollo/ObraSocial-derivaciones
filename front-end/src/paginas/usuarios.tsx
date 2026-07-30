import { useState, useEffect, useCallback } from 'react';
import NavBar from './NavBar';
import logoSiglas from '../multimedia/logo-siglas.svg';
import { fetchAuth, verificarSesion, API } from '../auth';
import './globales.css';
import './usuarios.css';

interface Usuario {
  id: number;
  nombre_completo: string;
  email: string;
  activo: boolean;
  creado_en: string | null;
  roles: string[];
}

interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
}

interface FormData {
  nombre_completo: string;
  email: string;
  password: string;
  activo: boolean;
  roles: string[];
}

const emptyForm: FormData = {
  nombre_completo: '',
  email: '',
  password: '',
  activo: true,
  roles: ['operador'],
};


function roleBadgeClass(rol: string) {
  if (rol === 'admin') return 'us-badge us-badge--admin';
  if (rol === 'operador') return 'us-badge us-badge--operador';
  if (rol === 'lectura') return 'us-badge us-badge--lectura';
  return 'us-badge us-badge--default';
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<'crear' | 'editar' | 'eliminar' | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Usuario | null>(null);
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);

  const cargarUsuarios = useCallback(async () => {
    if (!verificarSesion()) return;
    try {
      const res = await fetchAuth(`${API}/usuarios`);
      if (!res.ok) throw new Error('Error al cargar usuarios');
      setUsuarios(await res.json());
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarRoles = useCallback(async () => {
    if (!verificarSesion()) return;
    try {
      const res = await fetchAuth(`${API}/roles`);
      if (!res.ok) return;
      setRoles(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    cargarUsuarios();
    cargarRoles();
  }, [cargarUsuarios, cargarRoles]);

  const filtrados = usuarios.filter((u) => {
    const q = busqueda.toLowerCase();
    return (
      u.nombre_completo.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.roles.some((r) => r.toLowerCase().includes(q))
    );
  });

  function abrirCrear() {
    setForm({ ...emptyForm });
    setEditId(null);
    setModalError('');
    setModal('crear');
  }

  const [original, setOriginal] = useState<Usuario | null>(null);

  function abrirEditar(u: Usuario) {
    setOriginal(u);
    setForm({
      nombre_completo: u.nombre_completo,
      email: u.email,
      password: '',
      activo: u.activo,
      roles: [...u.roles],
    });
    setEditId(u.id);
    setModalError('');
    setModal('editar');
  }

  function abrirEliminar(u: Usuario) {
    setDeleteTarget(u);
    setModalError('');
    setModal('eliminar');
  }

  function cerrarModal() {
    setModal(null);
    setModalError('');
    setSaving(false);
  }

  function toggleRol(rol: string) {
    setForm((f) => ({
      ...f,
      roles: [rol],
    }));
  }

  async function guardar() {
    if (!form.nombre_completo.trim() || !form.email.trim()) {
      setModalError('Nombre y email son obligatorios');
      return;
    }
    if (modal === 'crear' && !form.password.trim()) {
      setModalError('La contraseña es obligatoria para nuevos usuarios');
      return;
    }

    setSaving(true);
    setModalError('');

    try {
      let res: Response;
      if (modal === 'crear') {
        const body: any = {
          nombre_completo: form.nombre_completo.trim(),
          email: form.email.trim(),
          password: form.password,
          activo: form.activo,
          roles: form.roles,
        };
        res = await fetchAuth(`${API}/crear-usuario`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      } else {
        const body: any = {};
        if (original && form.nombre_completo.trim() !== original.nombre_completo) {
          body.nombre_completo = form.nombre_completo.trim();
        }
        if (original && form.email.trim() !== original.email) {
          body.email = form.email.trim();
        }
        if (form.password.trim()) {
          body.password = form.password;
        }
        if (original && form.activo !== original.activo) {
          body.activo = form.activo;
        }
        const rolesOrig = [...(original?.roles || [])].sort();
        const rolesNew = [...form.roles].sort();
        if (JSON.stringify(rolesOrig) !== JSON.stringify(rolesNew)) {
          body.roles = form.roles;
        }

        if (Object.keys(body).length === 0) {
          cerrarModal();
          return;
        }

        res = await fetchAuth(`${API}/usuarios/${editId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setModalError(data.detail || 'Error al guardar');
        setSaving(false);
        return;
      }

      cerrarModal();
      cargarUsuarios();
    } catch (e: any) {
      setModalError(e.message || 'Error de conexión');
      setSaving(false);
    }
  }

  async function confirmarEliminar() {
    if (!deleteTarget) return;
    setSaving(true);
    setModalError('');
    try {
      const res = await fetchAuth(`${API}/usuarios/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.detail || 'Error al eliminar');
        setSaving(false);
        return;
      }
      cerrarModal();
      cargarUsuarios();
    } catch (e: any) {
      setModalError(e.message || 'Error de conexión');
      setSaving(false);
    }
  }

  return (
    <>
      <NavBar />
      <div className="us-page">
        <div className="us-toolbar">
          <input
            className="us-search-input"
            placeholder="Buscar por nombre, email o rol..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button className="us-btn us-btn--primary" onClick={abrirCrear}>
            + Nuevo Usuario
          </button>
        </div>

        <div className="us-panel">
          <div className="us-header">
            <img src={logoSiglas} alt="IPS" className="us-header-logo" />
            <h1 className="us-header-title">Gestión de Usuarios</h1>
            <span className="us-header-count">
              {filtrados.length} usuario{filtrados.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="us-table-wrap">
            {loading ? (
              <p className="us-empty">Cargando usuarios...</p>
            ) : filtrados.length === 0 ? (
              <p className="us-empty">
                {busqueda ? 'Sin resultados para la búsqueda' : 'No hay usuarios registrados'}
              </p>
            ) : (
              <table className="us-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Roles</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((u) => (
                    <tr key={u.id}>
                      <td className="us-name-cell">{u.nombre_completo}</td>
                      <td className="us-email-cell">{u.email}</td>
                      <td>
                        {u.roles.length > 0
                          ? u.roles.map((r) => (
                              <span key={r} className={roleBadgeClass(r)}>
                                {r}
                              </span>
                            ))
                          : <span className="us-badge us-badge--default">sin rol</span>}
                      </td>
                      <td>
                        <span className={`us-status us-status--${u.activo ? 'activo' : 'inactivo'}`}>
                          <span className="us-status-dot" />
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="us-actions">
                          <button
                            className="us-btn us-btn--outline us-btn--sm"
                            onClick={() => abrirEditar(u)}
                          >
                            Editar
                          </button>
                          <button
                            className="us-btn us-btn--danger us-btn--sm"
                            onClick={() => abrirEliminar(u)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal Crear / Editar */}
      {(modal === 'crear' || modal === 'editar') && (
        <div className="us-modal-overlay" onClick={cerrarModal}>
          <div className="us-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="us-modal-title">
              {modal === 'crear' ? 'Nuevo Usuario' : 'Editar Usuario'}
            </h2>
            <div className="us-modal-form">
              <div className="us-modal-field">
                <label className="us-modal-label">Nombre completo</label>
                <input
                  className="us-modal-input"
                  value={form.nombre_completo}
                  onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
                  placeholder="Nombre y apellido"
                />
              </div>

              <div className="us-modal-field">
                <label className="us-modal-label">Email</label>
                <input
                  className="us-modal-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="usuario@ejemplo.com"
                />
              </div>

              <div className="us-modal-field">
                <label className="us-modal-label">
                  Contraseña{modal === 'editar' ? ' (dejar vacío para no cambiar)' : ''}
                </label>
                <input
                  className="us-modal-input"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={modal === 'editar' ? '••••••••' : 'Contraseña'}
                />
              </div>

              <div className="us-modal-field">
                <label className="us-modal-label">Roles</label>
                <div className="us-modal-roles">
                  {roles.map((r) => (
                    <span
                      key={r.id}
                      className={`us-modal-role-chip${form.roles.includes(r.nombre) ? ' us-modal-role-chip--active' : ''}`}
                      onClick={() => toggleRol(r.nombre)}
                    >
                      {form.roles.includes(r.nombre) ? '✓ ' : ''}
                      {r.nombre}
                    </span>
                  ))}
                </div>
              </div>

              <div className="us-modal-field">
                <label className="us-modal-label">Estado</label>
                <div className="us-modal-switch">
                  <button
                    type="button"
                    className={`us-switch${form.activo ? ' us-switch--on' : ''}`}
                    onClick={() => setForm({ ...form, activo: !form.activo })}
                  >
                    <span className="us-switch-knob" />
                  </button>
                  <span className="us-switch-label">
                    {form.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>

              {modalError && <p className="us-modal-error">{modalError}</p>}

              <div className="us-modal-btns">
                <button className="us-btn us-btn--outline" onClick={cerrarModal}>
                  Cancelar
                </button>
                <button
                  className="us-btn us-btn--primary"
                  onClick={guardar}
                  disabled={saving}
                >
                  {saving ? 'Guardando...' : modal === 'crear' ? 'Crear' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar */}
      {modal === 'eliminar' && deleteTarget && (
        <div className="us-modal-overlay" onClick={cerrarModal}>
          <div className="us-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="us-modal-title">Eliminar Usuario</h2>
            <p className="us-confirm-text">
              ¿Estás seguro de que querés eliminar al usuario{' '}
              <span className="us-confirm-name">{deleteTarget.nombre_completo}</span>?
              <br />
              Esta acción no se puede deshacer.
            </p>
            {modalError && <p className="us-modal-error">{modalError}</p>}
            <div className="us-modal-btns">
              <button className="us-btn us-btn--outline" onClick={cerrarModal}>
                Cancelar
              </button>
              <button
                className="us-btn us-btn--danger"
                onClick={confirmarEliminar}
                disabled={saving}
              >
                {saving ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
