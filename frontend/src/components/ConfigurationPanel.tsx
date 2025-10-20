import React from 'react'
import type { LabelColorMap } from '../utils/colors'

interface ConfigurationPanelProps {
  actions: string[]
  labelColors: LabelColorMap
  onRemoveAction: (actionName: string) => void
}

export default function ConfigurationPanel({ actions, labelColors, onRemoveAction }: ConfigurationPanelProps) {
  return (
    <div className="config-screen">
      <div className="config-header">
        <h2>Configuration</h2>
        <p className="config-subtitle">Adjust reference data used during annotation.</p>
      </div>

      <section className="config-section config-section-scrollable">
        <header className="config-section-header">
          <h3>Action Labels</h3>
          <p>All available labels and their assigned colors.</p>
        </header>
        {actions.length === 0 ? (
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
                  const color = labelColors[action] ?? '#94a3b8'
                  const colorDisplay = color.startsWith('#') ? color.toUpperCase() : color
                  return (
                    <tr key={action}>
                      <td className="config-col-name">{action}</td>
                      <td className="config-col-color">
                        <div className="config-color-cell">
                          <span className="config-color-swatch" style={{ backgroundColor: color }} aria-hidden="true" />
                          <span className="config-color-chip" style={{ borderColor: color, color }}>{colorDisplay}</span>
                        </div>
                      </td>
                      <td className="config-col-operation">
                        <button
                          type="button"
                          className="config-icon-button"
                          aria-label={`Remove ${action}`}
                          onClick={() => onRemoveAction(action)}
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
  )
}
