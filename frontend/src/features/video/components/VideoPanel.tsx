import React from 'react'
import InteractiveLayer from './InteractiveLayer'

interface VideoPanelProps {
  videoKey: string
  videoRef: React.RefObject<HTMLVideoElement>
  /** Optional overlay canvas ref (used to draw masks) */
  overlayRef?: React.RefObject<HTMLCanvasElement>
  /** Called when user clicks the paused video overlay with computed coords */
  onVideoClick?: (data: { time: number; localX: number; localY: number; normX: number; normY: number; videoX?: number; videoY?: number; frameIndex?: number; label: number }) => void
  /** Optional frames-per-second for computing frame index */
  fps?: number
  src: string
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  onVolumeChange: (v: number) => void
  onToggleMute: () => void
  playbackRate: number
  onPlaybackRateChange: (r: number) => void
  onSeekBy?: (delta: number) => void
  // support multiple active labels overlapping the current time
  activeLabels?: string[]
  activeColors?: string[]
  /** Click points to render as interactive buttons (normalized coords 0..1) */
  clickPoints?: Array<{ id: string; normX: number; normY: number; objectId?: number }>
  /** Called when the user requests deletion of a click point */
  onDeletePoint?: (id: string) => void
  /** Color lookup for click points */
  getPointColor?: (objectId: number | null | undefined) => string
  /** Current object id in use */
  activeTrackletId?: number
  /** Cycle to next object id */
  onIncrementTracklet?: () => void
}

export default function VideoPanel({ videoKey, videoRef, overlayRef, src, currentTime, duration, volume, muted, onVolumeChange, onToggleMute, playbackRate, onPlaybackRateChange, onSeekBy, activeLabels, activeColors, clickPoints, onDeletePoint, onVideoClick, fps, getPointColor, activeTrackletId, onIncrementTracklet }: VideoPanelProps) {
  // Single toggle state for play/pause. We listen to the video's play/pause
  // events so the button reflects external changes (e.g. programmatic play).
  const [isPlaying, setIsPlaying] = React.useState(false)
  const formatTime = React.useCallback((value: number) => (Number.isFinite(value) ? value.toFixed(2) : '–'), [])

  React.useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    // initialize state based on current paused property
    try {
      setIsPlaying(!v.paused)
    } catch (_e) {
      // ignore
    }
    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
    }
  }, [videoRef, src])

  const togglePlayPause = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play().catch(() => {})
    } else {
      v.pause()
    }
  }

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
          <div style={{ position: 'relative' }}>
            <video
              key={videoKey}
              ref={videoRef}
              crossOrigin="anonymous"
              src={src}
              width="100%"
              onClick={() => {
                const v = videoRef.current
                if (!v) return
                try {
                  // If the video is currently playing, pause it. Do NOT resume when paused.
                  if (!v.paused) v.pause()
                } catch (_e) {
                  // ignore
                }
              }}
            />
            {/* overlay canvas for masks (pixel buffer size set by caller) */}
            <canvas
              ref={overlayRef}
              className="overlay-canvas"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            />
            {/* interactive layer is implemented in its own file for clarity; only show when paused */}
            {!isPlaying ? <InteractiveLayer videoRef={videoRef} onVideoClick={onVideoClick} fps={fps} /> : null}
            {/* Click-point buttons overlay (pointer events enabled) */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
              {Array.isArray(clickPoints) && clickPoints.map(pt => (
                <button
                  key={pt.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    // Allow click even when interactive layer is present
                    if (typeof onDeletePoint === 'function') onDeletePoint(pt.id)
                  }}
                  title="Remove point"
                  style={{
                    position: 'absolute',
                    left: `${Math.max(0, Math.min(1, pt.normX)) * 100}%`,
                    top: `${Math.max(0, Math.min(1, pt.normY)) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'auto',
                    border: 'none',
                    width: 20,
                    height: 20,
                    borderRadius: 9999,
                    background: getPointColor ? getPointColor(pt.objectId) : 'rgba(255,204,0,0.98)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    cursor: 'pointer'
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </button>
              ))}
              {typeof onIncrementTracklet === 'function' ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    onIncrementTracklet()
                  }}
                  style={{
                    position: 'absolute',
                    left: 12,
                    bottom: 12,
                    pointerEvents: 'auto',
                    border: 'none',
                    borderRadius: 9999,
                    padding: '6px 12px',
                    background: getPointColor ? getPointColor(activeTrackletId) : '#3B82F6',
                    color: '#0B1220',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(15,23,42,0.35)'
                  }}
                >
                  + ID {typeof activeTrackletId === 'number' ? activeTrackletId : ''}
                </button>
              ) : null}
            </div>
          </div>
          <div className="controls">
            {/* 1秒戻し */}
            <button
              className="icon-button"
              aria-label="Rewind 1s"
              title="Rewind 1s"
              onClick={() => {
                if (typeof onSeekBy === 'function') {
                  onSeekBy(-1)
                  return
                }
                const v = videoRef.current
                if (!v) return
                try {
                  const target = Math.max(0, (v.currentTime || 0) - 1)
                  v.currentTime = target
                } catch (_e) {
                  // ignore
                }
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M11 18V6l-8 6 8 6zM21 18V6l-8 6 8 6z" fill="#0b1220" />
              </svg>
            </button>

            {/* Play/Pause toggle */}
            <button
              className="icon-button"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              title={isPlaying ? 'Pause' : 'Play'}
              onClick={togglePlayPause}
            >
              {isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                  <rect x="5" y="4" width="4" height="12" />
                  <rect x="11" y="4" width="4" height="12" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                  <polygon points="6,4 16,10 6,16" />
                </svg>
              )}
            </button>

            {/* 1秒送り */}
            <button
              className="icon-button"
              aria-label="Forward 1s"
              title="Forward 1s"
              onClick={() => {
                if (typeof onSeekBy === 'function') {
                  onSeekBy(1)
                  return
                }
                const v = videoRef.current
                if (!v) return
                try {
                  const maxDuration = Number.isFinite(duration) && duration > 0 ? duration : (v.duration || Infinity)
                  const target = Math.min(maxDuration, (v.currentTime || 0) + 1)
                  v.currentTime = target
                } catch (_e) {
                  // ignore
                }
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M13 6v12l8-6-8-6zM3 6v12l8-6L3 6z" fill="#0b1220" />
              </svg>
            </button>
            <div style={{marginLeft:12}}>Time: {formatTime(currentTime)} / {formatTime(duration)}</div>
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
