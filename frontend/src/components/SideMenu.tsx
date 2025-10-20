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
      </aside>
    </>
  )
}
