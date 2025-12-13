import PropTypes from 'prop-types';

const Textarea = ({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
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

      <div className={`relative flex border rounded-[10px] bg-white transition-all overflow-hidden ${disabled ? 'bg-gray-50 cursor-not-allowed opacity-80' : ''} ${error ? 'border-red-500 focus-within:border-red-500 focus-within:shadow-[0_0_0_4px_rgba(239,68,68,0.2)]' : 'border-gray-200 focus-within:border-indigo-500 focus-within:shadow-[0_0_0_4px_rgba(79,70,229,0.25)]'}`}>
        <textarea
          className="w-full py-3 px-3.5 text-sm text-gray-900 border-none outline-none bg-transparent font-inherit leading-relaxed resize-y min-h-[80px] disabled:cursor-not-allowed placeholder:text-gray-400"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
        />
      </div>

      {error && <span className="text-[13px] text-red-500 mt-0.5 font-medium">{error}</span>}
    </div>
  );
};

Textarea.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  rows: PropTypes.number,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  error: PropTypes.string,
  className: PropTypes.string,
};

export default Textarea;