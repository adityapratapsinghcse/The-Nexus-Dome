import { useMemo } from 'react';

export default function DialGauge({ value = 0, min = 0, max = 100, unit = '', label = '', status, thresholds, size = 168 }) {
  const clamped = Math.min(max, Math.max(min, value));
  const pct = (clamped - min) / (max - min || 1);

  const resolvedStatus = useMemo(() => {
    if (status) return status;
    if (thresholds) {
      if (clamped >= thresholds.critical) return 'critical';
      if (clamped >= thresholds.warning) return 'warning';
    }
    return 'safe';
  }, [status, thresholds, clamped]);

  const strokeWidth = size * 0.075;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 135;
  const sweep = 270;
  const endAngle = startAngle + sweep * pct;

  const polar = (angleDeg) => {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  const arcPath = (a0, a1) => {
    const [x0, y0] = polar(a0);
    const [x1, y1] = polar(a1);
    const largeArc = a1 - a0 > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1}`;
  };

  const needleAngle = startAngle + sweep * pct;
  const needleLen = r - strokeWidth * 0.6;
  const needleTip = [
    cx + needleLen * Math.cos(((needleAngle - 90) * Math.PI) / 180),
    cy + needleLen * Math.sin(((needleAngle - 90) * Math.PI) / 180),
  ];

  const statusColor = `var(--status-${resolvedStatus})`;

  return (
    <div className="dial-gauge" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={arcPath(startAngle, startAngle + sweep)} fill="none" stroke="var(--border-subtle)" strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d={arcPath(startAngle, Math.max(startAngle + 0.001, endAngle))} fill="none" stroke={statusColor} strokeWidth={strokeWidth} strokeLinecap="round" className="dial-gauge__fill" />
        {Array.from({ length: 11 }).map((_, i) => {
          const a = startAngle + sweep * (i / 10);
          const [ox, oy] = polar(a);
          const ix = cx + (r - strokeWidth * 1.5) * Math.cos(((a - 90) * Math.PI) / 180);
          const iy = cy + (r - strokeWidth * 1.5) * Math.sin(((a - 90) * Math.PI) / 180);
          return <line key={i} x1={ix} y1={iy} x2={ox} y2={oy} stroke="var(--border-subtle)" strokeWidth={1} />;
        })}
        <g className="dial-gauge__needle">
          <line x1={cx} y1={cy} x2={needleTip[0]} y2={needleTip[1]} stroke="var(--accent-copper-bright)" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={strokeWidth * 0.5} fill="var(--accent-copper-bright)" />
        </g>
      </svg>
      <div className="dial-gauge__readout">
        <span className="readout dial-gauge__value" style={{ color: statusColor }}>
          {Number.isFinite(value) ? value.toFixed(value % 1 === 0 ? 0 : 1) : '—'}
        </span>
        <span className="dial-gauge__unit">{unit}</span>
      </div>
      {label && <div className="label-eyebrow dial-gauge__label">{label}</div>}
    </div>
  );
}