import PropTypes from 'prop-types';

const Alert = ({
  variant = 'info',
  title,
  children,
  onClose,
  className = ''
}) => {
  const variantClasses = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-900'
  };
  
  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${variantClasses[variant]} ${className}`} role="alert">
      <div className="flex-1">
        {title && <h4 className="font-semibold mb-1 text-sm">{title}</h4>}
        <div className="text-sm">{children}</div>
      </div>

      {onClose && (
        <button
          className="bg-transparent border-none text-xl text-current cursor-pointer p-0 w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-black/10 flex-shrink-0"
          onClick={onClose}
          aria-label="Close alert"
        >
          ×
        </button>
      )}
    </div>
  );
};

Alert.propTypes = {
  variant: PropTypes.oneOf(['info', 'success', 'warning', 'error']),
  title: PropTypes.string,
  children: PropTypes.node,
  onClose: PropTypes.func,
  className: PropTypes.string,
};

export default Alert;