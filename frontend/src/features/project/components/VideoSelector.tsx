import React, { useState } from 'react'

interface VideoSelectorProps {
  videoOptions: string[]
  selectedVideoFile: string
  onSelectVideo: (file: string) => void
  selectClassName: string
}

export default function VideoSelector({
  videoOptions,
  selectedVideoFile,
  onSelectVideo,
  selectClassName,
}: VideoSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }} className="video-picker">
      <span>Video</span>
      <div className={selectClassName}>
        <button
          type="button"
          className="input custom-select-trigger"
          onClick={() => setDropdownOpen(prev => !prev)}
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
        >
          <span className="custom-select-value">{selectedVideoFile ? String(selectedVideoFile).split('/').pop() : '—'}</span>
          <span className="custom-select-caret">▾</span>
        </button>
        {dropdownOpen && (
          <div className="custom-select-list" role="listbox" onMouseDown={e => e.stopPropagation()}>
            {videoOptions.map(file => (
              <button
                key={file}
                type="button"
                className={`custom-select-option${file === selectedVideoFile ? ' is-selected' : ''}`}
                onMouseDown={e => e.stopPropagation()}
                onClick={() => {
                  onSelectVideo(file)
                  setDropdownOpen(false)
                }}
              >
                {String(file).split('/').pop()}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
