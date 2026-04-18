'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';

export default function RunwayUsagePage() {
  const [usage, setUsage] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingUsage, setEditingUsage] = useState(null);
  const [formData, setFormData] = useState({ flight_id: '', route_id: '', leg_sequence_no: '', airport_id: '', runway_id: '', usage_type: 'Takeoff' });

  const columns = [
    { key: 'flight_id', label: 'Flight' },
    { key: 'runway_id', label: 'Runway' },
    { key: 'usage_type', label: 'Type' },
    { key: 'airport_iata', label: 'Airport' },
  ];

  const fetchUsage = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/uses-runway');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsage(data);
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchUsage(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (u) => {
    setEditingUsage(u);
    setFormData({ flight_id: u.flight_id, route_id: u.route_id, leg_sequence_no: u.leg_sequence_no, airport_id: u.airport_id, runway_id: u.runway_id, usage_type: u.usage_type });
  };

  
  const handleDelete = async (row) => {
    try {
      const res = await fetch(`/api/uses-runway?flight_id=${row.flight_id}&route_id=${row.route_id}&leg_sequence_no=${row.leg_sequence_no}&airport_id=${row.airport_id}&runway_id=${row.runway_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');
      fetchUsage();
    } catch (err) {
      if (typeof setError === 'function') setError(err.message);
      else alert("Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const method = editingUsage ? 'PUT' : 'POST';
      const res = await fetch('/api/uses-runway', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setFormData({ flight_id: '', route_id: '', leg_sequence_no: '', airport_id: '', runway_id: '', usage_type: 'Takeoff' });
      setEditingUsage(null);
      fetchUsage();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="animate-fade">
      <h1>Runway Usage Control</h1>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>{editingUsage ? 'Update Usage' : 'Log New Usage'}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group"><label>Flight ID</label><input type="number" name="flight_id" value={formData.flight_id} onChange={handleInputChange} required disabled={!!editingUsage} /></div>
          <div className="form-group"><label>Route ID</label><input type="number" name="route_id" value={formData.route_id} onChange={handleInputChange} required disabled={!!editingUsage} /></div>
          <div className="form-group"><label>Leg Seq</label><input type="number" name="leg_sequence_no" value={formData.leg_sequence_no} onChange={handleInputChange} required disabled={!!editingUsage} /></div>
          <div className="form-group"><label>Airport ID</label><input type="number" name="airport_id" value={formData.airport_id} onChange={handleInputChange} required disabled={!!editingUsage} /></div>
          <div className="form-group"><label>Runway ID</label><input type="number" name="runway_id" value={formData.runway_id} onChange={handleInputChange} required disabled={!!editingUsage} /></div>
          <div className="form-group"><label>Usage Type</label><select name="usage_type" value={formData.usage_type} onChange={handleInputChange}><option value="Takeoff">Takeoff</option><option value="Landing">Landing</option></select></div>
          <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem' }}>
            <button type="submit">{editingUsage ? 'Update' : 'Log Usage'}</button>
            {editingUsage && <button type="button" className="btn-secondary" onClick={() => { setEditingUsage(null); setFormData({ flight_id: '', route_id: '', leg_sequence_no: '', airport_id: '', runway_id: '', usage_type: 'Takeoff' }); }}>Cancel</button>}
          </div>
          {error && <div style={{ gridColumn: 'span 3', color: '#ff4545' }}>❌ Error: {error}</div>}
        </form>
      </div>
      <div className="card">
        {isLoading ? <p>Loading...</p> : <DataTable onDelete={handleDelete} columns={columns} data={usage} onEdit={handleEdit} />}
      </div>
    </div>
  );
}
