import React from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { VideoSelector } from '../../project'

export type SidePanelScreen = 'annotation' | 'configuration'

interface SidePanelProps {
  activeScreen: SidePanelScreen
  onSwitchScreen: (screen: SidePanelScreen) => void
  videoOptions: string[]
  selectedVideoFile: string
  onSelectVideo: (file: string) => void
  scenarioId: string
  referenceVideoFiles: string[]
  durationPrimary: string
  durationSecondary?: string
  resolutionDisplay: string
  fpsDisplayPrimary: string
  fpsDisplaySecondary?: string
  labelCount: number
  interactionCount: number
  showReference: boolean
  setShowReference: Dispatch<SetStateAction<boolean>>
  referenceVisibility: Record<string, boolean>
  setReferenceVisibility: Dispatch<SetStateAction<Record<string, boolean>>>
}

export default function SidePanel({
  activeScreen,
  onSwitchScreen,
  videoOptions,
  selectedVideoFile,
  onSelectVideo,
  scenarioId,
  referenceVideoFiles,
  durationPrimary,
  durationSecondary,
  resolutionDisplay,
  fpsDisplayPrimary,
  fpsDisplaySecondary,
  labelCount,
  interactionCount,
  showReference,
  setShowReference,
  referenceVisibility,
  setReferenceVisibility,
}: SidePanelProps) {
  return (
    <div className="side-menu-stack">
      <div className="side-menu-nav">
        <button
          type="button"
          aria-pressed={activeScreen === 'annotation'}
          className={`menu-switch-button${activeScreen === 'annotation' ? ' active' : ''}`}
          onClick={() => onSwitchScreen('annotation')}
        >
          <span className="menu-switch-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
              <path d="M8 9l2 2-2 2" />
              <path d="M12 13h4" />
            </svg>
          </span>
          <span className="menu-switch-text">Annotation</span>
        </button>
        <button
          type="button"
          aria-pressed={activeScreen === 'configuration'}
          className={`menu-switch-button${activeScreen === 'configuration' ? ' active' : ''}`}
          onClick={() => onSwitchScreen('configuration')}
        >
          <span className="menu-switch-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </span>
          <span className="menu-switch-text">Configuration</span>
        </button>
      </div>

      {videoOptions.length > 0 && (
        <VideoSelector
          videoOptions={videoOptions}
          selectedVideoFile={selectedVideoFile}
          onSelectVideo={onSelectVideo}
          selectClassName="custom-select custom-select--video-side"
        />
      )}

      <div className="side-menu-section">
        <div className="side-menu-section-title">Current Video</div>
        <dl className="side-menu-meta-grid">
          <div className="side-menu-meta-row">
            <dt className="side-menu-meta-label">Filename</dt>
            <dd className="side-menu-meta-value">{selectedVideoFile || '–'}</dd>
          </div>
          {scenarioId && referenceVideoFiles.length > 0 && (
            <div className="side-menu-meta-row">
              <dt className="side-menu-meta-label">Reference</dt>
              <dd className="side-menu-meta-value">
                {referenceVideoFiles.length === 1 ? referenceVideoFiles[0] : `${referenceVideoFiles.length} files`}
              </dd>
            </div>
          )}
          <div className="side-menu-meta-row">
            <dt className="side-menu-meta-label">Duration</dt>
            <dd className="side-menu-meta-value">
              {durationPrimary}
              {durationSecondary && (
                <span className="side-menu-meta-secondary">{durationSecondary}</span>
              )}
            </dd>
          </div>
          <div className="side-menu-meta-row">
            <dt className="side-menu-meta-label">Resolution</dt>
            <dd className="side-menu-meta-value">{resolutionDisplay}</dd>
          </div>
          <div className="side-menu-meta-row">
            <dt className="side-menu-meta-label">FPS</dt>
            <dd className="side-menu-meta-value">
              {fpsDisplayPrimary}
              {fpsDisplaySecondary && (
                <span className="side-menu-meta-secondary">{fpsDisplaySecondary}</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <div className="side-menu-section">
        <div className="side-menu-section-title">Annotation</div>
        <dl className="side-menu-meta-grid">
          <div className="side-menu-meta-row">
            <dt className="side-menu-meta-label">Labels</dt>
            <dd className="side-menu-meta-value">{labelCount}</dd>
          </div>
          <div className="side-menu-meta-row">
            <dt className="side-menu-meta-label">Interactions</dt>
            <dd className="side-menu-meta-value">{interactionCount}</dd>
          </div>
        </dl>
      </div>

      {scenarioId && referenceVideoFiles.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <label className="timeline-toggle side-toggle" style={{ margin: 0 }}>
            <span className="timeline-toggle-label">Show Reference</span>
            <>
              <input
                className="toggle-checkbox"
                type="checkbox"
                checked={showReference}
                onChange={e => {
                  const checked = e.target.checked
                  setShowReference(checked)
                  setReferenceVisibility(prev => {
                    const next: Record<string, boolean> = { ...prev }
                    referenceVideoFiles.forEach(f => {
                      next[f] = checked
                    })
                    return next
                  })
                }}
                aria-label="Show reference videos"
              />
              <span className="toggle-slider" aria-hidden="true" />
            </>
          </label>

          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {referenceVideoFiles.map(file => (
              <label key={`ref-toggle-${file}`} className="timeline-toggle side-toggle" style={{ margin: 0 }}>
                <span className="timeline-toggle-label" title={file}>{String(file).split('/').pop()}</span>
                <>
                  <input
                    className="toggle-checkbox"
                    type="checkbox"
                    checked={Boolean(referenceVisibility[file])}
                    onChange={e => setReferenceVisibility(prev => ({ ...prev, [file]: e.target.checked }))}
                    aria-label={`Show reference ${file}`}
                  />
                  <span className="toggle-slider" aria-hidden="true" />
                </>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
