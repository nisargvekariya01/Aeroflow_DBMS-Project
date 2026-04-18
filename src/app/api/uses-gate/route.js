import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await query(
      `SELECT ug.*, a.IATA_Code AS airport_iata
       FROM Uses_Gate ug
       JOIN Airport a ON ug.Airport_ID = a.Airport_ID
       ORDER BY ug.Flight_ID, ug.Route_ID, ug.Leg_Sequence_No`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request) {
  try {
    const { flight_id, route_id, leg_sequence_no, airport_id, gate_no, usage_type } = await request.json();

    if (!flight_id || !route_id || !leg_sequence_no || !airport_id || !gate_no || !usage_type) {
      return NextResponse.json({ error: 'All gate usage fields are required.' }, { status: 400 });
    }

    await query(
      `INSERT INTO Uses_Gate (Flight_ID, Route_ID, Leg_Sequence_No, Airport_ID, Gate_No, Usage_Type)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [flight_id, route_id, leg_sequence_no, airport_id, gate_no, usage_type]
    );
    return NextResponse.json({ message: 'Gate usage record added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request) {
  try {
    const { flight_id, route_id, leg_sequence_no, airport_id, gate_no, usage_type } = await request.json();

    await query(
      `UPDATE Uses_Gate SET Usage_Type=$6
       WHERE Flight_ID=$1 AND Route_ID=$2 AND Leg_Sequence_No=$3 AND Airport_ID=$4 AND Gate_No=$5`,
      [flight_id, route_id, leg_sequence_no, airport_id, gate_no, usage_type]
    );
    return NextResponse.json({ message: 'Gate usage record updated successfully' });
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
    const gate_no        = searchParams.get('gate_no');

    if (!flight_id || !route_id || !leg_sequence_no || !airport_id || !gate_no) {
      return NextResponse.json(
        { error: 'All primary keys (flight_id, route_id, leg_sequence_no, airport_id, gate_no) are required' },
        { status: 400 }
      );
    }

    await query(
      `DELETE FROM Uses_Gate
       WHERE Flight_ID=$1 AND Route_ID=$2 AND Leg_Sequence_No=$3 AND Airport_ID=$4 AND Gate_No=$5`,
      [flight_id, route_id, leg_sequence_no, airport_id, gate_no]
    );
    return NextResponse.json({ message: 'Uses_Gate deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
