import React from 'react'
import type { SaveStatus } from '../types'

interface SaveControlsProps {
  saveStatus: SaveStatus
  onSave: () => void
}

export default function SaveControls({ saveStatus, onSave }: SaveControlsProps) {
  return (
    <div className="fab-export-left">
      <button
        className="button"
        onClick={onSave}
        disabled={saveStatus.status === 'saving'}
        style={{ fontWeight: 'bold', fontSize: '16px' }}
      >
        {saveStatus.status === 'saving' ? 'Saving…' : 'Save JSON'}
      </button>
      {saveStatus.status !== 'idle' && (
        <span
          className={`fab-save-status save-status-${saveStatus.status} ${saveStatus.status === 'success' || saveStatus.status === 'error' ? 'fade-auto-hide' : ''}`}
        >
          {saveStatus.status === 'saving'
            ? 'Saving…'
            : saveStatus.message ?? (saveStatus.status === 'success' ? 'Saved successfully.' : 'Failed to save annotation.')}
        </span>
      )}
    </div>
  )
}
