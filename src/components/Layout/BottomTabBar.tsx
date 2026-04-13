import React from 'react';
import { NavLink } from 'react-router-dom';
import './Layout.css';

const BottomTabBar: React.FC = () => {
  return (
    <nav className="bottom-tab-bar">
      <NavLink to="/planner" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
        <span className="material-symbols-outlined tab-icon">calendar_today</span>
        <span className="tab-text">Planner</span>
      </NavLink>
      <NavLink to="/shopping" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
        <span className="material-symbols-outlined tab-icon">shopping_cart</span>
        <span className="tab-text">Shopping</span>
      </NavLink>
      <NavLink to="/household" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
        <span className="material-symbols-outlined tab-icon">groups</span>
        <span className="tab-text">Household</span>
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
        <span className="material-symbols-outlined tab-icon">settings</span>
        <span className="tab-text">Settings</span>
      </NavLink>
    </nav>
  );
};

export default BottomTabBar;
