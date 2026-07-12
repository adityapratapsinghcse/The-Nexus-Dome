export default function PanelCard({ title, icon: Icon, children, className = '', accent = false }) {
  return (
    <div className={`ui-panel ${accent ? 'ui-panel-accent' : ''} ${className}`}>
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