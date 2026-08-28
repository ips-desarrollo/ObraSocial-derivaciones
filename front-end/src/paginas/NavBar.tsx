import { NavLink } from 'react-router-dom';
import logoSiglas from '../multimedia/logo-siglas.svg';
import './NavBar.css';

function getUserRoles(): string[] {
  try {
    const u = localStorage.getItem('usuario');
    if (!u) return [];
    return JSON.parse(u).roles || [];
  } catch {
    return [];
  }
}

export default function NavBar() {
  const roles = getUserRoles();
  const esAdmin = roles.includes('admin');

  return (
    <nav className="nav">
      <NavLink to="/inicio" className="nav-brand">
        <img src={logoSiglas} alt="IPS" className="nav-logo" />
      </NavLink>

      <NavLink to="/inicio" className="nav-link">
        Inicio
      </NavLink>

      <NavLink to="/afiliados" className="nav-link">
        Afiliados
      </NavLink>

      <NavLink to="/legajo" className="nav-link">
        Legajo
      </NavLink>

      <NavLink to="/derivaciones" className="nav-link">
        Derivaciones
      </NavLink>

      <NavLink to="/costos" className="nav-link">
        Costos
      </NavLink>

      {esAdmin && (
        <NavLink to="/usuarios" className="nav-link">
          Usuarios
        </NavLink>
      )}
    </nav>
  );
}
