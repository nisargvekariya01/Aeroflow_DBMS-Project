'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';

export default function AirportsPage() {
  const [airports, setAirports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingAirport, setEditingAirport] = useState(null);
  const [formData, setFormData] = useState({
    id: '', name: '', city: '', state: '', country: '', iata_code: ''
  });

  const columns = [
    { key: 'airport_id', label: 'ID' },
    { key: 'airport_name', label: 'Name' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'country', label: 'Country' },
    { key: 'iata_code', label: 'IATA' },
  ];

  const fetchAirports = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/airports');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setAirports(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAirports();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (airport) => {
    setEditingAirport(airport);
    setFormData({
      id: airport.airport_id,
      name: airport.airport_name,
      city: airport.city,
      state: airport.state,
      country: airport.country,
      iata_code: airport.iata_code
    });
  };

  
  const handleDelete = async (row) => {
    try {
      const res = await fetch(`/api/airports?id=${row.airport_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');
      fetchAirports();
    } catch (err) {
      if (typeof setError === 'function') setError(err.message);
      else alert("Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const method = editingAirport ? 'PUT' : 'POST';
      const res = await fetch('/api/airports', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Operation failed');

      setFormData({ id: '', name: '', city: '', state: '', country: '', iata_code: '' });
      setEditingAirport(null);
      fetchAirports();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="animate-fade">
      <h1>Airports Management</h1>
      
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>{editingAirport ? 'Update Airport' : 'Add New Airport'}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label>Airport ID</label>
            <input type="number" name="id" value={formData.id} onChange={handleInputChange} required disabled={!!editingAirport} />
          </div>
          <div className="form-group">
            <label>Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>City</label>
            <input type="text" name="city" value={formData.city} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>State</label>
            <input type="text" name="state" value={formData.state} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Country</label>
            <input type="text" name="country" value={formData.country} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>IATA Code</label>
            <input type="text" name="iata_code" value={formData.iata_code} onChange={handleInputChange} required />
          </div>
          
          <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit">{editingAirport ? 'Update Data' : 'Set Data'}</button>
            {editingAirport && (
              <button type="button" className="btn-secondary" onClick={() => { setEditingAirport(null); setFormData({ id: '', name: '', city: '', state: '', country: '', iata_code: '' }); }}>Cancel</button>
            )}
          </div>
          {error && <div style={{ gridColumn: 'span 3', color: '#ff4545', padding: '0.5rem', borderRadius: '4px', background: 'rgba(255,69,69,0.1)' }}>❌ Error: {error}</div>}
        </form>
      </div>

      <div className="card">
        <h2>Existing Airports</h2>
        {isLoading ? <p style={{ color: 'var(--text-dim)', padding: '1rem' }}>Loading...</p> : <DataTable onDelete={handleDelete} columns={columns} data={airports} onEdit={handleEdit} />}
      </div>
    </div>
  );
}
