import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await query(
      `SELECT ur.*, a.IATA_Code AS airport_iata
       FROM Uses_Runway ur
       JOIN Airport a ON ur.Airport_ID = a.Airport_ID
       ORDER BY ur.Flight_ID, ur.Route_ID, ur.Leg_Sequence_No`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request) {
  try {
    const { flight_id, route_id, leg_sequence_no, airport_id, runway_id, usage_type } = await request.json();

    if (!flight_id || !route_id || !leg_sequence_no || !airport_id || !runway_id || !usage_type) {
      return NextResponse.json({ error: 'All runway usage fields are required.' }, { status: 400 });
    }

    await query(
      `INSERT INTO Uses_Runway (Flight_ID, Route_ID, Leg_Sequence_No, Airport_ID, Runway_ID, Usage_Type)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [flight_id, route_id, leg_sequence_no, airport_id, runway_id, usage_type]
    );
    return NextResponse.json({ message: 'Runway usage record added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request) {
  try {
    const { flight_id, route_id, leg_sequence_no, airport_id, runway_id, usage_type } = await request.json();

    await query(
      `UPDATE Uses_Runway SET Usage_Type=$6
       WHERE Flight_ID=$1 AND Route_ID=$2 AND Leg_Sequence_No=$3 AND Airport_ID=$4 AND Runway_ID=$5`,
      [flight_id, route_id, leg_sequence_no, airport_id, runway_id, usage_type]
    );
    return NextResponse.json({ message: 'Runway usage record updated successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const flight_id      = searchParams.get('flight_id');
    const route_id       = searchParams.get('route_id');
    const leg_sequence_no = searchParams.get('leg_sequence_no');
    const airport_id     = searchParams.get('airport_id');
    const runway_id      = searchParams.get('runway_id');

    if (!flight_id || !route_id || !leg_sequence_no || !airport_id || !runway_id) {
      return NextResponse.json(
        { error: 'All primary keys (flight_id, route_id, leg_sequence_no, airport_id, runway_id) are required' },
        { status: 400 }
      );
    }

    await query(
      `DELETE FROM Uses_Runway
       WHERE Flight_ID=$1 AND Route_ID=$2 AND Leg_Sequence_No=$3 AND Airport_ID=$4 AND Runway_ID=$5`,
      [flight_id, route_id, leg_sequence_no, airport_id, runway_id]
    );
    return NextResponse.json({ message: 'Uses_Runway deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
