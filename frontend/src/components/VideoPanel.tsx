import React from 'react'

interface VideoPanelProps {
  videoKey: string
  videoRef: React.RefObject<HTMLVideoElement>
  src: string
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  onVolumeChange: (v: number) => void
  onToggleMute: () => void
  playbackRate: number
  onPlaybackRateChange: (r: number) => void
  // support multiple active labels overlapping the current time
  activeLabels?: string[]
  activeColors?: string[]
}

export default function VideoPanel({ videoKey, videoRef, src, currentTime, duration, volume, muted, onVolumeChange, onToggleMute, playbackRate, onPlaybackRateChange, activeLabels, activeColors }: VideoPanelProps) {
  const handlePlay = () => videoRef.current?.play()
  const handlePause = () => videoRef.current?.pause()

  return (
    <div className="video-pair">
      <div style={{flex:1}}>
        <div className="main-video">
          {activeLabels && activeLabels.length > 0 ? (
            <div className="video-active-labels">
              {activeLabels.map((label: string, idx: number) => (
                <div key={`${label}-${idx}`} className="video-active-label">
                  <span className="video-active-label-swatch" style={{ backgroundColor: (activeColors && activeColors[idx]) ?? '#94A3B8' }} aria-hidden="true" />
                  <span className="video-active-label-text">{label}</span>
                </div>
              ))}
            </div>
          ) : null}
          <video
            key={videoKey}
            ref={videoRef}
            src={src}
            width="100%"
          />
          <div className="controls">
            <button
              className="icon-button"
              aria-label="Play"
              onClick={handlePlay}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <polygon points="6,4 16,10 6,16" />
              </svg>
            </button>
            <button
              className="icon-button"
              aria-label="Pause"
              onClick={handlePause}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <rect x="5" y="4" width="4" height="12" />
                <rect x="11" y="4" width="4" height="12" />
              </svg>
            </button>
            <div style={{marginLeft:12}}>Time: {currentTime.toFixed(2)} / {duration.toFixed(2)}</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Speed selector on the left */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
                <span>Speed</span>
                <select
                  value={playbackRate}
                  onChange={e => onPlaybackRateChange(Number(e.target.value))}
                  aria-label="Playback speed"
                  className="input"
                  style={{ width: 84, padding: '4px 6px' }}
                >
                  <option value={0.25}>0.25×</option>
                  <option value={0.5}>0.5×</option>
                  <option value={0.75}>0.75×</option>
                  <option value={1}>1×</option>
                  <option value={1.25}>1.25×</option>
                  <option value={1.5}>1.5×</option>
                  <option value={1.75}>1.75×</option>
                  <option value={2}>2×</option>
                </select>
              </label>
              <div style={{ width: 1, height: 20, background: 'rgba(148,163,184,0.25)', margin: '0 6px' }} />
              {/* Volume controls on the right */}
              <button
                className="icon-button"
                aria-label={muted ? 'Unmute' : 'Mute'}
                title={muted ? 'Unmute' : 'Mute'}
                onClick={onToggleMute}
              >
                {muted ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M3 8h3l4-3v10l-4-3H3z" fill="#0b1220" />
                    <path d="M13 7l4 4M17 7l-4 4" stroke="#0b1220" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M3 8h3l4-3v10l-4-3H3z" fill="#0b1220" />
                    <path d="M12 7c1 .7 1.7 1.6 1.7 3s-.7 2.3-1.7 3" stroke="#0b1220" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              <input
                className="volume-slider"
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                aria-label="Volume"
                onChange={e => {
                  const val = Number((e.target as HTMLInputElement).value)
                  if (Number.isFinite(val)) onVolumeChange(Math.max(0, Math.min(100, val)) / 100)
                }}
              />
              <span className="volume-label" aria-hidden="true">{Math.round(volume * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
