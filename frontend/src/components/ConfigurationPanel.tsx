import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ColorResult } from 'react-color'
import { ChromePicker } from 'react-color'
import type { LabelColorMap } from '../utils/colors'

interface ConfigurationPanelProps {
  actions: string[]
  labelColors: LabelColorMap
  onRemoveAction: (actionName: string) => void
  onChangeColor: (actionName: string, color: string) => void
  onAddAction: () => Promise<string | null> | string | null
  onRenameAction: (previousName: string, nextName: string) => Promise<boolean> | boolean
  loading: boolean
  saving: boolean
  error: string | null
  onRetry: () => void
}

export default function ConfigurationPanel({ actions, labelColors, onRemoveAction, onChangeColor, onAddAction, onRenameAction, loading, saving, error, onRetry }: ConfigurationPanelProps) {
  const disableRemove = saving || loading || actions.length <= 1
  const disableColorPicker = loading
  const [adding, setAdding] = useState(false)
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [renamePending, setRenamePending] = useState(false)
  const [draftColors, setDraftColors] = useState<Record<string, string>>({})
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const fallbackColor = '#94A3B8'

  const closeColorPicker = useCallback(() => {
    setActiveLabel(null)
    setPopoverPosition(null)
  }, [])

  const normalizeHexColor = useCallback((value?: string): string => {
    if (!value) return fallbackColor
    const trimmed = value.trim()
    if (!trimmed) return fallbackColor
    const hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      const expanded = `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      return `#${expanded.toUpperCase()}`
    }
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return `#${hex.toUpperCase()}`
    }
    return fallbackColor
  }, [])

  const ensureDraftColor = useCallback((label: string) => {
    const latest = normalizeHexColor(labelColors[label])
    setDraftColors(prev => {
      if (prev[label] === latest) return prev
      return { ...prev, [label]: latest }
    })
  }, [labelColors, normalizeHexColor])

  // Close the color picker when Escape is pressed.
  useEffect(() => {
    if (!activeLabel) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeColorPicker()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeLabel, closeColorPicker])

  // Reset popovers whenever the picker is disabled (e.g. during loading).
  useEffect(() => {
    if (disableColorPicker) {
      closeColorPicker()
    }
  }, [disableColorPicker, closeColorPicker])

  useEffect(() => {
    if (!activeLabel) return
    ensureDraftColor(activeLabel)
  }, [activeLabel, ensureDraftColor])

  useEffect(() => {
    if (!editingLabel) return
    if (!actions.includes(editingLabel)) {
      setEditingLabel(null)
      setEditingValue('')
      setRenamePending(false)
    }
  }, [actions, editingLabel])

  useEffect(() => {
    if (!editingLabel) return
    const node = nameInputRef.current
    if (!node) return
    node.focus()
    node.select()
  }, [editingLabel])

  useEffect(() => {
    setDraftColors(prev => {
      const next = { ...prev }
      let mutated = false
      Object.keys(next).forEach(label => {
        if (!actions.includes(label)) {
          delete next[label]
          mutated = true
        }
      })
      return mutated ? next : prev
    })
  }, [actions])

  useEffect(() => {
    if (activeLabel && !actions.includes(activeLabel)) {
      closeColorPicker()
    }
  }, [actions, activeLabel, closeColorPicker])

  const pickerStyles = useMemo(() => ({
    default: {
      picker: {
        background: '#0f172a',
        boxShadow: '0 18px 36px rgba(15, 23, 42, 0.48)',
        padding: '14px',
        borderRadius: '14px',
        width: '220px',
        color: '#e2e8f0',
        border: '1px solid rgba(148, 163, 184, 0.25)'
      },
      body: {
        padding: '0'
      },
      saturation: {
        borderRadius: '10px'
      },
      saturationPointer: {
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        border: '2px solid #0f172a',
        boxShadow: '0 0 0 3px rgba(148, 163, 184, 0.35)'
      },
      hue: {
        borderRadius: '5px'
      },
      huePointer: {
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        border: '2px solid #0f172a',
        boxShadow: '0 0 0 2px rgba(148, 163, 184, 0.35)',
        transform: 'translate(-2px, -2px)'
      },
      controls: {
        marginTop: '12px'
      }
    }
  }), [])

  const handleOpenPicker = (label: string) => {
    if (disableColorPicker) return
    if (activeLabel === label) {
      closeColorPicker()
      return
    }
    ensureDraftColor(label)
    setPopoverPosition(null)
    setActiveLabel(label)
  }

  const handleColorPreviewChange = (label: string, result: ColorResult) => {
    const hex = typeof result?.hex === 'string' ? result.hex : ''
    const normalized = normalizeHexColor(hex)
    setDraftColors(prev => (prev[label] === normalized ? prev : { ...prev, [label]: normalized }))
  }

  const handleColorChangeComplete = (label: string, result: ColorResult) => {
    const hex = typeof result?.hex === 'string' ? result.hex : ''
    const normalized = normalizeHexColor(hex)
    setDraftColors(prev => (prev[label] === normalized ? prev : { ...prev, [label]: normalized }))
    onChangeColor(label, normalized)
  }

  const activeSafeColor = activeLabel
    ? normalizeHexColor(draftColors[activeLabel] ?? labelColors[activeLabel] ?? fallbackColor)
    : fallbackColor

  useLayoutEffect(() => {
    if (!activeLabel) return
    const updatePosition = () => {
      const trigger = triggerRefs.current[activeLabel]
      const popover = popoverRef.current
      if (!trigger || !popover) return
      const triggerRect = trigger.getBoundingClientRect()
      const popRect = popover.getBoundingClientRect()
      const spacing = 12
      let top = triggerRect.bottom + spacing
      if (top + popRect.height > window.innerHeight - spacing) {
        top = triggerRect.top - spacing - popRect.height
        if (top < spacing) {
          top = Math.max(spacing, window.innerHeight - popRect.height - spacing)
        }
      }
      let left = triggerRect.left
      if (left + popRect.width > window.innerWidth - spacing) {
        left = window.innerWidth - popRect.width - spacing
      }
      if (left < spacing) left = spacing
      setPopoverPosition(prev => {
        if (prev && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.left - left) < 0.5) {
          return prev
        }
        return { top, left }
      })
    }
    const frame = window.requestAnimationFrame(updatePosition)
    const handle = () => updatePosition()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [activeLabel])

  const popoverStyle = popoverPosition
    ? { top: popoverPosition.top, left: popoverPosition.left, visibility: 'visible' as const, pointerEvents: 'auto' as const }
    : { top: 0, left: 0, visibility: 'hidden' as const, pointerEvents: 'none' as const }

  const handleStartEditing = (label: string) => {
    if (loading || saving || renamePending) return
    setEditingLabel(label)
    setEditingValue(label)
  }

  const cancelRename = () => {
    setEditingLabel(null)
    setEditingValue('')
    setRenamePending(false)
  }

  const submitRename = useCallback(async () => {
    if (!editingLabel) return
    const currentLabel = editingLabel
    const trimmed = editingValue.trim()
    if (!trimmed) {
      setEditingValue(currentLabel)
      return
    }
    if (trimmed === currentLabel) {
      setEditingLabel(null)
      setEditingValue('')
      return
    }
    if (renamePending) return
    setRenamePending(true)
    let success = false
    try {
      const outcome = await onRenameAction(currentLabel, trimmed)
      success = outcome !== false
    } catch (err) {
      console.error('Failed to rename action label', err)
    } finally {
      setRenamePending(false)
    }
    if (!success) return
    setDraftColors(prev => {
      if (!Object.prototype.hasOwnProperty.call(prev, currentLabel)) return prev
      const next = { ...prev }
      const color = next[currentLabel]
      delete next[currentLabel]
      next[trimmed] = color
      return next
    })
    setActiveLabel(prev => (prev === currentLabel ? trimmed : prev))
    setEditingLabel(null)
    setEditingValue('')
  }, [editingLabel, editingValue, onRenameAction, renamePending])

  const handleAddClick = async () => {
    if (loading || saving || adding) return
    setAdding(true)
    try {
      const result = await onAddAction()
      if (typeof result === 'string' && result) {
        setEditingLabel(result)
        setEditingValue(result)
      }
    } catch (err) {
      console.error('Failed to add action label', err)
    } finally {
      setAdding(false)
    }
  }

  return (
    <>
      <div className="config-screen">
        <div className="config-header">
          <h2>Configuration</h2>
          <p className="config-subtitle">Adjust reference data used during annotation.</p>
        </div>

        {error && (
          <div className="config-banner config-banner-error">
            <span>{error}</span>
            <button type="button" className="config-banner-button" onClick={onRetry} disabled={loading || saving}>
              Retry
            </button>
          </div>
        )}

        <section className="config-section config-section-scrollable">
          <header className="config-section-header">
            <div className="config-section-header-row">
              <div className="config-section-header-copy">
                <h3>Action Labels</h3>
                <p>All available labels and their assigned colors.</p>
              </div>
              <button
                type="button"
                className="config-add-button"
                onClick={handleAddClick}
                disabled={loading || saving || adding}
                aria-label="Add action label"
                title="Add a new action label"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
            {saving && <span className="config-section-status">Saving…</span>}
          </header>
          {loading ? (
            <div className="config-empty">Loading action labels…</div>
          ) : actions.length === 0 ? (
            <div className="config-empty">No labels are currently defined.</div>
          ) : (
            <div className="config-table-wrapper">
              <table className="config-action-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Color</th>
                    <th scope="col" className="config-col-operation">Operation</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map(action => {
                    const liveColor = labelColors[action] ?? fallbackColor
                    const draftColor = draftColors[action] ?? liveColor
                    const safeColor = normalizeHexColor(draftColor)
                    const colorDisplay = safeColor
                    const isActive = activeLabel === action
                    return (
                      <tr key={action}>
                        <td className="config-col-name">
                            {editingLabel === action ? (
                              <input
                                ref={nameInputRef}
                                className="config-label-input"
                                value={editingValue}
                                onChange={event => setEditingValue(event.target.value)}
                                onBlur={() => {
                                  void submitRename()
                                }}
                                onKeyDown={event => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault()
                                    void submitRename()
                                  } else if (event.key === 'Escape') {
                                    event.preventDefault()
                                    cancelRename()
                                  }
                                }}
                                disabled={renamePending}
                              />
                            ) : (
                              <button
                                type="button"
                                className="config-label-name-button"
                                onClick={() => handleStartEditing(action)}
                                disabled={loading || saving}
                                title="Rename label"
                              >
                                {action}
                              </button>
                            )}
                          </td>
                        <td className="config-col-color">
                          <div className="config-color-cell">
                            <button
                              type="button"
                              className={`config-color-trigger${isActive ? ' is-active' : ''}${disableColorPicker ? ' is-disabled' : ''}`}
                              aria-label={`Change color for ${action}`}
                              title="Change color"
                              onClick={() => handleOpenPicker(action)}
                              disabled={disableColorPicker}
                              ref={node => {
                                if (node) {
                                  triggerRefs.current[action] = node
                                } else {
                                  delete triggerRefs.current[action]
                                }
                              }}
                            >
                              <span className="config-color-swatch" style={{ backgroundColor: safeColor }} aria-hidden="true" />
                            </button>
                            <span className="config-color-chip" style={{ borderColor: safeColor }}>
                              {colorDisplay}
                            </span>
                          </div>
                        </td>
                        <td className="config-col-operation">
                          <button
                            type="button"
                            className="config-icon-button"
                            aria-label={`Remove ${action}`}
                            onClick={() => onRemoveAction(action)}
                            disabled={disableRemove}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    {activeLabel &&
      createPortal(
        <>
          <div className="config-color-picker-backdrop" onClick={closeColorPicker} />
          <div
            ref={popoverRef}
            className="config-color-picker-popover"
            role="dialog"
            aria-label={`Color picker for ${activeLabel}`}
            style={popoverStyle}
            onClick={event => event.stopPropagation()}
          >
            <ChromePicker
              color={activeSafeColor}
              onChange={(result: ColorResult) => handleColorPreviewChange(activeLabel, result)}
              onChangeComplete={(result: ColorResult) => handleColorChangeComplete(activeLabel, result)}
              disableAlpha
              styles={pickerStyles}
            />
          </div>
        </>,
        document.body
      )}
    </>
  )
}
