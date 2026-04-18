'use client';

export default function DataTable({ columns, data, onEdit, onDelete }) {
  return (
    <div className="table-container animate-fade">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((row, idx) => (
              <tr key={idx}>
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row) : (row[col.key] != null && row[col.key] !== '' ? row[col.key].toString() : '-')}
                  </td>
                ))}
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {onEdit && (
                        <button className="btn-secondary" onClick={() => onEdit(row)}>
                        Edit
                        </button>
                    )}
                    {onDelete && (
                        <button 
                            style={{ background: 'transparent', border: '1px solid #ff4545', color: '#ff4545', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 'bold' }} 
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 69, 69, 0.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            onClick={() => {
                                if (window.confirm('Are you sure you want to delete this record? WARNING: This will permanently delete all related and dependent data linked to it! Continue?')) {
                                    onDelete(row);
                                }
                            }}
                        >
                        Delete
                        </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
