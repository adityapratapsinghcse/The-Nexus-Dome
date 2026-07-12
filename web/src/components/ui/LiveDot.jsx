export default function LiveDot({ color = 'var(--status-safe)' }) {
  return <span className="ui-live-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />;
}