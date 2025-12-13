import PropTypes from 'prop-types';

const Radio = ({
  label,
  name,
  value,
  checked,
  onChange,
  disabled = false,
  required = false,
  error,
  className = ''
}) => {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className={`inline-flex items-start cursor-pointer relative gap-2.5 select-none ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
        <input
          type="radio"
          className="absolute opacity-0 cursor-pointer h-0 w-0 peer"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          required={required}
        />

        <span className={`w-5 h-5 border-2 rounded-full bg-white relative flex items-center justify-center transition-all flex-shrink-0 ${error ? 'border-red-500' : 'border-gray-300'} peer-hover:not(:disabled):border-indigo-500 peer-hover:not(:disabled):bg-indigo-50 peer-checked:border-indigo-600 peer-focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,0.3)] ${disabled ? 'bg-gray-100 border-gray-200' : ''}`}>
          <span className={`w-2.5 h-2.5 bg-indigo-600 rounded-full transition-transform scale-0 peer-checked:scale-100 ${error ? 'bg-red-500' : ''}`} />
        </span>

        {label && (
          <span className="text-sm text-gray-700 leading-5 pt-0.5">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </span>
        )}
      </label>

      {error && <span className="text-xs text-red-500 ml-[30px]">{error}</span>}
    </div>
  );
};

Radio.propTypes = {
  label: PropTypes.node,
  name: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  checked: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  error: PropTypes.string,
  className: PropTypes.string,
};

export default Radio;