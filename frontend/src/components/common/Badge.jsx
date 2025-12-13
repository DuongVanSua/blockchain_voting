import PropTypes from 'prop-types';

const Badge = ({ children, variant = 'default', size = 'medium' }) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-full border transition-all whitespace-nowrap';
  
  const sizeClasses = {
    small: 'text-[11px] px-2 py-1',
    medium: 'text-xs px-3 py-1.5',
    large: 'text-sm px-4 py-2'
  };
  
  const variantClasses = {
    default: 'bg-gray-100 text-gray-600 border-gray-200',
    neutral: 'bg-gray-100 text-gray-600 border-gray-200',
    primary: 'bg-blue-50 text-blue-900 border-blue-200',
    success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-red-50 text-red-900 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200'
  };
  
  return (
    <span className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]}`}>
      {children}
    </span>
  );
};

Badge.propTypes = {
  children: PropTypes.node.isRequired,

  variant: PropTypes.oneOf(['default', 'primary', 'success', 'warning', 'error', 'info', 'neutral']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
};

export default Badge;