import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/crew-assign — plain SELECT
export async function GET() {
  try {
    const result = await query(
      'SELECT * FROM Crew_Assign ORDER BY Flight_ID, Route_ID, Leg_Sequence_No, Crew_ID'
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// POST /api/crew-assign — assign_crew() validates:
//   • Required fields present
//   • Flight leg existence
//   • Crew member existence
//   • Duplicate assignment guard
export async function POST(request) {
  try {
    const { flight_id, route_id, leg_sequence_no, crew_id } = await request.json();

    if (!flight_id || !route_id || !leg_sequence_no || !crew_id) {
      return NextResponse.json({ error: 'All assignment fields are required.' }, { status: 400 });
    }

    await query(
      'SELECT assign_crew($1,$2,$3,$4)',
      [flight_id, route_id, leg_sequence_no, crew_id]
    );
    return NextResponse.json({ message: 'Crew member assigned successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// DELETE /api/crew-assign?flight_id=X&route_id=Y&leg_sequence_no=Z&crew_id=W
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const flight_id      = searchParams.get('flight_id');
    const route_id       = searchParams.get('route_id');
    const leg_sequence_no = searchParams.get('leg_sequence_no');
    const crew_id        = searchParams.get('crew_id');

    if (!flight_id || !route_id || !leg_sequence_no || !crew_id) {
      return NextResponse.json(
        { error: 'All primary keys (flight_id, route_id, leg_sequence_no, crew_id) are required' },
        { status: 400 }
      );
    }

    await query(
      'DELETE FROM Crew_Assign WHERE Flight_ID=$1 AND Route_ID=$2 AND Leg_Sequence_No=$3 AND Crew_ID=$4',
      [flight_id, route_id, leg_sequence_no, crew_id]
    );
    return NextResponse.json({ message: 'Crew_Assign deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
