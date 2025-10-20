import React from 'react'

interface Interaction {
  action_label: string
  start_time: number
  end_time: number
  contact: boolean
}

interface ActionTableProps {
  interactions: Interaction[]
  onRemove: (index: number) => void
}

export default function ActionTable({ interactions, onRemove }: ActionTableProps) {
  return (
    <div className="action-list">
      <table className="action-table">
        <thead className="action-table-head">
          <tr>
            <th>Label</th>
            <th>Start</th>
            <th>End</th>
            <th>Contact</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {interactions.map((it, idx)=> (
            <tr key={idx} className="action-table-row">
              <td>{it.action_label}</td>
              <td>{it.start_time.toFixed(3)}</td>
              <td>{it.end_time.toFixed(3)}</td>
              <td>{it.contact? 'true':'false'}</td>
              <td><button className="button" onClick={()=>onRemove(idx)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
