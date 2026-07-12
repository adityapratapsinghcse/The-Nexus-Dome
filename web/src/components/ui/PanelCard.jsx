export default function PanelCard({ title, icon: Icon, children, className = '', accent = false, ...rest }) {
  // FIX: this component silently dropped any extra props (style, onClick, etc.)
  // Security.jsx was already passing style={{gridColumn:'span 2'}} to it and
  // it was being ignored, so the grid spans never actually applied.
  return (
    <div className={`ui-panel ${accent ? 'ui-panel-accent' : ''} ${className}`} {...rest}>
      {title && (
        <div className="ui-panel-header">
          {Icon && <Icon size={16} className="ui-panel-icon" />}
          <span className="label-eyebrow">{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}