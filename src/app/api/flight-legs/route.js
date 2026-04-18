import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/flight-legs — calls stored function get_flight_legs()
export async function GET() {
  try {
    const result = await query('SELECT * FROM get_flight_legs()');
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// POST /api/flight-legs — insert_flight_leg() validates:
//   • All fields required
//   • Landing time > takeoff time
//   • Parent flight existence
//   • Parent route existence
//   • Duplicate leg (flight_id, route_id, leg_sequence_no)
export async function POST(request) {
  try {
    const { flight_id, route_id, leg_sequence_no,
            takeoff_time, landing_time, leg_status } = await request.json();

    if (!flight_id || !route_id || !leg_sequence_no ||
        !takeoff_time || !landing_time || !leg_status) {
      return NextResponse.json({ error: 'All flight leg fields are required.' }, { status: 400 });
    }

    await query(
      'SELECT insert_flight_leg($1,$2,$3,$4,$5,$6)',
      [flight_id, route_id, leg_sequence_no, takeoff_time, landing_time, leg_status]
    );
    return NextResponse.json({ message: 'Flight leg added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// PUT /api/flight-legs — simple field update
// trg_validate_leg_times ensures landing > takeoff in the DB.
export async function PUT(request) {
  try {
    const { flight_id, route_id, leg_sequence_no,
            takeoff_time, landing_time, leg_status } = await request.json();

    await query(
      `UPDATE Flight_Legs
       SET Takeoff_Time=$4, Landing_Time=$5, Leg_Status=$6
       WHERE Flight_ID=$1 AND Route_ID=$2 AND Leg_Sequence_No=$3`,
      [flight_id, route_id, leg_sequence_no, takeoff_time, landing_time, leg_status]
    );
    return NextResponse.json({ message: 'Flight leg updated successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
