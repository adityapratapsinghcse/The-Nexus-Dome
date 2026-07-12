import { useEffect, useState } from 'react';

export default function DialGauge({ value, max = 100, unit = '', label, size = 120, thresholds = { warning: 60, critical: 85 } }) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimatedValue(value), 80);
    return () => clearTimeout(t);
  }, [value]);

  const pct = Math.min(Math.max(animatedValue / max, 0), 1);
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75;
  const dashArray = circumference * arcFraction;
  const dashOffset = dashArray * (1 - pct);

  let color = 'var(--status-safe)';
  if (value >= thresholds.critical) color = 'var(--status-critical)';
  else if (value >= thresholds.warning) color = 'var(--status-warning)';

  const rotationOffset = 135;

  return (
    <div className="ui-dial" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--bg-panel-raised)" strokeWidth="8"
          strokeDasharray={`${dashArray} ${circumference}`}
          strokeDashoffset="0"
          strokeLinecap="round"
          transform={`rotate(${rotationOffset} ${size / 2} ${size / 2})`}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dashArray} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(${rotationOffset} ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.4s ease' }}
        />
      </svg>
      <div className="ui-dial-center">
        <span className="readout ui-dial-value">{Math.round(value)}<span className="ui-dial-unit">{unit}</span></span>
        {label && <span className="ui-dial-label">{label}</span>}
      </div>
    </div>
  );
}