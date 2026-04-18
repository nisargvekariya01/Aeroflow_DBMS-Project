'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';
import AsyncSelect from '@/components/AsyncSelect';
import RouteSelector from '@/components/flights/RouteSelector';
import FlightLegEditor from '@/components/flights/FlightLegEditor';

export default function FlightsPage() {
  const [flights, setFlights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingFlight, setEditingFlight] = useState(null);
  const [formData, setFormData] = useState({ id: '', aircraft_id: '', source_airport_id: '', dest_airport_id: '' });
  const [flightLegs, setFlightLegs] = useState([]);
  const [showRouteSelector, setShowRouteSelector] = useState(false);

  const columns = [
    { key: 'flight_id', label: 'ID' },
    { key: 'aircraft_id', label: 'Aircraft' },
    { key: 'departure_time', label: 'Departure' },
    { key: 'arrival_time', label: 'Arrival' },
    { key: 'source_iata', label: 'Source' },
    { key: 'dest_iata', label: 'Dest' },
  ];

  const fetchFlights = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/flights');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFlights(data);
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchFlights(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (flight) => {
    setEditingFlight(flight);
    setFlightLegs([]);
    setFormData({
      id: flight.flight_id,
      aircraft_id: flight.aircraft_id,
      source_airport_id: flight.source_airport_id,
      dest_airport_id: flight.dest_airport_id
    });
  };

  
  const handleDelete = async (row) => {
    try {
      const res = await fetch(`/api/flights?id=${row.flight_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');
      fetchFlights();
    } catch (err) {
      if (typeof setError === 'function') setError(err.message);
      else alert("Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (!editingFlight && flightLegs.length === 0) {
        throw new Error('You must select at least one route leg via "Find Routes".');
      }

      let payload = { ...formData };

      if (flightLegs.length > 0) {
        const firstLeg = flightLegs[0];
        const lastLeg = flightLegs[flightLegs.length - 1];

        // Validating the endpoints match main fields (comparing either raw ID or string representation if available)
        if (String(firstLeg.source_airport_id) !== String(formData.source_airport_id) && firstLeg.source_iata !== formData.source_airport_id) {
          throw new Error('First leg must start from the selected Source Airport.');
        }
        if (String(lastLeg.dest_airport_id) !== String(formData.dest_airport_id) && lastLeg.dest_iata !== formData.dest_airport_id) {
          throw new Error('Last leg must arrive at the selected Destination Airport.');
        }

        for (let i = 0; i < flightLegs.length; i++) {
           if (!flightLegs[i].takeoff_time || !flightLegs[i].landing_time) {
              throw new Error(`Please fill in takeoff/landing times for Leg ${i + 1}.`);
           }
        }

        for (let i = 0; i < flightLegs.length - 1; i++) {
          if (String(flightLegs[i].dest_airport_id) !== String(flightLegs[i+1].source_airport_id) && flightLegs[i].dest_iata !== flightLegs[i+1].source_iata) {
            throw new Error(`Discontinuity found between Leg ${i+1} and Leg ${i+2}.`);
          }
          if (new Date(flightLegs[i].landing_time) >= new Date(flightLegs[i+1].takeoff_time)) {
            throw new Error(`Time conflict: Leg ${i+2} takes off before Leg ${i+1} lands.`);
          }
        }

        payload.departure_time = firstLeg.takeoff_time;
        payload.arrival_time = lastLeg.landing_time;
      } else {
        if (!payload.departure_time) payload.departure_time = new Date().toISOString();
        if (!payload.arrival_time) payload.arrival_time = new Date().toISOString();
      }

      const method = editingFlight ? 'PUT' : 'POST';
      const res = await fetch('/api/flights', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      if (!editingFlight) {
        for (let i = 0; i < flightLegs.length; i++) {
          const leg = flightLegs[i];
          const legReq = await fetch('/api/flight-legs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              flight_id: formData.id,
              route_id: leg.route_id,
              leg_sequence_no: i + 1,
              takeoff_time: leg.takeoff_time,
              landing_time: leg.landing_time,
              leg_status: 'Scheduled'
            })
          });
          const legResult = await legReq.json();
          if (!legReq.ok) throw new Error(`Leg ${i+1} error: ${legResult.error}`);
        }
      }

      setFormData({ id: '', aircraft_id: '', source_airport_id: '', dest_airport_id: '' });
      setFlightLegs([]);
      setEditingFlight(null);
      fetchFlights();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="animate-fade">
      <h1>Flights Management</h1>
      <div className="card" style={{ marginBottom: '2rem', position: 'relative', zIndex: 50 }}>
        <h2>{editingFlight ? 'Update Flight' : 'Add New Flight'}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div className="form-group"><label>Flight ID</label><input type="number" name="id" value={formData.id} onChange={handleInputChange} required disabled={!!editingFlight} /></div>
          <AsyncSelect
            label="Aircraft Assignment"
            fetchUrl="/api/aircrafts"
            valueKey="aircraft_id"
            labelKey="model"
            extraKey="status_type"
            value={formData.aircraft_id}
            onChange={(val) => setFormData(prev => ({ ...prev, aircraft_id: val }))}
            placeholder="Select available aircraft..."
            isOptionDisabled={(opt) => String(opt.extra?.code || '').toUpperCase() !== 'AVAILABLE'}
            renderOption={(opt) => {
              const status = String(opt.extra?.code || '').toUpperCase();
              return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>{opt.label} <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>(ID: {opt.value})</span></span>
                <span style={{ 
                  fontSize: '0.65rem', padding: '4px 8px', borderRadius: '8px', fontWeight: 'bold', letterSpacing: '0.5px',
                  backgroundColor: status === 'AVAILABLE' ? 'rgba(76, 175, 80, 0.15)' : (status === 'MAINTENANCE' ? 'rgba(255, 152, 0, 0.15)' : 'rgba(255, 69, 69, 0.15)'),
                  color: status === 'AVAILABLE' ? '#4caf50' : (status === 'MAINTENANCE' ? '#ff9800' : '#ff4545'),
                  border: `1px solid ${status === 'AVAILABLE' ? '#4caf50' : (status === 'MAINTENANCE' ? '#ff9800' : '#ff4545')}40`
                }}>
                  {status}
                </span>
              </div>
              );
            }}
          />
          
          <AsyncSelect 
            label="Source Airport" 
            fetchUrl="/api/airports"
            valueKey="airport_id"
            labelKey="airport_name"
            extraKey="iata_code"
            value={formData.source_airport_id} 
            onChange={(val) => setFormData(prev => ({ ...prev, source_airport_id: val }))} 
            disabledOptions={formData.dest_airport_id ? [Number(formData.dest_airport_id), String(formData.dest_airport_id)] : []}
            placeholder="Select Source..."
          />
          
          <AsyncSelect 
            label="Destination Airport" 
            fetchUrl="/api/airports"
            valueKey="airport_id"
            labelKey="airport_name"
            extraKey="iata_code"
            value={formData.dest_airport_id} 
            onChange={(val) => setFormData(prev => ({ ...prev, dest_airport_id: val }))} 
            disabledOptions={formData.source_airport_id ? [Number(formData.source_airport_id), String(formData.source_airport_id)] : []}
            placeholder="Select Destination..."
          />

          <div style={{ gridColumn: 'span 3', marginTop: '0.5rem' }}>
            <button 
              type="button" 
              onClick={() => setShowRouteSelector(true)}
              disabled={!formData.source_airport_id || !formData.dest_airport_id || !!editingFlight}
              style={{ background: 'var(--primary)', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: (!formData.source_airport_id || !formData.dest_airport_id || !!editingFlight) ? 'not-allowed' : 'pointer', opacity: (!formData.source_airport_id || !formData.dest_airport_id || !!editingFlight) ? 0.5 : 1 }}
            >
              🔍 Find Routes
            </button>
          </div>

          <div style={{ gridColumn: 'span 3' }}>
            {showRouteSelector && (
              <RouteSelector 
                sourceId={formData.source_airport_id} 
                destId={formData.dest_airport_id} 
                onSelectPath={(path) => {
                  const newLegs = path.map(r => ({ ...r, id: Math.random().toString(36).substring(7), takeoff_time: '', landing_time: '' }));
                  setFlightLegs(newLegs);
                  setShowRouteSelector(false);
                }}
                onCancel={() => setShowRouteSelector(false)}
              />
            )}
            
            <FlightLegEditor legs={flightLegs} setLegs={setFlightLegs} />
          </div>

          <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit">{editingFlight ? 'Update Flight' : 'Set Data'}</button>
            {editingFlight && <button type="button" className="btn-secondary" onClick={() => { setEditingFlight(null); setFormData({ id: '', aircraft_id: '', source_airport_id: '', dest_airport_id: '' }); setFlightLegs([]); }}>Cancel</button>}
          </div>
          {error && <div style={{ gridColumn: 'span 3', color: '#ff4545' }}>❌ Error: {error}</div>}
        </form>
      </div>
      <div className="card">
        {isLoading ? <p>Loading...</p> : <DataTable onDelete={handleDelete} columns={columns} data={flights} onEdit={handleEdit} />}
      </div>
    </div>
  );
}
