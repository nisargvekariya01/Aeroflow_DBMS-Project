import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await query(
      `SELECT r.*, a.IATA_Code AS airport_iata
       FROM Runway r
       JOIN Airport a ON r.Airport_ID = a.Airport_ID
       ORDER BY r.Airport_ID, r.Runway_ID`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request) {
  try {
    const { airport_id, runway_id, surface_type, runway_length, status } = await request.json();

    if (!airport_id || !runway_id || !surface_type || !runway_length || !status) {
      return NextResponse.json({ error: 'All runway fields are required.' }, { status: 400 });
    }

    await query(
      `INSERT INTO Runway (Airport_ID, Runway_ID, Surface_Type, Runway_Length, Status)
       VALUES ($1,$2,$3,$4,$5)`,
      [airport_id, runway_id, surface_type, runway_length, status]
    );
    return NextResponse.json({ message: 'Runway added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request) {
  try {
    const { airport_id, runway_id, surface_type, runway_length, status } = await request.json();

    await query(
      `UPDATE Runway SET Surface_Type=$3, Runway_Length=$4, Status=$5
       WHERE Airport_ID=$1 AND Runway_ID=$2`,
      [airport_id, runway_id, surface_type, runway_length, status]
    );
    return NextResponse.json({ message: 'Runway updated successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const airport_id = searchParams.get('airport_id');
    const runway_id  = searchParams.get('runway_id');

    if (!airport_id || !runway_id) {
      return NextResponse.json(
        { error: 'All primary keys (airport_id, runway_id) are required' },
        { status: 400 }
      );
    }

    await query('DELETE FROM Runway WHERE Airport_ID=$1 AND Runway_ID=$2', [airport_id, runway_id]);
    return NextResponse.json({ message: 'Runway deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
