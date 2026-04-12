import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import Shell from './components/Layout/Shell';
import Login from './pages/Auth/Login';
import Household from './pages/Household/Household';
import MealPlanner from './pages/MealPlanner/MealPlanner';
import Settings from './pages/Settings/Settings';
import './App.css';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes wrapped in Shell */}
          <Route
            path="/planner"
            element={
              <ProtectedRoute>
                <Shell isFullWidth={true}>
                  <MealPlanner />
                </Shell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/household"
            element={
              <ProtectedRoute>
                <Shell>
                  <Household />
                </Shell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Shell>
                  <Settings />
                </Shell>
              </ProtectedRoute>
            }
          />

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/planner" replace />} />
          <Route path="*" element={<Navigate to="/planner" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
