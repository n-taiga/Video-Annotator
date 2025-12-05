import React from 'react'

export default function ShortcutsPanel() {
  return (
    <div
      className="shortcuts-below-left"
      style={{
        padding: '10px 12px',
        borderTop: '1px solid rgba(148,163,184,0.04)',
        fontSize: 16,
        color: '#94a3b8',
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      <div style={{ fontWeight: 600, color: '#cbd5e1', marginBottom: 20 }}>Keyboard Shortcuts</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 8px', alignItems: 'center' }}>
        <div>Play / Pause</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ background: 'rgba(148,163,184,0.08)', color: '#e6eef8', borderRadius: 6, padding: '3px 8px', fontSize: 14, fontWeight: 600 }}>Space</span>
        </div>

        <div>Seek backward</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ background: 'rgba(148,163,184,0.08)', color: '#e6eef8', borderRadius: 6, padding: '6px 10px', fontSize: 14, fontWeight: 800 }}>⬅</span>
        </div>

        <div>Seek forward</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ background: 'rgba(148,163,184,0.08)', color: '#e6eef8', borderRadius: 6, padding: '6px 10px', fontSize: 14, fontWeight: 800 }}>➡</span>
        </div>

        <div>Set START</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ background: 'rgba(148,163,184,0.08)', color: '#e6eef8', borderRadius: 6, padding: '3px 8px', fontSize: 16, fontWeight: 600 }}>A</span>
        </div>

        <div>Set END</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ background: 'rgba(148,163,184,0.08)', color: '#e6eef8', borderRadius: 6, padding: '3px 8px', fontSize: 16, fontWeight: 600 }}>D</span>
        </div>

        <div>Open selection menu</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ background: 'rgba(148,163,184,0.08)', color: '#e6eef8', borderRadius: 6, padding: '3px 8px', fontSize: 16, fontWeight: 600 }}>S</span>
        </div>

        <div>Toggle "Contact"</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ background: 'rgba(148,163,184,0.08)', color: '#e6eef8', borderRadius: 6, padding: '3px 8px', fontSize: 16, fontWeight: 600 }}>W</span>
        </div>

        <div>Add action</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ background: 'rgba(148,163,184,0.08)', color: '#e6eef8', borderRadius: 6, padding: '4px 8px', fontSize: 14, fontWeight: 600 }}>Enter</span>
        </div>

        <div>Delete action</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ background: 'rgba(148,163,184,0.08)', color: '#e6eef8', borderRadius: 6, padding: '4px 8px', fontSize: 14, fontWeight: 600 }}>Backspace</span>
        </div>

        <div>Cancel selection</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ background: 'rgba(148,163,184,0.08)', color: '#e6eef8', borderRadius: 6, padding: '4px 8px', fontSize: 16, fontWeight: 600 }}>Q</span>
        </div>
      </div>
    </div>
  )
}
