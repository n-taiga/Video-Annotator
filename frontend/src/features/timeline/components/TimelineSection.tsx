import React from 'react'
import type { ComponentProps } from 'react'
import WaveformTimeline from './WaveformTimeline'
import TrackletOverlay from './TrackletOverlay'

interface TimelineSectionProps {
  timelineRef: React.RefObject<HTMLDivElement>
  svgRef: React.RefObject<SVGSVGElement>
  xScaleRef?: React.MutableRefObject<any | null>
  clickPoints?: Array<Record<string, unknown>>
  fps?: number
  seekVideo?: (time: number) => void
  activeSegmentKeys?: string[]
  onSegmentToggle?: (segmentKey: string) => void
  startDisplay: string
  endDisplay: string
  lengthDisplay: string
  actions: string[]
  selectedAction: string
  onSelectedActionChange: (value: string) => void
  contact: boolean
  onContactChange: (value: boolean) => void
  onAddInteraction: () => void
  onExport: () => void | Promise<void>
  saveStatus: { status: 'idle' | 'saving' | 'success' | 'error'; message?: string }
  waveformProps?: ComponentProps<typeof WaveformTimeline>
}

export default function TimelineSection({
  timelineRef,
  svgRef,
  xScaleRef,
  clickPoints,
  fps,
  seekVideo,
  activeSegmentKeys,
  onSegmentToggle,
  startDisplay,
  endDisplay,
  lengthDisplay,
  actions,
  selectedAction,
  onSelectedActionChange,
  contact,
  onContactChange,
  onAddInteraction,
  onExport,
  saveStatus,
  waveformProps,
}: TimelineSectionProps) {
  return (
    <div className="timeline" ref={timelineRef}>
      <div className="timeline-stack">
        {/* Overlay renders tracklet bars and click points above the waveform/svg stack */}
        <TrackletOverlay
          timelineRef={timelineRef}
          xScaleRef={xScaleRef ?? null}
          clickPoints={clickPoints}
          fps={fps}
          baseHeight={120}
          onSeek={seekVideo}
          activeSegmentKeys={activeSegmentKeys}
          onSegmentToggle={onSegmentToggle}
        />
        {waveformProps && (
          <div className="timeline-waveform">
            <WaveformTimeline {...waveformProps} />
          </div>
        )}
        <div className="timeline-svg-wrapper">
          <svg ref={svgRef} />
        </div>
      </div>
      <div className="timeline-controls">
        {/*
        <div className="timeline-info">
          <div className="info-box">
            <span className="info-label">Start</span>
            <span className="info-value">{startDisplay}</span>
          </div>
          <div className="info-box">
            <span className="info-label">End</span>
            <span className="info-value">{endDisplay}</span>
          </div>
          <div className="info-box">
            <span className="info-label">Length</span>
            <span className="info-value">{lengthDisplay}</span>
          </div>
        </div>
        */}
        {/*
        <div className="timeline-form">
          <label className="timeline-field">
            <span className="timeline-field-label">Label</span>
            <select value={selectedAction} onChange={e => onSelectedActionChange(e.target.value)}>
              {actions.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <div className="timeline-add-under-label">
              <button className="button" onClick={onAddInteraction}>
                Add Action
              </button>
            </div>
          </label>
          <label className="timeline-toggle">
            <span className="timeline-toggle-label">Contact</span>
            <input
              className="toggle-checkbox"
              type="checkbox"
              checked={contact}
              onChange={e => onContactChange(e.target.checked)}
            />
            <span className="toggle-slider" aria-hidden="true"></span>
          </label>
        </div>
        */}
        {/* timeline-actions removed due to moving Add Action under Label */}
        {/* Export controls moved to floating FAB; keeping clean UI here */}
      </div>
    </div>
  )
}
