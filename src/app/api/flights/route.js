import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/flights — uses get_flights() which returns v_flight_schedule view
// (includes source_iata, dest_iata, aircraft_model, airline_name, duration_hours)
export async function GET() {
  try {
    const result = await query('SELECT * FROM get_flights()');
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// POST /api/flights — insert_flight() validates aircraft availability.
// Aircraft status (AVAILABLE→ACTIVE) and flight hour tally are handled
// automatically by trigger trg_flight_after_insert in the DB.
export async function POST(request) {
  try {
    const { id, aircraft_id, departure_time, arrival_time,
            source_airport_id, dest_airport_id } = await request.json();

    if (!id || !aircraft_id || !departure_time || !arrival_time ||
        !source_airport_id || !dest_airport_id) {
      return NextResponse.json({ error: 'All flight fields are required.' }, { status: 400 });
    }

    await query(
      'SELECT insert_flight($1,$2,$3,$4,$5,$6)',
      [id, aircraft_id, departure_time, arrival_time, source_airport_id, dest_airport_id]
    );
    return NextResponse.json({ message: 'Flight added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// PUT /api/flights — update_flight() handles aircraft swapping, hour recalculation,
// and status transitions entirely inside the DB function.
// Replaces ~50 lines of JS aircraft-swap logic.
export async function PUT(request) {
  try {
    const { id, aircraft_id, departure_time, arrival_time,
            source_airport_id, dest_airport_id } = await request.json();

    await query(
      'SELECT update_flight($1,$2,$3,$4,$5,$6)',
      [id, aircraft_id, departure_time, arrival_time, source_airport_id, dest_airport_id]
    );
    return NextResponse.json({ message: 'Flight updated successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// DELETE /api/flights?id=X — cascade_delete_flight() atomically deletes
// the flight and all dependent rows (luggage, bookings, crew_assign,
// pilot_assign, uses_gate, uses_runway, flight_legs) in one DB transaction.
// Trigger trg_flight_after_delete restores aircraft to AVAILABLE.
// Replaces the 8-step manual JS cascade.
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await query('SELECT cascade_delete_flight($1)', [id]);
    return NextResponse.json({ message: 'Flight and all dependent records deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
