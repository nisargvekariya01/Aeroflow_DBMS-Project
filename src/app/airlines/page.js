'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';

export default function AirlinesPage() {
  const [airlines, setAirlines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingAirline, setEditingAirline] = useState(null);
  const [formData, setFormData] = useState({
    id: '', name: '', country: '', headquarters: '', email: '', iata: ''
  });

  const columns = [
    { key: 'airline_id', label: 'ID' },
    { key: 'airline_name', label: 'Name' },
    { key: 'country', label: 'Country' },
    { key: 'headquarters', label: 'Headquarters' },
    { key: 'email', label: 'Email' },
    { key: 'iata_designator_codes', label: 'IATA' },
  ];

  const fetchAirlines = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/airlines');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setAirlines(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAirlines();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (airline) => {
    setEditingAirline(airline);
    setFormData({
      id: airline.airline_id,
      name: airline.airline_name,
      country: airline.country,
      headquarters: airline.headquarters,
      email: airline.email,
      iata: airline.iata_designator_codes
    });
  };

  
  const handleDelete = async (row) => {
    try {
      const res = await fetch(`/api/airlines?id=${row.airline_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');
      fetchAirlines();
    } catch (err) {
      if (typeof setError === 'function') setError(err.message);
      else alert("Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Client-side null check
    if (!formData.id || !formData.name || !formData.country || !formData.headquarters || !formData.email || !formData.iata) {
      setError('All fields are required.');
      return;
    }

    try {
      const method = editingAirline ? 'PUT' : 'POST';
      const res = await fetch('/api/airlines', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Operation failed');
      }

      // Success
      setFormData({ id: '', name: '', country: '', headquarters: '', email: '', iata: '' });
      setEditingAirline(null);
      fetchAirlines();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="animate-fade">
      <h1>Airlines Management</h1>
      
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>{editingAirline ? 'Update Airline' : 'Add New Airline'}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label>Airline ID</label>
            <input 
              type="number" 
              name="id" 
              value={formData.id} 
              onChange={handleInputChange} 
              required 
              disabled={!!editingAirline} 
            />
          </div>
          <div className="form-group">
            <label>Airline Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Country</label>
            <input type="text" name="country" value={formData.country} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Headquarters</label>
            <input type="text" name="headquarters" value={formData.headquarters} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>IATA Designator</label>
            <input type="text" name="iata" value={formData.iata} onChange={handleInputChange} required />
          </div>
          
          <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit">{editingAirline ? 'Update Data' : 'Set Data'}</button>
            {editingAirline && (
              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => {
                  setEditingAirline(null);
                  setFormData({ id: '', name: '', country: '', headquarters: '', email: '', iata: '' });
                }}
              >
                Cancel
              </button>
            )}
          </div>
          
          {error && (
            <div style={{ gridColumn: 'span 3', color: '#ff4545', padding: '0.5rem', borderRadius: '4px', background: 'rgba(255, 69, 69, 0.1)' }}>
              ❌ Error: {error}
            </div>
          )}
        </form>
      </div>

      <div className="card">
        <h2>Existing Airlines</h2>
        {isLoading ? (
          <p style={{ color: 'var(--text-dim)', padding: '1rem' }}>Loading...</p>
        ) : (
          <DataTable onDelete={handleDelete} columns={columns} data={airlines} onEdit={handleEdit} />
        )}
      </div>
    </div>
  );
}
