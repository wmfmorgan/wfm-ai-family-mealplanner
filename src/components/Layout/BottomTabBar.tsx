import React from 'react';
import { NavLink } from 'react-router-dom';
import { Calendar, Users, Settings, ShoppingCart } from 'lucide-react';
import './Layout.css';

const BottomTabBar: React.FC = () => {
  return (
    <nav className="bottom-tab-bar">
      <NavLink to="/planner" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
        <Calendar size={20} className="tab-icon" />
        <span className="tab-text">Planner</span>
      </NavLink>
      <NavLink to="/shopping" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
        <ShoppingCart size={20} className="tab-icon" />
        <span className="tab-text">Shopping</span>
      </NavLink>
      <NavLink to="/household" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
        <Users size={20} className="tab-icon" />
        <span className="tab-text">Household</span>
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
        <Settings size={20} className="tab-icon" />
        <span className="tab-text">Settings</span>
      </NavLink>
    </nav>
  );
};

export default BottomTabBar;
