import React from 'react'

interface ReferenceVideoOverlayProps {
  scenarioId: string | null
  referenceVideoFiles: string[]
  showReference: boolean
  referenceVisibility: Record<string, boolean>
  pipTop: number
  pipRight: number
  pipWidth: number
  pipHeight: number
  getSourceForFile: (file: string) => string
  swapRefFile: string | null
  videoSource: string
  mainVideoRef: React.RefObject<HTMLVideoElement>
  referenceVideoRefs: React.MutableRefObject<Record<string, HTMLVideoElement | null>>
  startPipDrag: (event: React.PointerEvent<HTMLDivElement>) => void
  setSwapRefFile: React.Dispatch<React.SetStateAction<string | null>>
}

export default function ReferenceVideoOverlay({
  scenarioId,
  referenceVideoFiles,
  showReference,
  referenceVisibility,
  pipTop,
  pipRight,
  pipWidth,
  pipHeight,
  getSourceForFile,
  swapRefFile,
  videoSource,
  mainVideoRef,
  referenceVideoRefs,
  startPipDrag,
  setSwapRefFile
}: ReferenceVideoOverlayProps) {
  if (!scenarioId || referenceVideoFiles.length === 0 || !showReference) return null

  return (
    <>
      {referenceVideoFiles.map((file, idx) => {
        if (!referenceVisibility[file]) return null
        const topPos = pipTop + idx * (pipHeight + 12)
        const fileSrc = getSourceForFile(file)
        const pipSrcFor = swapRefFile === file ? videoSource : fileSrc
        return (
          <div
            key={`ref-overlay-${file}`}
            role="button"
            tabIndex={0}
            style={{
              position: 'fixed',
              top: topPos,
              right: pipRight,
              zIndex: 1300 + idx,
              width: pipWidth,
              height: pipHeight,
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              background: '#000',
              touchAction: 'none'
            }}
          >
            <div
              onPointerDown={startPipDrag}
              aria-hidden="true"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%', cursor: 'grab', zIndex: 1305 }}
            />
            <button
              type="button"
              className="icon-button with-tooltip"
              aria-label="Swap with main"
              data-tooltip="Swap with main video"
              onClick={() => {
                const mv = mainVideoRef.current
                const rv = referenceVideoRefs.current[file]
                if (!mv || !rv) {
                  setSwapRefFile(prev => (prev === file ? null : file))
                  return
                }
                const mainWasPlaying = !mv.paused && !mv.ended
                const refWasPlaying = !rv.paused && !rv.ended
                const mainTime = mv.currentTime
                const refTime = rv.currentTime
                setSwapRefFile(prev => (prev === file ? null : file))
                window.setTimeout(() => {
                  const newMain = mainVideoRef.current
                  const newRef = referenceVideoRefs.current[file]
                  if (!newMain || !newRef) return
                  try { newMain.currentTime = refTime } catch (_e) { }
                  try { newRef.currentTime = mainTime } catch (_e) { }
                  if (mainWasPlaying) newMain.play().catch(() => { })
                  else newMain.pause()
                  if (refWasPlaying) newRef.play().catch(() => { })
                  else newRef.pause()
                }, 120)
              }}
              style={{ position: 'absolute', top: 8, right: 8, zIndex: 1310, width: 36, height: 36 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 16V8a2 2 0 00-2-2h-8" fill="none" stroke="#0b1220" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 8v8a2 2 0 002 2h8" fill="none" stroke="#0b1220" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 8l-4 4 4 4" fill="none" stroke="#0b1220" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M17 16l4-4-4-4" fill="none" stroke="#0b1220" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <video
              key={`ref-video-${file}`}
              ref={el => { referenceVideoRefs.current[file] = el }}
              crossOrigin="anonymous"
              src={pipSrcFor}
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )
      })}
    </>
  )
}
