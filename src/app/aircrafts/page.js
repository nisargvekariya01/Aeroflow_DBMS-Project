'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';

export default function AircraftsPage() {
  const [aircrafts, setAircrafts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingAircraft, setEditingAircraft] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [formData, setFormData] = useState({
    id: '', airline_id: '', model: '', manufacture_date: '',
    flight_hours: '', flight_cycle: '', eco_seats: '', bus_seats: '',
    fuel_capacity: '', fuel_level: '', location: '', status: 'AVAILABLE'
  });

  const StatusBadge = ({ status }) => {
    const s = String(status || '').toUpperCase();
    let color = '#9e9e9e'; // INACTIVE
    if (s === 'AVAILABLE') color = '#4caf50';
    if (s === 'ACTIVE') color = '#ff4545';
    if (s === 'MAINTENANCE') color = '#ff9800';

    return (
      <span style={{ 
        padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', 
        backgroundColor: `${color}15`, color: color, border: `1px solid ${color}40`,
        letterSpacing: '0.5px'
      }}>
        {s || 'UNKNOWN'}
      </span>
    );
  };

  const columns = [
    { key: 'aircraft_id', label: 'ID' },
    { key: 'airline_id', label: 'Airline' },
    { key: 'model', label: 'Model' },
    { key: 'status_type', label: 'Status', render: (row) => <StatusBadge status={row.status_type} /> },
    { key: 'location', label: 'Location' },
    { key: 'total_flight_hours', label: 'Hours' },
  ];

  const fetchAircrafts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/aircrafts');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setAircrafts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAircrafts();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (ac) => {
    setEditingAircraft(ac);
    setFormData({
      id: ac.aircraft_id,
      airline_id: ac.airline_id,
      model: ac.model,
      manufacture_date: ac.manufacture_date?.split('T')[0] || '',
      flight_hours: ac.total_flight_hours,
      flight_cycle: ac.total_flight_cycle,
      eco_seats: ac.tot_eco_seats,
      bus_seats: ac.tot_bus_seats,
      fuel_capacity: ac.total_fuel_capacity,
      fuel_level: ac.current_fuel_level,
      location: ac.location,
      status: String(ac.status_type).toUpperCase()
    });
  };

  
  const handleDelete = async (row) => {
    try {
      const res = await fetch(`/api/aircrafts?id=${row.aircraft_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');
      fetchAircrafts();
    } catch (err) {
      if (typeof setError === 'function') setError(err.message);
      else alert("Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const method = editingAircraft ? 'PUT' : 'POST';
      const res = await fetch('/api/aircrafts', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Operation failed');

      setFormData({
        id: '', airline_id: '', model: '', manufacture_date: '',
        flight_hours: '', flight_cycle: '', eco_seats: '', bus_seats: '',
        fuel_capacity: '', fuel_level: '', location: '', status: 'AVAILABLE'
      });
      setEditingAircraft(null);
      fetchAircrafts();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Aircrafts Management</h1>
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          {['ALL', 'AVAILABLE', 'ACTIVE', 'MAINTENANCE', 'INACTIVE'].map(status => (
            <button 
              key={status} type="button" 
              onClick={() => setStatusFilter(status)}
              style={{
                padding: '6px 14px', borderRadius: '8px', border: 'none',
                background: statusFilter === status ? 'var(--primary)' : 'transparent',
                color: statusFilter === status ? 'white' : 'var(--text-dim)', 
                cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem', fontWeight: 'bold'
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>
      
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>{editingAircraft ? 'Update Aircraft' : 'Add New Aircraft'}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label>ID</label>
            <input type="number" name="id" value={formData.id} onChange={handleInputChange} required disabled={!!editingAircraft} />
          </div>
          <div className="form-group">
            <label>Airline ID</label>
            <input type="number" name="airline_id" value={formData.airline_id} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Model</label>
            <input type="text" name="model" value={formData.model} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Mfg Date</label>
            <input type="date" name="manufacture_date" value={formData.manufacture_date} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Flight Hours</label>
            <input type="number" name="flight_hours" value={formData.flight_hours} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Flight Cycle</label>
            <input type="number" name="flight_cycle" value={formData.flight_cycle} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Eco Seats</label>
            <input type="number" name="eco_seats" value={formData.eco_seats} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Bus Seats</label>
            <input type="number" name="bus_seats" value={formData.bus_seats} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Fuel Cap (L)</label>
            <input type="number" name="fuel_capacity" value={formData.fuel_capacity} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Current Fuel</label>
            <input type="number" name="fuel_level" value={formData.fuel_level} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Location</label>
            <input type="text" name="location" value={formData.location} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select name="status" value={formData.status} onChange={handleInputChange}>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
          
          <div style={{ gridColumn: 'span 4', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit">{editingAircraft ? 'Update Data' : 'Set Data'}</button>
            {editingAircraft && (
              <button type="button" className="btn-secondary" onClick={() => { setEditingAircraft(null); setFormData({ id: '', airline_id: '', model: '', manufacture_date: '', flight_hours: '', flight_cycle: '', eco_seats: '', bus_seats: '', fuel_capacity: '', fuel_level: '', location: '', status: 'AVAILABLE' }); }}>Cancel</button>
            )}
          </div>
          {error && <div style={{ gridColumn: 'span 4', color: '#ff4545', padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,69,69,0.1)' }}>❌ Error: {error}</div>}
        </form>
      </div>

      <div className="card">
        <h2>Existing Fleet</h2>
        {isLoading ? <p style={{ color: 'var(--text-dim)', padding: '1rem' }}>Loading...</p> : <DataTable onDelete={handleDelete} columns={columns} data={aircrafts.filter(ac => statusFilter === 'ALL' || String(ac.status_type).toUpperCase() === statusFilter)} onEdit={handleEdit} />}
      </div>
    </div>
  );
}
