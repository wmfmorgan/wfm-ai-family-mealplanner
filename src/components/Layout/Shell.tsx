import React from 'react';
import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';
import './Layout.css';

interface ShellProps {
  children: React.ReactNode;
  isFullWidth?: boolean;
}

const Shell: React.FC<ShellProps> = ({ children, isFullWidth = false }) => {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <div className={isFullWidth ? "full-width-content" : "centered-content"}>
          {children}
        </div>
      </main>
      <BottomTabBar />
    </div>
  );
};

export default Shell;
