import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from './store/useAuthStore';
import useAppStore from './store/useAppStore';

// Layout
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleGuard from './components/auth/RoleGuard';

// Auth Pages
import Landing from './pages/auth/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import WalletOnboarding from './pages/auth/WalletOnboarding';

// Role-based Dashboards
import OwnerDashboard from './pages/owner/OwnerDashboard';
import CreatorDashboard from './pages/creator/CreatorDashboard';
import ElectionDetail from './pages/creator/ElectionDetail';
import VoterDashboardRBAC from './pages/voter/VoterDashboardRBAC';
import ElectionResultsPage from './pages/voter/ElectionResultsPage';

function App() {
  const { isAuthenticated, user, token } = useAuthStore();
  const { syncUserFromAuth } = useAppStore();

  // Initialize API token
  useEffect(() => {
    const initToken = async () => {
      const { default: apiService } = await import('./services/apiService');
      
      if (token) {
        apiService.setToken(token);
      } else {
        const storedToken = localStorage.getItem('api_token');
        if (storedToken) {
          apiService.setToken(storedToken);
        } else {
          const authStorage = localStorage.getItem('auth-storage');
          if (authStorage) {
            try {
              const parsed = JSON.parse(authStorage);
              if (parsed?.state?.token) {
                apiService.setToken(parsed.state.token);
              }
            } catch (e) {
              console.warn('Failed to parse auth storage:', e);
            }
          }
        }
      }
    };
    
    initToken();
  }, [token]);

  // Sync user data
  useEffect(() => {
    if (isAuthenticated && user) {
      try {
        syncUserFromAuth(user);
      } catch (error) {
        console.error('Error syncing user:', error);
      }
    } else if (!isAuthenticated) {
      const { resetUser } = useAppStore.getState();
      resetUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, user?.role]); // Only depend on user.id and user.role, not the entire user object or function

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        <Route
          path="/auth/wallet-onboarding"
          element={
            <ProtectedRoute>
              <WalletOnboarding />
            </ProtectedRoute>
          }
        />

        {/* Owner Dashboard - System Management */}
        <Route
          path="/dashboard/owner"
          element={
            <ProtectedRoute>
              <RoleGuard requiredRole="OWNER">
                <Layout>
                  <OwnerDashboard />
                </Layout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* Creator Dashboard - Election Management */}
        <Route
          path="/dashboard/creator"
          element={
            <ProtectedRoute>
              <RoleGuard requiredRole="CREATOR">
                <Layout>
                  <CreatorDashboard />
                </Layout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* Creator Election Detail */}
        <Route
          path="/dashboard/creator/elections/:electionAddress"
          element={
            <ProtectedRoute>
              <RoleGuard requiredRole="CREATOR">
                <Layout>
                  <ElectionDetail />
                </Layout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* Voter Dashboard - Voting */}
        <Route
          path="/dashboard/voter"
          element={
            <ProtectedRoute>
              <RoleGuard requiredRole="VOTER">
                <Layout>
                  <VoterDashboardRBAC />
                </Layout>
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* Election Results - Public for Voters */}
        <Route
          path="/elections/:electionAddress/results"
          element={
            <ProtectedRoute>
              <Layout>
                <ElectionResultsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
