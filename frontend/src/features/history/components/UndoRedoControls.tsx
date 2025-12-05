import React from 'react'

interface UndoRedoControlsProps {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

export default function UndoRedoControls({ canUndo, canRedo, onUndo, onRedo }: UndoRedoControlsProps) {
  return (
    <>
      <button
        className="icon-button with-tooltip"
        aria-label="Undo"
        data-tooltip="Undo (Ctrl/Cmd+Z)"
        onClick={onUndo}
        disabled={!canUndo}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5H7l3-3M7 5l3 3M7 5h5a7 7 0 110 14h-2" fill="none" stroke="#0b1220" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        className="icon-button with-tooltip"
        aria-label="Redo"
        data-tooltip="Redo (Ctrl/Cmd+Shift+Z / Ctrl+Y)"
        onClick={onRedo}
        disabled={!canRedo}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5h5l-3-3M17 5l-3 3M17 5h-5a7 7 0 100 14h2" fill="none" stroke="#0b1220" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </>
  )
}
