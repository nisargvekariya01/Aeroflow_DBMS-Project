'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';
import AsyncSelect from '@/components/AsyncSelect';

export default function RunwaysPage() {
  const [runways, setRunways] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRunway, setEditingRunway] = useState(null);
  const [formData, setFormData] = useState({ airport_id: '', runway_id: '', surface_type: '', runway_length: '', status: 'Active' });

  const columns = [
    { key: 'airport_iata', label: 'Airport' },
    { key: 'runway_id', label: 'Runway ID' },
    { key: 'surface_type', label: 'Surface' },
    { key: 'runway_length', label: 'Length' },
    { key: 'status', label: 'Status' },
  ];

  const fetchRunways = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/runways');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRunways(data);
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchRunways(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (runway) => {
    setEditingRunway(runway);
    setFormData({
      airport_id: runway.airport_id,
      runway_id: runway.runway_id,
      surface_type: runway.surface_type,
      runway_length: runway.runway_length,
      status: runway.status
    });
  };

  
  const handleDelete = async (row) => {
    try {
      const res = await fetch(`/api/runways?airport_id=${row.airport_id}&runway_id=${row.runway_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');
      fetchRunways();
    } catch (err) {
      if (typeof setError === 'function') setError(err.message);
      else alert("Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const method = editingRunway ? 'PUT' : 'POST';
      const res = await fetch('/api/runways', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setFormData({ airport_id: '', runway_id: '', surface_type: '', runway_length: '', status: 'Active' });
      setEditingRunway(null);
      fetchRunways();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="animate-fade">
      <h1>Runways Management</h1>
      <div className="card" style={{ marginBottom: '2rem', position: 'relative', zIndex: 50 }}>
        <h2>{editingRunway ? 'Update Runway' : 'Add New Runway'}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <AsyncSelect 
            label="Airport" 
            fetchUrl="/api/airports"
            valueKey="airport_id"
            labelKey="airport_name"
            extraKey="iata_code"
            value={formData.airport_id} 
            onChange={(val) => setFormData(prev => ({ ...prev, airport_id: val }))} 
            placeholder="Select Airport..."
            disabled={!!editingRunway}
          />
          <div className="form-group"><label>Runway ID</label><input type="number" name="runway_id" value={formData.runway_id} onChange={handleInputChange} required disabled={!!editingRunway} /></div>
          <div className="form-group"><label>Surface Type</label><input type="text" name="surface_type" value={formData.surface_type} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Length (m)</label><input type="number" name="runway_length" value={formData.runway_length} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Status</label><select name="status" value={formData.status} onChange={handleInputChange}><option value="Active">Active</option><option value="Maintenance">Maintenance</option><option value="Closed">Closed</option></select></div>
          <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem' }}>
            <button type="submit">{editingRunway ? 'Update' : 'Set Data'}</button>
            {editingRunway && <button type="button" className="btn-secondary" onClick={() => { setEditingRunway(null); setFormData({ airport_id: '', runway_id: '', surface_type: '', runway_length: '', status: 'Active' }); }}>Cancel</button>}
          </div>
          {error && <div style={{ gridColumn: 'span 3', color: '#ff4545' }}>❌ Error: {error}</div>}
        </form>
      </div>
      <div className="card">
        {isLoading ? <p>Loading...</p> : <DataTable onDelete={handleDelete} columns={columns} data={runways} onEdit={handleEdit} />}
      </div>
    </div>
  );
}
