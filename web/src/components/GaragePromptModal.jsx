export default function GaragePromptModal({ text, onYes, onNo }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="ui-panel" style={{ maxWidth: 360, padding: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: 'var(--text-primary)', marginBottom: 20 }}>{text}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="sn-unlock-btn" style={{ background: 'var(--status-safe)', width: 'auto', padding: '10px 24px' }} onClick={onYes}>
            Yes, open
          </button>
          <button className="sn-unlock-btn" style={{ background: 'var(--status-critical)', width: 'auto', padding: '10px 24px' }} onClick={onNo}>
            No, keep closed
          </button>
        </div>
      </div>
    </div>
  );
}