import { NavLink } from 'react-router-dom';
import logoSiglas from '../multimedia/logo-siglas.svg';
import './NavBar.css';

/* Barra de navegación común a todas las páginas internas (no en el login). */
export default function NavBar() {
  return (
    <nav className="nav">
      <NavLink to="/afiliados" className="nav-brand">
        <img src={logoSiglas} alt="IPS" className="nav-logo" />
      </NavLink>

      <NavLink to="/afiliados" className="nav-link">
        Afiliados
      </NavLink>

      <NavLink to="/usuarios" className="nav-link">
        Usuarios
      </NavLink>
    </nav>
  );
}
