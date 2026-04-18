'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';
import AsyncSelect from '@/components/AsyncSelect';

export default function GatesPage() {
  const [gates, setGates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingGate, setEditingGate] = useState(null);
  const [formData, setFormData] = useState({ airport_id: '', gate_no: '', gate_status: 'Available' });

  const columns = [
    { key: 'airport_iata', label: 'Airport' },
    { key: 'gate_no', label: 'Gate No' },
    { key: 'gate_status', label: 'Status' },
  ];

  const fetchGates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/gates');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGates(data);
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchGates(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (gate) => {
    setEditingGate(gate);
    setFormData({ airport_id: gate.airport_id, gate_no: gate.gate_no, gate_status: gate.gate_status });
  };

  
  const handleDelete = async (row) => {
    try {
      const res = await fetch(`/api/gates?airport_id=${row.airport_id}&gate_no=${row.gate_no}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');
      fetchGates();
    } catch (err) {
      if (typeof setError === 'function') setError(err.message);
      else alert("Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const method = editingGate ? 'PUT' : 'POST';
      const res = await fetch('/api/gates', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setFormData({ airport_id: '', gate_no: '', gate_status: 'Available' });
      setEditingGate(null);
      fetchGates();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="animate-fade">
      <h1>Gates Management</h1>
      <div className="card" style={{ marginBottom: '2rem', position: 'relative', zIndex: 50 }}>
        <h2>{editingGate ? 'Update Gate' : 'Add New Gate'}</h2>
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
            disabled={!!editingGate}
          />
          <div className="form-group"><label>Gate No</label><input type="number" name="gate_no" value={formData.gate_no} onChange={handleInputChange} required disabled={!!editingGate} /></div>
          <div className="form-group"><label>Status</label><select name="gate_status" value={formData.gate_status} onChange={handleInputChange}><option value="Available">Available</option><option value="Occupied">Occupied</option><option value="Maintenance">Maintenance</option></select></div>
          <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem' }}>
            <button type="submit">{editingGate ? 'Update' : 'Set Data'}</button>
            {editingGate && <button type="button" className="btn-secondary" onClick={() => { setEditingGate(null); setFormData({ airport_id: '', gate_no: '', gate_status: 'Available' }); }}>Cancel</button>}
          </div>
          {error && <div style={{ gridColumn: 'span 3', color: '#ff4545' }}>❌ Error: {error}</div>}
        </form>
      </div>
      <div className="card">
        {isLoading ? <p>Loading...</p> : <DataTable onDelete={handleDelete} columns={columns} data={gates} onEdit={handleEdit} />}
      </div>
    </div>
  );
}
