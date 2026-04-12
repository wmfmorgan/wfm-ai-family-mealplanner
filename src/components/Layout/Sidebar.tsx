import React from 'react';
import { NavLink } from 'react-router-dom';
import './Layout.css';

const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-logo">Cookbook</h2>
        <h1>TEST</h1>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/planner" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">📅</span>
          <span className="nav-text">Planner</span>
        </NavLink>
        <NavLink to="/shopping" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">🛒</span>
          <span className="nav-text">Shopping</span>
        </NavLink>
        <NavLink to="/household" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">🏠</span>
          <span className="nav-text">Household</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">⚙️</span>
          <span className="nav-text">Settings</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
