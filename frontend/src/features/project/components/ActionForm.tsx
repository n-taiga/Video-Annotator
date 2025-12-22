import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

interface ActionFormProps {
  objectName: string
  setObjectName: Dispatch<SetStateAction<string>>
  objectOptions: string[]
  handleAddObject: (rawName?: string) => Promise<string | null>
  loadingObjectLabels: boolean
  savingObjectLabels: boolean
  environment: string
  setEnvironment: Dispatch<SetStateAction<string>>
  taskLabel: string
  setTaskLabel: Dispatch<SetStateAction<string>>
  showObjectSelector?: boolean
}

export default function ActionForm({
  objectName,
  setObjectName,
  objectOptions,
  handleAddObject,
  loadingObjectLabels,
  savingObjectLabels,
  environment,
  setEnvironment,
  taskLabel,
  setTaskLabel,
  showObjectSelector = true,
}: ActionFormProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [addingNewObject, setAddingNewObject] = useState(false)
  const [newObjectName, setNewObjectName] = useState('')
  const customSelectRef = useRef<HTMLDivElement | null>(null)

  const closeDropdown = useCallback(() => {
    setDropdownOpen(false)
    setAddingNewObject(false)
    setNewObjectName('')
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (customSelectRef.current && !customSelectRef.current.contains(event.target as Node)) {
        closeDropdown()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen, closeDropdown])

  const handleAddNewObject = async (value: string) => {
    const added = await handleAddObject(value)
    if (typeof added === 'string') {
      setNewObjectName('')
      setAddingNewObject(false)
      setDropdownOpen(false)
    }
  }

  return (
    <div className="action-form">
      {showObjectSelector && (
        <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="field-label">Object</label>
          <div style={{ position: 'relative' }}>
            {/* Custom dropdown: shows selected value, opens list on click. Uses outside-click handler to close. */}
            <div className="custom-select custom-select--object" ref={customSelectRef}>
              <button
                type="button"
                className="input custom-select-trigger"
                onClick={() => setDropdownOpen(prev => !prev)}
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
              >
                <span className="custom-select-value">{objectName || '—'}</span>
                <span className="custom-select-caret">▾</span>
              </button>
              {dropdownOpen && (
                <div className="custom-select-list" role="listbox" onMouseDown={e => e.stopPropagation()}>
                  {objectOptions.map(o => (
                    <button
                      key={o}
                      type="button"
                      className={`custom-select-option${o === objectName ? ' is-selected' : ''}`}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={() => {
                        setObjectName(o)
                        closeDropdown()
                      }}
                    >
                      {o}
                    </button>
                  ))}
                  {/* Add row */}
                  {!addingNewObject && (
                    <button
                      type="button"
                      className="custom-select-add"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        setAddingNewObject(true)
                        setDropdownOpen(true)
                      }}
                    >
                      + Add object
                    </button>
                  )}
                  {addingNewObject && (
                    <div className="custom-select-add-row">
                      <input
                        className="input"
                        placeholder="New object"
                        value={newObjectName}
                        onChange={e => setNewObjectName(e.target.value)}
                        onKeyDown={async e => {
                          if (e.key === 'Enter') {
                            const val = newObjectName.trim()
                            if (!val) return
                            await handleAddNewObject(val)
                          } else if (e.key === 'Escape') {
                            setNewObjectName('')
                            setAddingNewObject(false)
                          }
                        }}
                        autoFocus
                        onBlur={() => {
                          setTimeout(() => {
                            if (addingNewObject) return
                            setDropdownOpen(false)
                          }, 120)
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="button"
                          type="button"
                          onClick={async () => {
                            const val = newObjectName.trim()
                            if (!val) return
                            await handleAddNewObject(val)
                          }}
                          disabled={loadingObjectLabels || savingObjectLabels}
                        >Add</button>
                        <button
                          className="button"
                          type="button"
                          onClick={() => {
                            setNewObjectName('')
                            setAddingNewObject(false)
                          }}
                        >Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Environment: free text input */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Environment</span>
        <input className="input" value={environment} onChange={e => setEnvironment(e.target.value)} />
      </label>

      {/* Task: free text input */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Task</span>
        <input className="input" value={taskLabel} onChange={e => setTaskLabel(e.target.value)} />
      </label>
    </div>
  )
}
