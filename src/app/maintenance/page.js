'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';

export default function MaintenancePage() {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    id: '', aircraft_id: '', type: '', notes: '', status: 'Scheduled',
    scheduled_date: '', start_date: '', completion_date: '', total_cost: ''
  });

  const columns = [
    { key: 'maintenance_id', label: 'ID' },
    { key: 'aircraft_id', label: 'Aircraft' },
    { key: 'maintenance_type', label: 'Type' },
    { key: 'maintenance_status', label: 'Status' },
    { key: 'scheduled_date', label: 'Date' },
  ];

  const fetchRecords = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/maintenance');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setRecords(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setFormData({
      id: record.maintenance_id,
      aircraft_id: record.aircraft_id,
      type: record.maintenance_type,
      notes: record.technician_notes,
      status: record.maintenance_status,
      scheduled_date: record.scheduled_date?.split('T')[0] || '',
      start_date: record.actual_start_date?.split('T')[0] || '',
      completion_date: record.completion_date?.split('T')[0] || '',
      total_cost: record.total_cost || ''
    });
  };

  
  const handleDelete = async (row) => {
    try {
      const res = await fetch(`/api/maintenance?id=${row.maintenance_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');
      fetchRecords();
    } catch (err) {
      if (typeof setError === 'function') setError(err.message);
      else alert("Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const method = editingRecord ? 'PUT' : 'POST';
      const res = await fetch('/api/maintenance', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      setFormData({ id: '', aircraft_id: '', type: '', notes: '', status: 'Scheduled', scheduled_date: '', start_date: '', completion_date: '', total_cost: '' });
      setEditingRecord(null);
      fetchRecords();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="animate-fade">
      <h1>Maintenance Management</h1>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>{editingRecord ? 'Update Record' : 'Add New Record'}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group"><label>Maint. ID</label><input type="number" name="id" value={formData.id} onChange={handleInputChange} required disabled={!!editingRecord} /></div>
          <div className="form-group"><label>Aircraft ID</label><input type="number" name="aircraft_id" value={formData.aircraft_id} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Type</label><input type="text" name="type" value={formData.type} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Status</label><select name="status" value={formData.status} onChange={handleInputChange}><option value="Scheduled">Scheduled</option><option value="In Progress">In Progress</option><option value="Completed">Completed</option></select></div>
          <div className="form-group"><label>Sched. Date</label><input type="date" name="scheduled_date" value={formData.scheduled_date} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Cost</label><input type="number" name="total_cost" value={formData.total_cost} onChange={handleInputChange} /></div>
          <div style={{ gridColumn: 'span 3' }}><label>Notes</label><textarea name="notes" value={formData.notes} onChange={handleInputChange} style={{ width: '100%', minHeight: '80px', marginTop: '0.5rem' }} /></div>
          <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem' }}>
            <button type="submit">{editingRecord ? 'Update' : 'Set Data'}</button>
            {editingRecord && <button type="button" className="btn-secondary" onClick={() => { setEditingRecord(null); setFormData({ id: '', aircraft_id: '', type: '', notes: '', status: 'Scheduled', scheduled_date: '', start_date: '', completion_date: '', total_cost: '' }); }}>Cancel</button>}
          </div>
          {error && <div style={{ gridColumn: 'span 3', color: '#ff4545' }}>❌ Error: {error}</div>}
        </form>
      </div>
      <div className="card">
        {isLoading ? <p>Loading...</p> : <DataTable onDelete={handleDelete} columns={columns} data={records} onEdit={handleEdit} />}
      </div>
    </div>
  );
}
