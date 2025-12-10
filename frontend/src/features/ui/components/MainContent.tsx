import React from 'react'
import type { ComponentProps } from 'react'
import { PreviewPanel, VideoPanel } from '../../video'
import { TimelineSection, ActionTable } from '../../timeline'
import { LabelTimeline } from '../../labels'
import { ShortcutsPanel } from '../../shortcuts'

interface MainContentProps {
  leftPreviewProps: ComponentProps<typeof PreviewPanel>
  rightPreviewProps: ComponentProps<typeof PreviewPanel>
  videoPanelProps: ComponentProps<typeof VideoPanel>
  timelineSectionProps: ComponentProps<typeof TimelineSection>
  labelTimelineProps: ComponentProps<typeof LabelTimeline>
  actionTableProps: ComponentProps<typeof ActionTable>
}

export default function MainContent({
  leftPreviewProps,
  rightPreviewProps,
  videoPanelProps,
  timelineSectionProps,
  labelTimelineProps,
  actionTableProps,
}: MainContentProps) {
  const { startDisplay, endDisplay, lengthDisplay } = timelineSectionProps
  return (
    <div className="main">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="left-col">
          <PreviewPanel {...leftPreviewProps} />
          <PreviewPanel {...rightPreviewProps} />
        </div>

        <div className="timeline-info-wrapper">
          <div className="timeline-info-block">
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
        </div>

        <ShortcutsPanel />
      </div>
      <div className="center-col">
        <VideoPanel {...videoPanelProps} />

        <TimelineSection {...timelineSectionProps} />

        <LabelTimeline {...labelTimelineProps} />

        <ActionTable {...actionTableProps} />
      </div>
    </div>
  )
}
