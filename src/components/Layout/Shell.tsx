import React from 'react';
import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';
import './Layout.css';

interface ShellProps {
  children: React.ReactNode;
}

const Shell: React.FC<ShellProps> = ({ children }) => {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <div className="centered-content">
          {children}
        </div>
      </main>
      <BottomTabBar />
    </div>
  );
};

export default Shell;
