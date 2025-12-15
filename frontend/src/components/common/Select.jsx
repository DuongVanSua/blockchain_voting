import PropTypes from 'prop-types';

const Select = ({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Chọn một tùy chọn',
  disabled = false,
  required = false,
  error,
  className = ''
}) => {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label className="text-sm font-medium text-gray-900 flex items-center">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className={`relative flex items-center border rounded-[10px] bg-white transition-all ${disabled ? 'bg-gray-50 cursor-not-allowed opacity-80' : ''} ${error ? 'border-red-500 focus-within:border-red-500 focus-within:shadow-[0_0_0_4px_rgba(239,68,68,0.2)]' : 'border-gray-200 focus-within:border-indigo-500 focus-within:shadow-[0_0_0_4px_rgba(79,70,229,0.25)]'}`}>
        <select
          className="w-full py-2.5 pr-10 pl-3.5 text-sm text-gray-900 bg-transparent border-none outline-none cursor-pointer appearance-none z-[1] disabled:cursor-not-allowed disabled:text-gray-400"
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}

          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none z-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {error && <span className="text-[13px] text-red-500 mt-0.5 font-medium">{error}</span>}
    </div>
  );
};

Select.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    label: PropTypes.string.isRequired,
  })),
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  error: PropTypes.string,
  className: PropTypes.string,
};

export default Select;