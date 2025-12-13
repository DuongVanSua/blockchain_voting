import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import useAuthStore from '../../store/useAuthStore';
import apiService from '../../services/apiService';

/**
 * RoleGuard - Protects routes based on smart contract roles
 * @param {string} requiredRole - 'OWNER', 'CREATOR', or 'VOTER'
 * @param {ReactNode} children - Component to render if authorized
 */
const RoleGuard = ({ requiredRole, children }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      if (!isAuthenticated || !user) {
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      // For VOTER role, only check database role (no wallet required)
      if (requiredRole === 'VOTER') {
        const userRole = user.role;
        const isVoter = userRole === 'VOTER';
        setIsAuthorized(isVoter);
        setIsLoading(false);
        // Don't show toast if redirecting to login
        return;
      }

      // For OWNER and CREATOR, check database role first, then smart contract if available
      const userRole = user.role;
      
      // First check: Database role must match
      let authorizedByDB = false;
      switch (requiredRole) {
        case 'OWNER':
          authorizedByDB = userRole === 'OWNER';
          break;
        case 'CREATOR':
          authorizedByDB = userRole === 'CREATOR' || userRole === 'OWNER';
          break;
        default:
          authorizedByDB = false;
      }
      
      if (!authorizedByDB) {
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }
      
      // Second check: If wallet address exists, verify smart contract role
      // But don't block if smart contract is not configured
      const walletAddress = user.walletAddress || user.wallet_address;
      if (walletAddress) {
        try {
          const response = await apiService.getCurrentUser();
          
          if (response.success && response.user) {
            const { isOwner, isCreator } = response.user;
            
            // If smart contract is configured, check it
            // Otherwise, allow access based on database role
            let authorizedByContract = false;
            
            switch (requiredRole) {
              case 'OWNER':
                // If isOwner is explicitly false (contract configured), require it
                // If isOwner is undefined/null (contract not configured), allow based on DB role
                authorizedByContract = isOwner !== false;
                break;
              case 'CREATOR':
                // Allow if explicitly creator/owner, or if contract not configured (both undefined)
                authorizedByContract = isCreator === true || isOwner === true || (isCreator === undefined && isOwner === undefined);
                // But deny if explicitly false (contract configured and user is not creator)
                if (isCreator === false && isOwner === false) {
                  authorizedByContract = false;
                }
                break;
              default:
                authorizedByContract = false;
            }
            
            setIsAuthorized(authorizedByContract);
          } else {
            // If API call fails, allow based on database role
            setIsAuthorized(true);
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Role check error (allowing based on DB role):', error.message);
          // If smart contract check fails, allow based on database role
          setIsAuthorized(true);
        } finally {
          setIsLoading(false);
        }
      } else {
        // No wallet address - allow based on database role for now
        // User can connect wallet later if needed
        setIsAuthorized(true);
        setIsLoading(false);
      }
    };

    checkRole();
  }, [isAuthenticated, user, requiredRole]);

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    // If token is invalid or user doesn't have permission, redirect to login
    // Don't show "Access Denied" page - just redirect to login
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return children;
};

RoleGuard.propTypes = {
  requiredRole: PropTypes.oneOf(['OWNER', 'CREATOR', 'VOTER']).isRequired,
  children: PropTypes.node.isRequired,
};

export default RoleGuard;

