'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';
import SearchableSelect from '@/components/SearchableSelect';

export default function RoutesPage() {
  const [routes, setRoutes] = useState([]);
  const [airports, setAirports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRoute, setEditingRoute] = useState(null);
  const [formData, setFormData] = useState({ id: '', distance: '', estimated_duration: '', source_airport_id: '', dest_airport_id: '' });

  const columns = [
    { key: 'route_id', label: 'ID' },
    { key: 'distance', label: 'Distance (KM)' },
    { key: 'estimated_duration', label: 'Duration (Min)' },
    { key: 'source_iata', label: 'Source' },
    { key: 'dest_iata', label: 'Destination' },
  ];

  const fetchRoutes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/routes');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRoutes(data);

      const airRes = await fetch('/api/airports');
      const airData = await airRes.json();
      if (airRes.ok) setAirports(airData);
      
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchRoutes(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (route) => {
    setEditingRoute(route);
    setFormData({ id: route.route_id, distance: route.distance, estimated_duration: route.estimated_duration, source_airport_id: route.source_airport_id, dest_airport_id: route.dest_airport_id });
  };

  
  const handleDelete = async (row) => {
    try {
      const res = await fetch(`/api/routes?id=${row.route_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');
      fetchRoutes();
    } catch (err) {
      if (typeof setError === 'function') setError(err.message);
      else alert("Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const method = editingRoute ? 'PUT' : 'POST';
      const res = await fetch('/api/routes', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setFormData({ id: '', distance: '', estimated_duration: '', source_airport_id: '', dest_airport_id: '' });
      setEditingRoute(null);
      fetchRoutes();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="animate-fade">
      <h1>Routes Management</h1>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>{editingRoute ? 'Update Route' : 'Add New Route'}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group"><label>Route ID</label><input type="number" name="id" value={formData.id} onChange={handleInputChange} required disabled={!!editingRoute} /></div>
          <div className="form-group"><label>Distance (KM)</label><input type="number" name="distance" value={formData.distance} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Duration (Min)</label><input type="number" name="estimated_duration" value={formData.estimated_duration} onChange={handleInputChange} required /></div>
          
          <SearchableSelect 
            label="Source Airport" 
            options={airports.map(a => ({ value: a.airport_id, label: `${a.airport_name} (${a.iata_code})`, extra: { code: a.iata_code } }))} 
            value={formData.source_airport_id} 
            onChange={(val) => setFormData(prev => ({ ...prev, source_airport_id: val }))} 
            disabledOptions={formData.dest_airport_id ? [Number(formData.dest_airport_id), String(formData.dest_airport_id)] : []}
            placeholder="Select Source..."
          />
          
          <SearchableSelect 
            label="Destination Airport" 
            options={airports.map(a => ({ value: a.airport_id, label: `${a.airport_name} (${a.iata_code})`, extra: { code: a.iata_code } }))} 
            value={formData.dest_airport_id} 
            onChange={(val) => setFormData(prev => ({ ...prev, dest_airport_id: val }))} 
            disabledOptions={formData.source_airport_id ? [Number(formData.source_airport_id), String(formData.source_airport_id)] : []}
            placeholder="Select Destination..."
          />

          <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem' }}>
            <button type="submit">{editingRoute ? 'Update' : 'Set Data'}</button>
            {editingRoute && <button type="button" className="btn-secondary" onClick={() => { setEditingRoute(null); setFormData({ id: '', distance: '', estimated_duration: '', source_airport_id: '', dest_airport_id: '' }); }}>Cancel</button>}
          </div>
          {error && <div style={{ gridColumn: 'span 3', color: '#ff4545' }}>❌ Error: {error}</div>}
        </form>
      </div>
      <div className="card">
        {isLoading ? <p>Loading...</p> : <DataTable onDelete={handleDelete} columns={columns} data={routes} onEdit={handleEdit} />}
      </div>
    </div>
  );
}
