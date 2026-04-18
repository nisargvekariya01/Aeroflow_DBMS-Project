'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';

export default function CrewAssignPage() {
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({ flight_id: '', route_id: '', leg_sequence_no: '', crew_id: '' });

  const columns = [
    { key: 'flight_id', label: 'Flight' },
    { key: 'route_id', label: 'Route' },
    { key: 'leg_sequence_no', label: 'Seq' },
    { key: 'crew_id', label: 'Crew ID' },
  ];

  const fetchAssignments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crew-assign');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAssignments(data);
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchAssignments(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  
  const handleDelete = async (row) => {
    try {
      const res = await fetch(`/api/crew-assign?flight_id=${row.flight_id}&route_id=${row.route_id}&leg_sequence_no=${row.leg_sequence_no}&crew_id=${row.crew_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');
      fetchAssignments();
    } catch (err) {
      if (typeof setError === 'function') setError(err.message);
      else alert("Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/crew-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setFormData({ flight_id: '', route_id: '', leg_sequence_no: '', crew_id: '' });
      fetchAssignments();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="animate-fade">
      <h1>Crew Assignments</h1>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>Assign Crew to Leg</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group"><label>Flight ID</label><input type="number" name="flight_id" value={formData.flight_id} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Route ID</label><input type="number" name="route_id" value={formData.route_id} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Leg Seq</label><input type="number" name="leg_sequence_no" value={formData.leg_sequence_no} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Crew ID</label><input type="number" name="crew_id" value={formData.crew_id} onChange={handleInputChange} required /></div>
          <div style={{ gridColumn: 'span 4' }}>
            <button type="submit">Assign Crew</button>
          </div>
          {error && <div style={{ gridColumn: 'span 4', color: '#ff4545' }}>❌ Error: {error}</div>}
        </form>
      </div>
      <div className="card">
        {isLoading ? <p>Loading...</p> : <DataTable onDelete={handleDelete} columns={columns} data={assignments} />}
      </div>
    </div>
  );
}
