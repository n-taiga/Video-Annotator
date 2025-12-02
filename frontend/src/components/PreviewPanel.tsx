import React from 'react'

interface PreviewPanelProps {
  title: string
  videoKey: string
  videoRef: React.RefObject<HTMLVideoElement>
  src: string
  timeLabel: string
}

export default function PreviewPanel({ title, videoKey, videoRef, src, timeLabel }: PreviewPanelProps) {
  return (
    <div className="preview-block">
      <div style={{fontSize:12, color:'#94a3b8'}}>{title}</div>
      <div className="video-box">
        <video
          key={videoKey}
          ref={videoRef}
          crossOrigin="anonymous"
          src={src}
          width="100%"
        />
        <div style={{fontSize:12, color:'#94a3b8'}}>{timeLabel}</div>
      </div>
    </div>
  )
}
