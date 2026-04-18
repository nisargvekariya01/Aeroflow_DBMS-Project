'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';

export default function CrewPage() {
  const [crew, setCrew] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingCrew, setEditingCrew] = useState(null);
  const [formData, setFormData] = useState({ id: '', name: '', role: 'Flight Attendant', experience: '', language_proficiency: '' });

  const columns = [
    { key: 'crew_id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'experience', label: 'Experience' },
  ];

  const fetchCrew = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crew');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCrew(data);
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchCrew(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (c) => {
    setEditingCrew(c);
    setFormData({ id: c.crew_id, name: c.name, role: c.role, experience: c.experience, language_proficiency: c.language_proficiency });
  };

  
  const handleDelete = async (row) => {
    try {
      const res = await fetch(`/api/crew?id=${row.crew_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');
      fetchCrew();
    } catch (err) {
      if (typeof setError === 'function') setError(err.message);
      else alert("Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const method = editingCrew ? 'PUT' : 'POST';
      const res = await fetch('/api/crew', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setFormData({ id: '', name: '', role: 'Flight Attendant', experience: '', language_proficiency: '' });
      setEditingCrew(null);
      fetchCrew();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="animate-fade">
      <h1>Crew Management</h1>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>{editingCrew ? 'Update Crew' : 'Add New Crew'}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group"><label>Crew ID</label><input type="number" name="id" value={formData.id} onChange={handleInputChange} required disabled={!!editingCrew} /></div>
          <div className="form-group"><label>Name</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Experience</label><input type="number" name="experience" value={formData.experience} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Role</label><select name="role" value={formData.role} onChange={handleInputChange}><option value="Flight Attendant">Flight Attendant</option><option value="Cabin Manager">Cabin Manager</option><option value="Technician">Technician</option></select></div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Languages</label><input type="text" name="language_proficiency" value={formData.language_proficiency} onChange={handleInputChange} required /></div>
          <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem' }}>
            <button type="submit">{editingCrew ? 'Update' : 'Set Data'}</button>
            {editingCrew && <button type="button" className="btn-secondary" onClick={() => { setEditingCrew(null); setFormData({ id: '', name: '', role: 'Flight Attendant', experience: '', language_proficiency: '' }); }}>Cancel</button>}
          </div>
          {error && <div style={{ gridColumn: 'span 3', color: '#ff4545' }}>❌ Error: {error}</div>}
        </form>
      </div>
      <div className="card">
        {isLoading ? <p>Loading...</p> : <DataTable onDelete={handleDelete} columns={columns} data={crew} onEdit={handleEdit} />}
      </div>
    </div>
  );
}
