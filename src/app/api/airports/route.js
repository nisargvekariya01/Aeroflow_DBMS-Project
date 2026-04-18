import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/airports — calls stored function get_airports()
export async function GET() {
  try {
    const result = await query('SELECT * FROM get_airports()');
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// POST /api/airports — insert_airport() validates required fields, dup ID, and unique IATA code
export async function POST(request) {
  try {
    const { id, name, city, state, country, iata_code } = await request.json();

    if (!id || !name || !city || !state || !country || !iata_code) {
      return NextResponse.json({ error: 'All airport fields are required.' }, { status: 400 });
    }

    await query(
      'SELECT insert_airport($1,$2,$3,$4,$5,$6)',
      [id, name, city, state, country, iata_code]
    );
    return NextResponse.json({ message: 'Airport added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// PUT /api/airports — simple field update (no multi-step logic needed)
export async function PUT(request) {
  try {
    const { id, name, city, state, country, iata_code } = await request.json();

    await query(
      `UPDATE Airport SET Airport_Name=$2, City=$3, State=$4, Country=$5, IATA_Code=$6
       WHERE Airport_ID = $1`,
      [id, name, city, state, country, iata_code]
    );
    return NextResponse.json({ message: 'Airport updated successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// DELETE /api/airports?id=X
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await query('DELETE FROM Airport WHERE Airport_ID = $1', [id]);
    return NextResponse.json({ message: 'Airport deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
