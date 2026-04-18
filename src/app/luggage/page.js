'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';

export default function LuggagePage() {
  const [luggage, setLuggage] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingLuggage, setEditingLuggage] = useState(null);
  const [formData, setFormData] = useState({ id: '', booking_id: '', tag_number: '', weight: '' });

  const columns = [
    { key: 'luggage_id', label: 'ID' },
    { key: 'booking_id', label: 'Booking' },
    { key: 'tag_number', label: 'Tag' },
    { key: 'weight', label: 'Weight (KG)' },
  ];

  const fetchLuggage = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/luggage');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLuggage(data);
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchLuggage(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (l) => {
    setEditingLuggage(l);
    setFormData({ id: l.luggage_id, booking_id: l.booking_id, tag_number: l.tag_number, weight: l.weight });
  };

  
  const handleDelete = async (row) => {
    try {
      const res = await fetch(`/api/luggage?id=${row.luggage_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');
      fetchLuggage();
    } catch (err) {
      if (typeof setError === 'function') setError(err.message);
      else alert("Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const method = editingLuggage ? 'PUT' : 'POST';
      const res = await fetch('/api/luggage', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setFormData({ id: '', booking_id: '', tag_number: '', weight: '' });
      setEditingLuggage(null);
      fetchLuggage();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="animate-fade">
      <h1>Luggage Management</h1>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>{editingLuggage ? 'Update Luggage' : 'Add New Luggage'}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group"><label>Luggage ID</label><input type="number" name="id" value={formData.id} onChange={handleInputChange} required disabled={!!editingLuggage} /></div>
          <div className="form-group"><label>Booking ID</label><input type="number" name="booking_id" value={formData.booking_id} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Tag Number</label><input type="text" name="tag_number" value={formData.tag_number} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Weight (KG)</label><input type="number" name="weight" step="0.01" value={formData.weight} onChange={handleInputChange} required /></div>
          <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem' }}>
            <button type="submit">{editingLuggage ? 'Update' : 'Set Data'}</button>
            {editingLuggage && <button type="button" className="btn-secondary" onClick={() => { setEditingLuggage(null); setFormData({ id: '', booking_id: '', tag_number: '', weight: '' }); }}>Cancel</button>}
          </div>
          {error && <div style={{ gridColumn: 'span 3', color: '#ff4545' }}>❌ Error: {error}</div>}
        </form>
      </div>
      <div className="card">
        {isLoading ? <p>Loading...</p> : <DataTable onDelete={handleDelete} columns={columns} data={luggage} onEdit={handleEdit} />}
      </div>
    </div>
  );
}
