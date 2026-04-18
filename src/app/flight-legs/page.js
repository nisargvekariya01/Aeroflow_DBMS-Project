'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';

export default function FlightLegsPage() {
  const [legs, setLegs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingLeg, setEditingLeg] = useState(null);
  const [formData, setFormData] = useState({ flight_id: '', route_id: '', leg_sequence_no: '', takeoff_time: '', landing_time: '', leg_status: 'On Time' });

  const columns = [
    { key: 'flight_id', label: 'Flight' },
    { key: 'route_id', label: 'Route' },
    { key: 'leg_sequence_no', label: 'Seq' },
    { key: 'leg_status', label: 'Status' },
    { key: 'takeoff_time', label: 'Takeoff' },
  ];

  const fetchLegs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/flight-legs');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLegs(data);
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchLegs(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (leg) => {
    setEditingLeg(leg);
    setFormData({
      flight_id: leg.flight_id,
      route_id: leg.route_id,
      leg_sequence_no: leg.leg_sequence_no,
      takeoff_time: leg.takeoff_time?.slice(0, 16) || '',
      landing_time: leg.landing_time?.slice(0, 16) || '',
      leg_status: leg.leg_status
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const method = editingLeg ? 'PUT' : 'POST';
      const res = await fetch('/api/flight-legs', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setFormData({ flight_id: '', route_id: '', leg_sequence_no: '', takeoff_time: '', landing_time: '', leg_status: 'On Time' });
      setEditingLeg(null);
      fetchLegs();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="animate-fade">
      <h1>Flight Legs Management</h1>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>{editingLeg ? 'Update Flight Leg' : 'Add New Flight Leg'}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group"><label>Flight ID</label><input type="number" name="flight_id" value={formData.flight_id} onChange={handleInputChange} required disabled={!!editingLeg} /></div>
          <div className="form-group"><label>Route ID</label><input type="number" name="route_id" value={formData.route_id} onChange={handleInputChange} required disabled={!!editingLeg} /></div>
          <div className="form-group"><label>Sequence No</label><input type="number" name="leg_sequence_no" value={formData.leg_sequence_no} onChange={handleInputChange} required disabled={!!editingLeg} /></div>
          <div className="form-group"><label>Takeoff Time</label><input type="datetime-local" name="takeoff_time" value={formData.takeoff_time} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Landing Time</label><input type="datetime-local" name="landing_time" value={formData.landing_time} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Status</label><select name="leg_status" value={formData.leg_status} onChange={handleInputChange}><option value="On Time">On Time</option><option value="Delayed">Delayed</option><option value="Cancelled">Cancelled</option></select></div>
          <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem' }}>
            <button type="submit">{editingLeg ? 'Update' : 'Set Data'}</button>
            {editingLeg && <button type="button" className="btn-secondary" onClick={() => { setEditingLeg(null); setFormData({ flight_id: '', route_id: '', leg_sequence_no: '', takeoff_time: '', landing_time: '', leg_status: 'On Time' }); }}>Cancel</button>}
          </div>
          {error && <div style={{ gridColumn: 'span 3', color: '#ff4545' }}>❌ Error: {error}</div>}
        </form>
      </div>
      <div className="card">
        {isLoading ? <p>Loading...</p> : <DataTable columns={columns} data={legs} onEdit={handleEdit} />}
      </div>
    </div>
  );
}
