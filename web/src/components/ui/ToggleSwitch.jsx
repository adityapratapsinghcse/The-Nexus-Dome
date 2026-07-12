export default function ToggleSwitch({ label, icon: Icon, checked, onChange, disabled = false }) {
  return (
    <div className={`ui-toggle-row ${disabled ? 'ui-toggle-disabled' : ''}`}>
      <div className="ui-toggle-label">
        {Icon && <Icon size={17} />}
        <span>{label}</span>
      </div>
      <button
        className={`ui-toggle ${checked ? 'ui-toggle-on' : ''}`}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        aria-pressed={checked}
        aria-label={label}
      >
        <span className="ui-toggle-knob" />
      </button>
    </div>
  );
}