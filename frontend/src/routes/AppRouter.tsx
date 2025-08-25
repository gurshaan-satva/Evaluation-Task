// routes/AppRouter.tsx
import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import LandingPage from '../pages/LandingPage';
import Dashboard from '../pages/Dashboard';
import OAuthSuccess from '../pages/OAuthSuccess';
import SyncLogComponent from '../pages/SyncLog';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = localStorage.getItem('qb_access_token') && localStorage.getItem('qb_realm_id');
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

// Public Route Component (handles OAuth callback and redirects)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = localStorage.getItem('qb_access_token') && localStorage.getItem('qb_realm_id');
  
  // Check if this is an OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const realmId = urlParams.get('realmId');
  
  // If it's a callback with auth parameters, let the landing page handle it
  if (code && state && realmId) {
    return <>{children}</>;
  }
  
  // If already authenticated and not a callback, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const appRouter = createBrowserRouter([
  {
    path: "/",
    element: (
      <PublicRoute>
        <LandingPage />
      </PublicRoute>
    )
  },
  {
    path: "/oauth-success",
    element: <OAuthSuccess />
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    )
  },
  {
    path: "/sync-logs",
    element: (
      <ProtectedRoute>
        <SyncLogComponent />
      </ProtectedRoute>
    )
  },
  {
    path: "*",
    element: (
      localStorage.getItem('qb_access_token') && localStorage.getItem('qb_realm_id') 
        ? <Navigate to="/dashboard" replace />
        : <Navigate to="/" replace />
    )
  }
]);

export default appRouter;