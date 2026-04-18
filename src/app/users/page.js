'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ id: '', name: '', email: '', phone: '', address: '' });

  const columns = [
    { key: 'user_id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
  ];

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data);
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({ id: user.user_id, name: user.name, email: user.email, phone: user.phone, address: user.address });
  };

  
  const handleDelete = async (row) => {
    try {
      const res = await fetch(`/api/users?id=${row.user_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');
      fetchUsers();
    } catch (err) {
      if (typeof setError === 'function') setError(err.message);
      else alert("Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const method = editingUser ? 'PUT' : 'POST';
      const res = await fetch('/api/users', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setFormData({ id: '', name: '', email: '', phone: '', address: '' });
      setEditingUser(null);
      fetchUsers();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="animate-fade">
      <h1>Users Management</h1>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>{editingUser ? 'Update User' : 'Add New User'}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group"><label>User ID</label><input type="number" name="id" value={formData.id} onChange={handleInputChange} required disabled={!!editingUser} /></div>
          <div className="form-group"><label>Name</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Email</label><input type="email" name="email" value={formData.email} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Phone</label><input type="text" name="phone" value={formData.phone} onChange={handleInputChange} required /></div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Address</label><input type="text" name="address" value={formData.address} onChange={handleInputChange} required /></div>
          <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem' }}>
            <button type="submit">{editingUser ? 'Update' : 'Set Data'}</button>
            {editingUser && <button type="button" className="btn-secondary" onClick={() => { setEditingUser(null); setFormData({ id: '', name: '', email: '', phone: '', address: '' }); }}>Cancel</button>}
          </div>
          {error && <div style={{ gridColumn: 'span 3', color: '#ff4545' }}>❌ Error: {error}</div>}
        </form>
      </div>
      <div className="card">
        {isLoading ? <p>Loading...</p> : <DataTable onDelete={handleDelete} columns={columns} data={users} onEdit={handleEdit} />}
      </div>
    </div>
  );
}
