import PropTypes from 'prop-types';

const Button = ({
  children,
  variant = 'primary',
  size = 'medium',
  onClick,
  disabled = false,
  type = 'button',
  className = '',
  ...props
}) => {
  // Tailwind CSS classes with improved styling
  const baseClasses = 'inline-flex items-center justify-center gap-2 border border-transparent rounded-xl font-semibold font-sans cursor-pointer transition-all duration-300 outline-none select-none whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale disabled:transform-none focus:ring-2 focus:ring-offset-2 active:scale-95';
  
  const variantClasses = {
    primary: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 focus:ring-blue-500',
    secondary: 'bg-gradient-to-r from-gray-600 to-gray-700 text-white shadow-lg shadow-gray-500/30 hover:from-gray-700 hover:to-gray-800 hover:shadow-xl hover:shadow-gray-500/40 hover:-translate-y-0.5 focus:ring-gray-500',
    outline: 'bg-transparent border-2 border-blue-600 text-blue-600 hover:bg-blue-50 hover:border-blue-700 hover:text-blue-700 hover:shadow-md focus:ring-blue-500',
    ghost: 'bg-transparent text-blue-600 hover:bg-blue-50 hover:text-blue-700 focus:ring-blue-500',
    danger: 'bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg shadow-red-500/30 hover:from-red-700 hover:to-pink-700 hover:shadow-xl hover:shadow-red-500/40 hover:-translate-y-0.5 focus:ring-red-500',
  };
  
  const sizeClasses = {
    small: 'px-4 py-2 text-sm h-9',
    medium: 'px-6 py-3 text-base h-12',
    large: 'px-8 py-4 text-lg h-14',
  };

  const classes = `${baseClasses} ${variantClasses[variant] || variantClasses.primary} ${sizeClasses[size] || sizeClasses.medium} ${className}`.trim();

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,

  variant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'ghost', 'danger']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  className: PropTypes.string,
};

export default Button;