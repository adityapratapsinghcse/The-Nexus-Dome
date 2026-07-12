const statusMap = {
  safe: { color: 'var(--status-safe)', text: 'NORMAL' },
  warning: { color: 'var(--status-warning)', text: 'WARNING' },
  critical: { color: 'var(--status-critical)', text: 'CRITICAL' },
};

export default function StatusPill({ status = 'safe', text }) {
  const cfg = statusMap[status];
  return (
    <span className="ui-pill" style={{ color: cfg.color, borderColor: `${cfg.color}44`, background: `${cfg.color}14` }}>
      <span className="ui-pill-dot" style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />
      {text || cfg.text}
    </span>
  );
}