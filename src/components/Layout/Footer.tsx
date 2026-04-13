import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">Cookbook</Link>
          <p className="footer-tagline">Personalized meal planning for your family.</p>
        </div>
        
        <div className="footer-links">
          <div className="footer-link-group">
            <h4 className="footer-heading">App</h4>
            <Link to="/planner">Planner</Link>
            <Link to="/household">Household</Link>
            <Link to="/shopping">Shopping List</Link>
          </div>
          <div className="footer-link-group">
            <h4 className="footer-heading">Support</h4>
            <Link to="/settings">Settings</Link>
            <a href="#">Help Center</a>
            <a href="#">Feedback</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="footer-container">
          <p>&copy; {new Date().getFullYear()} Cookbook. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
