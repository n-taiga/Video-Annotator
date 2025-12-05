import React from 'react'

interface TimelineSectionProps {
  timelineRef: React.RefObject<HTMLDivElement>
  svgRef: React.RefObject<SVGSVGElement>
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
}

export default function TimelineSection({
  timelineRef,
  svgRef,
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
}: TimelineSectionProps) {
  return (
    <div className="timeline" ref={timelineRef}>
      <div className="timeline-svg-wrapper">
        <svg ref={svgRef} />
      </div>
      <div className="timeline-controls">
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
        {/* timeline-actions removed due to moving Add Action under Label */}
        {/* Export controls moved to floating FAB; keeping clean UI here */}
      </div>
    </div>
  )
}
