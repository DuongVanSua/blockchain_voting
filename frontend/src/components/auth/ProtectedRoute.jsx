import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import useAuthStore from '../../store/useAuthStore';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (requiredRole) {
    const userRole = user?.role;

    const hasAccess = userRole === requiredRole;

    if (!hasAccess) {
      if (userRole === 'VOTER') {
        return <Navigate to="/dashboard/voter" replace />;
      }
      if (userRole === 'CREATOR') {
        return <Navigate to="/dashboard/creator" replace />;
      }
      if (userRole === 'OWNER') {
        return <Navigate to="/dashboard/owner" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requiredRole: PropTypes.string,
};

export default ProtectedRoute;