import React from 'react'
import type { RefObject, WheelEvent } from 'react'
import ConfigurationPanel from '../../labels/components/ConfigurationPanel'

type ConfigurationPanelProps = React.ComponentProps<typeof ConfigurationPanel>

interface ConfigurationFloatingMenuProps {
  visible: boolean
  configMenuRef: RefObject<HTMLDivElement>
  onWheel: (event: WheelEvent<HTMLDivElement>) => void
  onClose: () => void
  configurationPanelProps: ConfigurationPanelProps
}

export default function ConfigurationFloatingMenu({ visible, configMenuRef, onWheel, onClose, configurationPanelProps }: ConfigurationFloatingMenuProps) {
  if (!visible) return null

  return (
    <div
      className="config-floating-menu"
      role="dialog"
      aria-label="Configuration panel"
      ref={configMenuRef}
      onWheel={onWheel}
    >
      <button
        type="button"
        className="config-floating-close"
        aria-label="Close configuration"
        onClick={onClose}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      </button>
      <ConfigurationPanel {...configurationPanelProps} />
    </div>
  )
}
