'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';
import AsyncSelect from '@/components/AsyncSelect';

const COLUMNS = [{ key: 'route_id', label: 'ID' }, { key: 'source_iata', label: 'From' }, { key: 'dest_iata', label: 'To' }, { key: 'distance', label: 'Distance (km)' }, { key: 'estimated_duration', label: 'Duration (min)' }];

export default function RoutesPage() {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ id: '', distance: '', estimated_duration: '', source_airport_id: '', dest_airport_id: '' });
  const fetchData = async () => {
    setIsLoading(true); setError(null);
    try { 
      const res = await fetch('/api/routes'); const json = await res.json(); if (!res.ok) throw new Error(json.error); setData(Array.isArray(json) ? json : []); 
    }
    catch (e) { setError(e.message); } finally { setIsLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);
  const handleEdit = (row) => { setEditing(row); setForm({ id: row.route_id, distance: row.distance, estimated_duration: row.estimated_duration, source_airport_id: row.source_airport_id, dest_airport_id: row.dest_airport_id }); };
  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { setEditing(null); setForm({ id: '', distance: '', estimated_duration: '', source_airport_id: '', dest_airport_id: '' }); fetchData(); }
  };
  return (
    <div className="animate-fade"><h1>Routes</h1>
      <div className="card" style={{ marginBottom: '2rem', position: 'relative', zIndex: 50 }}><h2>{editing ? 'Update Route' : 'Add Route'}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          {[['id','Route ID','number'],['distance','Distance (km)','number'],['estimated_duration','Duration (min)','number']].map(([k,l,t]) => (<div className="form-group" key={k}><label>{l}</label><input type={t} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} required disabled={k === 'id' && !!editing} /></div>))}
          <AsyncSelect 
            label="Source Airport" 
            fetchUrl="/api/airports"
            valueKey="airport_id"
            labelKey="airport_name"
            extraKey="iata_code"
            value={form.source_airport_id} 
            onChange={(val) => setForm({ ...form, source_airport_id: val })} 
            disabledOptions={form.dest_airport_id ? [Number(form.dest_airport_id), String(form.dest_airport_id)] : []}
            placeholder="Select Source..."
          />
          <AsyncSelect 
            label="Destination Airport" 
            fetchUrl="/api/airports"
            valueKey="airport_id"
            labelKey="airport_name"
            extraKey="iata_code"
            value={form.dest_airport_id} 
            onChange={(val) => setForm({ ...form, dest_airport_id: val })} 
            disabledOptions={form.source_airport_id ? [Number(form.source_airport_id), String(form.source_airport_id)] : []}
            placeholder="Select Destination..."
          />
          <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem' }}>
            <button type="submit">{editing ? 'Update' : 'Set Data'}</button>
            {editing && <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm({ id: '', distance: '', estimated_duration: '', source_airport_id: '', dest_airport_id: '' }); }}>Cancel</button>}
          </div>
        </form>
      </div>
      <div className="card"><h2>Existing Routes</h2>
        {isLoading ? <p style={{ padding: '1rem', color: 'var(--text-dim)' }}>Loading...</p> : error ? <p style={{ padding: '1rem', color: '#ff4545' }}>❌ {error}</p> : <DataTable columns={COLUMNS} data={data} onEdit={handleEdit} />}
      </div>
    </div>
  );
}
