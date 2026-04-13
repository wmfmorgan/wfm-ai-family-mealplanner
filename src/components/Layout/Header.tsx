import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import './Header.css';

const Header: React.FC = () => {
  return (
    <header className="site-header">
      <div className="header-container">
        <Link to="/" className="header-logo">
          Cookbook
        </Link>
        
        <nav className="header-nav">
          <NavLink to="/planner" className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}>
            Planner
          </NavLink>
          <NavLink to="/household" className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}>
            Household
          </NavLink>
          <NavLink to="/shopping" className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}>
            Shopping
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}>
            Settings
          </NavLink>
        </nav>

        <div className="header-utilities">
          <button className="utility-btn" aria-label="Notifications">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="utility-btn" aria-label="User Profile">
            <span className="material-symbols-outlined">account_circle</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
