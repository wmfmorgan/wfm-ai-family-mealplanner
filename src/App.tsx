import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import Shell from './components/Layout/Shell';
import Login from './pages/Auth/Login';
import Household from './pages/Household/Household';
import MealPlanner from './pages/MealPlanner/MealPlanner';
import ShoppingList from './pages/MealPlanner/ShoppingList';
import Settings from './pages/Settings/Settings';
import './App.css';

/**
 * Component to handle redirection from the root path while respecting auth loading state.
 * This ensures that if we land on / with auth codes (PKCE), we wait for processing 
 * before redirecting and potentially stripping the code.
 */
const HomeRedirect: React.FC = () => {
  const { loading, session } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center w-full p-4" style={{ minHeight: '100vh' }}>
        <p>Verifying session...</p>
      </div>
    );
  }

  return <Navigate to={session ? "/planner" : "/login"} replace />;
};

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
            path="/shopping"
            element={
              <ProtectedRoute>
                <Shell>
                  <ShoppingList />
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
          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<Navigate to="/planner" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
