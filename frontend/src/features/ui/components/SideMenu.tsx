import React from 'react'

type SideMenuProps = {
  open: boolean
  onClose: () => void
  title?: string
  widthPx?: number
  topOffset?: string | number
  children?: React.ReactNode
}

export default function SideMenu({ open, onClose, title = 'Menu', widthPx = 300, topOffset, children }: SideMenuProps) {
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!open) return
    onClose()
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`side-menu-overlay ${open ? 'open' : ''}`}
        style={topOffset !== undefined ? { ['--drawer-top' as any]: typeof topOffset === 'number' ? `${topOffset}px` : topOffset } : undefined}
        aria-hidden={!open}
        role="presentation"
        onClick={handleOverlayClick}
      />

      {/* Panel */}
      <aside
        className={`side-menu ${open ? 'open' : ''}`}
        style={Object.assign(
          { width: widthPx },
          topOffset !== undefined ? { ['--drawer-top' as any]: typeof topOffset === 'number' ? `${topOffset}px` : topOffset } : {}
        )}
        aria-hidden={!open}
        aria-label="Side menu"
      >
        <div className="side-menu-header">
          <div className="side-menu-title">{title}</div>
        </div>
        <div className="side-menu-content">
          {children ?? (
            <div className="side-menu-placeholder">
              <p>ここにメニュー項目を配置できます。</p>
              <ul>
                <li>・動画の切替</li>
                <li>・ラベル管理</li>
                <li>・エクスポート/インポート</li>
              </ul>
            </div>
          )}
        </div>
        <div className="side-menu-footer" style={{ padding: '12px 16px', borderTop: '1px solid rgba(148,163,184,0.06)', marginTop: 'auto' }}>
          <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: '1.4' }}>
            <div style={{ fontWeight: 600, color: '#cbd5e1', marginBottom: 16 }}>Keyboard Shortcuts</div>

            {/* Grid: label on left, key chip on right */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 10px', alignItems: 'center' }}>
              <div>Play / Pause</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ background: 'rgba(148,163,184,0.12)', color: '#e6eef8', borderRadius: 6, padding: '4px 8px', fontSize: 14, fontWeight: 600 }}>Space</span>
              </div>

              <div>Seek backward</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ background: 'rgba(148,163,184,0.12)', color: '#e6eef8', borderRadius: 6, padding: '6px 10px', fontSize: 14, fontWeight: 700 }}>⬅</span>
              </div>

              <div>Seek forward</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ background: 'rgba(148,163,184,0.12)', color: '#e6eef8', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 700 }}>➡</span>
              </div>

              <div>Set START</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ background: 'rgba(148,163,184,0.12)', color: '#e6eef8', borderRadius: 6, padding: '4px 8px', fontSize: 16, fontWeight: 600 }}>A</span>
              </div>

              <div>Set END</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ background: 'rgba(148,163,184,0.12)', color: '#e6eef8', borderRadius: 6, padding: '4px 8px', fontSize: 16, fontWeight: 600 }}>D</span>
              </div>

              <div>Open selection menu</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ background: 'rgba(148,163,184,0.12)', color: '#e6eef8', borderRadius: 6, padding: '4px 8px', fontSize: 16, fontWeight: 600 }}>S</span>
              </div>

              <div>Toggle "Contact"</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ background: 'rgba(148,163,184,0.12)', color: '#e6eef8', borderRadius: 6, padding: '4px 8px', fontSize: 16, fontWeight: 600 }}>W</span>
              </div>

              <div>Add action</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ background: 'rgba(148,163,184,0.12)', color: '#e6eef8', borderRadius: 6, padding: '4px 8px', fontSize: 14, fontWeight: 600 }}>Enter</span>
              </div>

              <div>Delete action</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ background: 'rgba(148,163,184,0.12)', color: '#e6eef8', borderRadius: 6, padding: '4px 8px', fontSize: 14, fontWeight: 600 }}>Backspace</span>
              </div>

              <div>Cancel selection</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ background: 'rgba(148,163,184,0.12)', color: '#e6eef8', borderRadius: 6, padding: '4px 8px', fontSize: 16, fontWeight: 600 }}>Q</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
