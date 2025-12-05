import React from 'react'
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import { ScenarioSelector, VideoSelector } from '../../project'
import { UndoRedoControls } from '../../history'
import type { TimelineHoverInfo } from '../../timeline'

interface AppHeaderProps {
  sideOpen: boolean
  onToggleSideMenu: () => void
  scenarioId: string
  metadataOptions: string[]
  scenarioDropdownOpen: boolean
  setScenarioDropdownOpen: Dispatch<SetStateAction<boolean>>
  onClearScenario: () => void
  onSelectScenario: (scenario: string) => void
  scenarioSelectRef: RefObject<HTMLDivElement>
  videoOptions: string[]
  selectedVideoFile: string
  onSelectVideo: (file: string) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  hoverInfo: TimelineHoverInfo
  hoverTooltipTimerRef: MutableRefObject<number | null>
  onRemoveInteraction: (index: number) => void
  setHoverInfo: Dispatch<SetStateAction<TimelineHoverInfo>>
}

export default function AppHeader({
  sideOpen,
  onToggleSideMenu,
  scenarioId,
  metadataOptions,
  scenarioDropdownOpen,
  setScenarioDropdownOpen,
  onClearScenario,
  onSelectScenario,
  scenarioSelectRef,
  videoOptions,
  selectedVideoFile,
  onSelectVideo,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hoverInfo,
  hoverTooltipTimerRef,
  onRemoveInteraction,
  setHoverInfo,
}: AppHeaderProps) {
  return (
    <div className="header">
      {/* Hamburger (top-left) */}
      <button
        className={`icon-button header-hamburger with-tooltip${sideOpen ? ' is-open' : ''}`}
        aria-label="Toggle menu"
        data-tooltip="Menu"
        onClick={onToggleSideMenu}
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="#0b1220" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="title">📽 Video Annotator</div>
      <div className="header-right">
        <ScenarioSelector
          scenarioId={scenarioId}
          metadataOptions={metadataOptions}
          dropdownOpen={scenarioDropdownOpen}
          setDropdownOpen={setScenarioDropdownOpen}
          onClearScenario={onClearScenario}
          onSelectScenario={onSelectScenario}
          scenarioSelectRef={scenarioSelectRef}
        />
        {videoOptions.length > 0 && (
          <VideoSelector
            videoOptions={videoOptions}
            selectedVideoFile={selectedVideoFile}
            onSelectVideo={onSelectVideo}
            selectClassName="custom-select custom-select--video-header"
          />
        )}
        <UndoRedoControls canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} />
      </div>

      {/* Hover tooltip for bars */}
      {hoverInfo.visible && (
        <div
          className="bar-tooltip"
          style={{ position: 'fixed', top: hoverInfo.y, left: hoverInfo.x, transform: 'translate(-50%, -100%)', zIndex: 1200 }}
          onMouseEnter={() => {
            if (hoverTooltipTimerRef.current !== null) {
              window.clearTimeout(hoverTooltipTimerRef.current)
              hoverTooltipTimerRef.current = null
            }
          }}
          onMouseLeave={() => {
            setHoverInfo(h => ({ ...h, visible: false }))
          }}
        >
          <div className="bar-tooltip-content" style={{ background: 'rgba(24,26,29,0.95)', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
            <span className="bar-tooltip-dot" style={{ width: 10, height: 10, borderRadius: '50%', background: hoverInfo.color }} />
            <span className="bar-tooltip-label" style={{ fontSize: 12, fontWeight: 600, color: '#e6eef8' }}>{hoverInfo.label}</span>
            {hoverInfo.index !== null && (
              <button
                className="button"
                onClick={() => {
                  if (hoverInfo.index === null) return
                  onRemoveInteraction(hoverInfo.index)
                  setHoverInfo(h => ({ ...h, visible: false }))
                }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
