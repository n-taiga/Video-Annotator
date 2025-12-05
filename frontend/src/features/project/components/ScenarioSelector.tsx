import React from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'

interface ScenarioSelectorProps {
  scenarioId: string
  metadataOptions: string[]
  dropdownOpen: boolean
  setDropdownOpen: Dispatch<SetStateAction<boolean>>
  onClearScenario: () => void
  onSelectScenario: (scenario: string) => void
  scenarioSelectRef: RefObject<HTMLDivElement>
}

export default function ScenarioSelector({
  scenarioId,
  metadataOptions,
  dropdownOpen,
  setDropdownOpen,
  onClearScenario,
  onSelectScenario,
  scenarioSelectRef,
}: ScenarioSelectorProps) {
  return (
    <div style={{ position: 'relative' }} className="video-picker">
      <span>Scenario</span>
      <div className="custom-select custom-select--scenario" ref={scenarioSelectRef}>
        <button
          type="button"
          className="input custom-select-trigger"
          onClick={() => setDropdownOpen(prev => !prev)}
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
        >
          <span className="custom-select-value">{scenarioId || '—'}</span>
          <span className="custom-select-caret">▾</span>
        </button>
        {dropdownOpen && (
          <div className="custom-select-list" role="listbox" onMouseDown={e => e.stopPropagation()}>
            {metadataOptions.length > 0 ? (
              <>
                <button
                  key="__none__"
                  type="button"
                  className={`custom-select-option${scenarioId === '' ? ' is-selected' : ''}`}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => {
                    onClearScenario()
                    setDropdownOpen(false)
                  }}
                >
                  -
                </button>
                {metadataOptions.map(m => (
                  <button
                    key={m}
                    type="button"
                    className={`custom-select-option${m === scenarioId ? ' is-selected' : ''}`}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => {
                      onSelectScenario(m)
                      setDropdownOpen(false)
                    }}
                  >
                    {m}
                  </button>
                ))}
              </>
            ) : (
              <div className="custom-select-empty" style={{ padding: 8 }}>No scenarios</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
