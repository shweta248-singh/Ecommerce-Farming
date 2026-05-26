import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * ProtectedRoute component to enforce role-based access
 * @param {Object} props
 * @param {React.ReactNode} props.children - The component to render if authorized
 * @param {string} props.requiredRole - The role required to access the route
 * @param {string} props.redirectTo - Where to redirect if the user has the WRONG role but is logged in
 */
const ProtectedRoute = ({ children, requiredRole, redirectTo }) => {
  const role = localStorage.getItem('role');
  const userStr = localStorage.getItem('user'); // Assuming user object is stored here
  const user = userStr ? JSON.parse(userStr) : null;

  // 1. If not logged in, redirect to appropriate login page
  if (!role || !user) {
    const loginPath = requiredRole === 'seller' ? '/seller-login' : '/buyer-login';
    const redirectPath = `${window.location.pathname}${window.location.search}`;
    const loginTarget =
      requiredRole === 'seller'
        ? loginPath
        : `${loginPath}?redirect=${encodeURIComponent(redirectPath)}`;
    console.log("NOT LOGGED IN. Navigating to:", loginPath);
    return <Navigate to={loginTarget} replace />;
  }

  // 2. If logged in but has the WRONG role
  const isAuthorized = role === requiredRole || (requiredRole === 'seller' && role === 'farmer');
  
  if (!isAuthorized) {
    // Prevent sellers from accessing buyer pages and vice versa
    console.log(`WRONG ROLE (${role} != ${requiredRole}). Navigating to:`, redirectTo);
    return <Navigate to={redirectTo} replace />;
  }

  // 3. Authorized
  console.log(`AUTHORIZED for ${requiredRole}:`, window.location.pathname);
  return children;
};

export default ProtectedRoute;
