import React from 'react';
import Header from './Header';
import Footer from './Footer';
import BottomTabBar from './BottomTabBar';
import './Layout.css';

interface ShellProps {
  children: React.ReactNode;
  isFullWidth?: boolean;
}

const Shell: React.FC<ShellProps> = ({ children, isFullWidth = false }) => {
  return (
    <div className="app-shell">
      <Header />
      <main className="main-content">
        <div className={isFullWidth ? "full-width-content" : "centered-content"}>
          {children}
        </div>
      </main>
      <Footer />
      <BottomTabBar />
    </div>
  );
};

export default Shell;
