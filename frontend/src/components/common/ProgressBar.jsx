import PropTypes from 'prop-types';

const ProgressBar = ({
  value = 0,
  max = 100,
  label,
  showPercentage = true,
  variant = 'primary',
  className = ''
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const variantClasses = {
    primary: 'bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-[0_2px_4px_rgba(79,70,229,0.2)]',
    success: 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_2px_4px_rgba(16,185,129,0.2)]',
    warning: 'bg-gradient-to-r from-amber-400 to-amber-500',
    error: 'bg-gradient-to-r from-red-400 to-red-500'
  };

  return (
    <div className={`w-full flex flex-col gap-2 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center text-[13px] font-medium text-gray-700">
          {label && <span>{label}</span>}
          {showPercentage && (
            <span className="text-gray-500 font-mono text-xs">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}

      <div
        className="w-full h-2 bg-gray-100 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={`h-full rounded-full transition-all duration-600 ease-out relative ${variantClasses[variant]}`}
          style={{ width: `${percentage}%` }}
        >
          <div className="absolute top-0 right-0 bottom-0 w-1 bg-white/30 rounded-full" />
        </div>
      </div>
    </div>
  );
};

ProgressBar.propTypes = {
  value: PropTypes.number,
  max: PropTypes.number,
  label: PropTypes.string,
  showPercentage: PropTypes.bool,
  variant: PropTypes.oneOf(['primary', 'success', 'warning', 'error']),
  className: PropTypes.string,
};

export default ProgressBar;