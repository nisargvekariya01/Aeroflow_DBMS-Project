import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/aircrafts — returns enriched view (incl. airline_name, fuel_pct, total_seats)
export async function GET() {
  try {
    const result = await query('SELECT * FROM v_aircraft_detail ORDER BY aircraft_id');
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// POST /api/aircrafts — delegates validation (fuel check, airline FK, dup ID) to insert_aircraft()
export async function POST(request) {
  try {
    const { id, airline_id, model, manufacture_date, flight_hours, flight_cycle,
            eco_seats, bus_seats, fuel_capacity, fuel_level, location, status } = await request.json();

    if (!id || !airline_id || !model || !manufacture_date ||
        flight_hours === undefined || flight_cycle === undefined ||
        !eco_seats || !bus_seats || !fuel_capacity || !fuel_level || !location || !status) {
      return NextResponse.json({ error: 'Missing required aircraft data fields.' }, { status: 400 });
    }

    await query(
      'SELECT insert_aircraft($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [id, airline_id, model, manufacture_date, flight_hours, flight_cycle,
       eco_seats, bus_seats, fuel_capacity, fuel_level, location, status]
    );
    return NextResponse.json({ message: 'Aircraft added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// PUT /api/aircrafts — delegates to update_aircraft() (fuel validation inside)
export async function PUT(request) {
  try {
    const { id, airline_id, model, manufacture_date, flight_hours, flight_cycle,
            eco_seats, bus_seats, fuel_capacity, fuel_level, location, status } = await request.json();

    await query(
      'SELECT update_aircraft($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [id, airline_id, model, manufacture_date, flight_hours, flight_cycle,
       eco_seats, bus_seats, fuel_capacity, fuel_level, location, status]
    );
    return NextResponse.json({ message: 'Aircraft updated successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// DELETE /api/aircrafts?id=X — single atomic cascade via cascade_delete_aircraft()
// Replaces the 9-step manual JS cascade that previously ran outside a transaction.
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await query('SELECT cascade_delete_aircraft($1)', [id]);
    return NextResponse.json({ message: 'Aircraft and all dependent records deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
