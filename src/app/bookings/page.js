'use client';
import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';
import AsyncSelect from '@/components/AsyncSelect';
import BookingFlightSelector from '@/components/bookings/BookingFlightSelector';

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [showFlightSelector, setShowFlightSelector] = useState(false);
  const [selectedLegs, setSelectedLegs] = useState([]);
  const [formData, setFormData] = useState({
    id: '', flight_id: '', route_id: '', leg_sequence_no: '', booking_sequence_no: '',
    source_airport_id: '', dest_airport_id: '', // Used for search
    user_id: '', seat_type: 'Economy', seat_number: '', booking_date: '', booking_status: 'Confirmed'
  });

  const columns = [
    { key: 'booking_id', label: 'ID' },
    { key: 'user_id', label: 'User' },
    { key: 'flight_id', label: 'Flight' },
    { key: 'seat_number', label: 'Seat' },
    { key: 'bookng_status', label: 'Status' },
  ];

  const fetchBookings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBookings(data);
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchBookings(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (b) => {
    setEditingBooking(b);
    setSelectedLegs([]); // Clear selection when editing
    setFormData({
      id: b.booking_id,
      flight_id: b.flight_id,
      route_id: b.route_id,
      leg_sequence_no: b.leg_sequence_no,
      booking_sequence_no: b.booking_sequence_no,
      source_airport_id: '', dest_airport_id: '',
      user_id: b.user_id,
      seat_type: b.seat_type,
      seat_number: b.seat_number,
      booking_date: b.booking_date?.split('T')[0] || '',
      booking_status: b.bookng_status,
    });
  };

  
  const handleDelete = async (row) => {
    try {
      const res = await fetch(`/api/bookings?id=${row.booking_id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete');
      fetchBookings();
    } catch (err) {
      if (typeof setError === 'function') setError(err.message);
      else alert("Error: " + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (!editingBooking && selectedLegs.length === 0) {
        throw new Error('You must find and select a flight route before booking.');
      }

      if (editingBooking) {
        // Just update the single booking record
        const res = await fetch('/api/bookings', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
      } else {
        // Insert N booking rows for N flight legs selected
        for (let i = 0; i < selectedLegs.length; i++) {
          const leg = selectedLegs[i];
          const payload = {
            ...formData,
            id: Math.floor(Math.random() * 900000000), // Secure 9-digit random ID
            flight_id: leg.flight_id,
            route_id: leg.route_id,
            leg_sequence_no: leg.leg_sequence_no,
            booking_sequence_no: i + 1
          };
          
          const res = await fetch('/api/bookings', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(`Error on Leg ${i+1}: ${result.error}`);
        }
      }

      setFormData({ id: '', flight_id: '', route_id: '', leg_sequence_no: '', booking_sequence_no: '', source_airport_id: '', dest_airport_id: '', user_id: '', seat_type: 'Economy', seat_number: '', booking_date: '', booking_status: 'Confirmed' });
      setSelectedLegs([]);
      setEditingBooking(null);
      fetchBookings();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="animate-fade">
      <h1>Bookings Management</h1>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>{editingBooking ? 'Update Booking' : 'Add New Booking'}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          
          {!editingBooking && (
            <>
              <AsyncSelect 
                label="Source Airport" fetchUrl="/api/airports" valueKey="airport_id" labelKey="airport_name" extraKey="iata_code"
                value={formData.source_airport_id} onChange={(val) => setFormData(prev => ({ ...prev, source_airport_id: val }))} 
                disabledOptions={formData.dest_airport_id ? [Number(formData.dest_airport_id), String(formData.dest_airport_id)] : []}
                placeholder="Where from?"
              />
              <AsyncSelect 
                label="Destination Airport" fetchUrl="/api/airports" valueKey="airport_id" labelKey="airport_name" extraKey="iata_code"
                value={formData.dest_airport_id} onChange={(val) => setFormData(prev => ({ ...prev, dest_airport_id: val }))} 
                disabledOptions={formData.source_airport_id ? [Number(formData.source_airport_id), String(formData.source_airport_id)] : []}
                placeholder="Where to?"
              />
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowFlightSelector(true)}
                  disabled={!formData.source_airport_id || !formData.dest_airport_id}
                  style={{ background: 'var(--primary)', color: 'white', padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: (!formData.source_airport_id || !formData.dest_airport_id) ? 'not-allowed' : 'pointer', opacity: (!formData.source_airport_id || !formData.dest_airport_id) ? 0.5 : 1, width: '100%', fontWeight: 'bold', minHeight: '44px' }}
                >
                  🔍 Find Routes
                </button>
              </div>

              <div style={{ gridColumn: 'span 3' }}>
                {showFlightSelector && (
                  <BookingFlightSelector 
                    sourceId={formData.source_airport_id} destId={formData.dest_airport_id}
                    onSelectPath={(path) => { setSelectedLegs(path); setShowFlightSelector(false); }}
                    onCancel={() => setShowFlightSelector(false)}
                  />
                )}
                {selectedLegs.length > 0 && !showFlightSelector && (
                  <div style={{ background: 'rgba(76, 175, 80, 0.1)', padding: '10px 16px', borderRadius: '10px', border: '1px solid #4caf50', color: '#4caf50', marginTop: '0.5rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                    <span>✅ Selected a journey with {selectedLegs.length} flight leg(s).</span>
                    <button type="button" onClick={() => setSelectedLegs([])} style={{ background: 'transparent', border: 'none', color: '#ff4545', cursor: 'pointer', fontWeight: 'bold' }}>Clear Selection</button>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="form-group"><label>User ID</label><input type="number" name="user_id" value={formData.user_id} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Seat Type</label><select name="seat_type" value={formData.seat_type} onChange={handleInputChange}><option value="Economy">Economy</option><option value="Business">Business</option></select></div>
          <div className="form-group"><label>Seat No</label><input type="text" name="seat_number" value={formData.seat_number} onChange={handleInputChange} required /></div>
          
          <div className="form-group"><label>Date</label><input type="date" name="booking_date" value={formData.booking_date} onChange={handleInputChange} required /></div>
          <div className="form-group"><label>Status</label><select name="booking_status" value={formData.booking_status} onChange={handleInputChange}><option value="Confirmed">Confirmed</option><option value="Cancelled">Cancelled</option><option value="Pending">Pending</option></select></div>
          
          {editingBooking && (
            <div style={{ gridColumn: 'span 3', background: 'rgba(255,255,255,0.05)', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
              Cannot alter physical flight routing attributes (`Flight_ID`, `Route_ID`, etc) during an active ticket edit. Please cancel and rebook to fundamentally change the itinerary.
            </div>
          )}

          <div style={{ gridColumn: 'span 3', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit">{editingBooking ? 'Update Booking' : 'Book Flights'}</button>
            {editingBooking && <button type="button" className="btn-secondary" onClick={() => { setEditingBooking(null); setFormData({ id: '', flight_id: '', route_id: '', leg_sequence_no: '', booking_sequence_no: '', source_airport_id: '', dest_airport_id: '', user_id: '', seat_type: 'Economy', seat_number: '', booking_date: '', booking_status: 'Confirmed' }); }}>Cancel</button>}
          </div>

          {error && <div style={{ gridColumn: 'span 3', color: '#ff4545', padding: '10px', background: 'rgba(255,69,69,0.1)', borderRadius: '8px' }}>❌ Error: {error}</div>}
        </form>
      </div>
      <div className="card">
        {isLoading ? <p>Loading...</p> : <DataTable onDelete={handleDelete} columns={columns} data={bookings} onEdit={handleEdit} />}
      </div>
    </div>
  );
}
