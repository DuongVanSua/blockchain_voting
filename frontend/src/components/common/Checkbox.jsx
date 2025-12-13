import PropTypes from 'prop-types';

const Checkbox = ({
  label,
  checked = false,
  onChange,
  disabled = false,
  required = false,
  error,
  className = ''
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className={`inline-flex items-start cursor-pointer relative select-none gap-2.5 ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
        <input
          type="checkbox"
          className="absolute opacity-0 cursor-pointer h-0 w-0 peer"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          required={required}
        />

        <span className={`h-5 w-5 bg-white border-2 rounded-md flex items-center justify-center transition-all flex-shrink-0 ${error ? 'border-red-500' : 'border-gray-300'} peer-hover:not(:disabled):border-indigo-500 peer-hover:not(:disabled):bg-indigo-50 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 peer-focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,0.3)] ${disabled ? 'bg-gray-100 border-gray-200' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`w-3.5 h-3.5 transition-all opacity-0 scale-50 peer-checked:opacity-100 peer-checked:scale-100`}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>

        {label && (
          <span className="text-sm text-gray-700 leading-5 pt-0.5">
            {label}
            {required && <span className="text-red-500 ml-1 font-bold">*</span>}
          </span>
        )}
      </label>

      {error && <span className="text-xs text-red-500 ml-[30px] font-medium">{error}</span>}
    </div>
  );
};

Checkbox.propTypes = {
  label: PropTypes.node,
  checked: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  error: PropTypes.string,
  className: PropTypes.string,
};

export default Checkbox;