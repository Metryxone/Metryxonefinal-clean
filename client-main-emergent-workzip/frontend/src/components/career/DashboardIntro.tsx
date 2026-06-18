import React from 'react';

interface Props {
  title: string;
  whatItIs: string;
  whenToUse: string;
  prereq?: string;
  audience?: string;
}

export const DashboardIntro: React.FC<Props> = ({ title, whatItIs, whenToUse, prereq, audience }) => (
  <div
    style={{
      margin: '16px 24px 0',
      padding: '14px 18px',
      background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
      border: '1px solid #c7d2fe',
      borderRadius: 10,
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#1e293b',
    }}
    data-testid="dashboard-intro"
  >
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#4338ca' }}>
        What this is
      </span>
      <span style={{ fontSize: 13, color: '#1e293b' }}>{whatItIs}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#4338ca' }}>
        When to use
      </span>
      <span style={{ fontSize: 13, color: '#334155' }}>{whenToUse}</span>
    </div>
    {(prereq || audience) && (
      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', fontSize: 11.5, color: '#475569' }}>
        {prereq && (
          <span style={{ background: '#fff', border: '1px solid #c7d2fe', borderRadius: 999, padding: '3px 10px' }}>
            <strong style={{ color: '#4338ca' }}>Prereq:</strong> {prereq}
          </span>
        )}
        {audience && (
          <span style={{ background: '#fff', border: '1px solid #c7d2fe', borderRadius: 999, padding: '3px 10px' }}>
            <strong style={{ color: '#4338ca' }}>For:</strong> {audience}
          </span>
        )}
      </div>
    )}
    {title && <span style={{ display: 'none' }}>{title}</span>}
  </div>
);

export default DashboardIntro;
