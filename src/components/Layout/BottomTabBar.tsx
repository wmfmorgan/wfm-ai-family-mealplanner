import React from 'react';
import { NavLink } from 'react-router-dom';
import './Layout.css';

const BottomTabBar: React.FC = () => {
  return (
    <nav className="bottom-tab-bar">
      <NavLink to="/planner" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
        <span className="tab-icon">📅</span>
        <span className="tab-text">Planner</span>
      </NavLink>
      <NavLink to="/household" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
        <span className="tab-icon">🏠</span>
        <span className="tab-text">Household</span>
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
        <span className="tab-icon">⚙️</span>
        <span className="tab-text">Settings</span>
      </NavLink>
    </nav>
  );
};

export default BottomTabBar;
