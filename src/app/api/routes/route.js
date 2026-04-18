import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await query(
      `SELECT r.*, s.IATA_Code AS source_iata, d.IATA_Code AS dest_iata
       FROM Route r
       JOIN Airport s ON r.Source_Airport_ID = s.Airport_ID
       JOIN Airport d ON r.Dest_Airport_ID   = d.Airport_ID
       ORDER BY r.Route_ID`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request) {
  try {
    const { id, distance, estimated_duration, source_airport_id, dest_airport_id } = await request.json();

    if (!id || !distance || !estimated_duration || !source_airport_id || !dest_airport_id) {
      return NextResponse.json({ error: 'All route fields are required.' }, { status: 400 });
    }

    await query(
      `INSERT INTO Route (Route_ID, Distance, Estimated_Duration, Source_Airport_ID, Dest_Airport_ID)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, distance, estimated_duration, source_airport_id, dest_airport_id]
    );
    return NextResponse.json({ message: 'Route added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request) {
  try {
    const { id, distance, estimated_duration, source_airport_id, dest_airport_id } = await request.json();

    await query(
      `UPDATE Route SET Distance=$2, Estimated_Duration=$3, Source_Airport_ID=$4, Dest_Airport_ID=$5
       WHERE Route_ID=$1`,
      [id, distance, estimated_duration, source_airport_id, dest_airport_id]
    );
    return NextResponse.json({ message: 'Route updated successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await query('DELETE FROM Route WHERE Route_ID=$1', [id]);
    return NextResponse.json({ message: 'Route deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
