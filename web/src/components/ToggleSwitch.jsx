export default function ToggleSwitch({ label, sublabel, checked, onChange, disabled = false }) {
  return (
    <div className={`breaker ${disabled ? 'breaker--disabled' : ''}`}>
      <div className="breaker__info">
        <div className="breaker__label">{label}</div>
        {sublabel && <div className="breaker__sublabel">{sublabel}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`breaker__switch ${checked ? 'breaker__switch--on' : 'breaker__switch--off'}`}
        onClick={() => !disabled && onChange(!checked)}
      >
        <span className="breaker__switch-track">
          <span className="breaker__switch-lever" />
        </span>
        <span className="breaker__switch-state">{checked ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  );
}