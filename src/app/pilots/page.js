'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';

export default function PilotsPage() {
  const [pilots, setPilots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPilot, setEditingPilot] = useState(null);
  const [formData, setFormData] = useState({ id: '', name: '', license_number: '', email: '', experience_level: 'Senior' });

  const columns = [
    { key: 'pilot_id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'license_number', label: 'License' },
    { key: 'experience_level', label: 'Experience' },
  ];

  const fetchPilots = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pilots');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPilots(data);
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchPilots(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (pilot) => {
    setEditingPilot(pilot);
    setFormData({ id: pilot.pilot_id, name: pilot.name, license_number: pilot.license_number, email: pilot.email, experience_level: pilot.experience_level });
  };

  
  const handleDelete = async (row) => {
    try {
      const res = await fetch(`/api/pilots?id=${row.pilot_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');
      fetchPilots();
    } catch (err) {
      if (typeof setError === 'function') setError(err.message);
      else alert("Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const method = editingPilot ? 'PUT' : 'POST';
      const res = await fetch('/api/pilots', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setFormData({ id: '', name: '', license_number: '', email: '', experience_level: 'Senior' });
      setEditingPilot(null);
      fetchPilots();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="animate-fade">
      <h1>Pilots Management</h1>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>{editingPilot ? 'Update Pilot' : 'Add New Pilot'}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group"><label>Pilot ID</label><input type="number" name="id" value={formData.id} onChange={handleInputChange} required disabled={!!editingPilot} /></div>
          <div className="form-group"><label>Name</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>License</label><input type="text" name="license_number" value={formData.license_number} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Email</label><input type="email" name="email" value={formData.email} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Experience</label><select name="experience_level" value={formData.experience_level} onChange={handleInputChange}><option value="Senior">Senior</option><option value="First Officer">First Officer</option><option value="Captain">Captain</option><option value="Junior">Junior</option></select></div>
          <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem' }}>
            <button type="submit">{editingPilot ? 'Update' : 'Set Data'}</button>
            {editingPilot && <button type="button" className="btn-secondary" onClick={() => { setEditingPilot(null); setFormData({ id: '', name: '', license_number: '', email: '', experience_level: 'Senior' }); }}>Cancel</button>}
          </div>
          {error && <div style={{ gridColumn: 'span 3', color: '#ff4545' }}>❌ Error: {error}</div>}
        </form>
      </div>
      <div className="card">
        {isLoading ? <p>Loading...</p> : <DataTable onDelete={handleDelete} columns={columns} data={pilots} onEdit={handleEdit} />}
      </div>
    </div>
  );
}
