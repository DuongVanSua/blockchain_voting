import PropTypes from 'prop-types';

const Switch = ({
  label,
  checked = false,
  onChange,
  disabled = false,
  required = false,
  error,
  className = ''
}) => {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className={`inline-flex items-center gap-3 cursor-pointer relative select-none min-h-6 ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
        <input
          type="checkbox"
          className="absolute opacity-0 w-0 h-0 peer"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          required={required}
          role="switch"
          aria-checked={checked}
        />

        <span className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.06)] ${error ? 'bg-red-300 peer-checked:bg-red-500' : 'bg-gray-200 peer-checked:bg-indigo-600'} peer-focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,0.3)] ${disabled ? 'bg-gray-100' : ''}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_0_rgba(0,0,0,0.06)] transition-transform peer-checked:translate-x-5`} />
        </span>

        {label && (
          <span className="text-sm text-gray-700 font-medium">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </span>
        )}
      </label>

      {error && <span className="text-xs text-red-500 ml-14">{error}</span>}
    </div>
  );
};

Switch.propTypes = {
  label: PropTypes.node,
  checked: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  error: PropTypes.string,
  className: PropTypes.string,
};

export default Switch;