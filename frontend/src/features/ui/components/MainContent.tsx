import React from 'react'
import type { ComponentProps } from 'react'
import { PreviewPanel, VideoPanel } from '../../video'
import { TimelineSection, WaveformTimeline, ActionTable } from '../../timeline'
import { LabelTimeline } from '../../labels'
import { ShortcutsPanel } from '../../shortcuts'

interface MainContentProps {
  leftPreviewProps: ComponentProps<typeof PreviewPanel>
  rightPreviewProps: ComponentProps<typeof PreviewPanel>
  videoPanelProps: ComponentProps<typeof VideoPanel>
  timelineSectionProps: ComponentProps<typeof TimelineSection>
  waveformTimelineProps: ComponentProps<typeof WaveformTimeline>
  labelTimelineProps: ComponentProps<typeof LabelTimeline>
  actionTableProps: ComponentProps<typeof ActionTable>
}

export default function MainContent({
  leftPreviewProps,
  rightPreviewProps,
  videoPanelProps,
  timelineSectionProps,
  waveformTimelineProps,
  labelTimelineProps,
  actionTableProps,
}: MainContentProps) {
  return (
    <div className="main">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="left-col">
          <PreviewPanel {...leftPreviewProps} />
          <PreviewPanel {...rightPreviewProps} />
        </div>

        <ShortcutsPanel />
      </div>
      <div className="center-col">
        <VideoPanel {...videoPanelProps} />

        <TimelineSection {...timelineSectionProps} />

        <div className="waveform-block">
          <WaveformTimeline {...waveformTimelineProps} />
        </div>

        <LabelTimeline {...labelTimelineProps} />

        <ActionTable {...actionTableProps} />
      </div>
    </div>
  )
}
