import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/airlines — calls stored function get_airlines()
export async function GET() {
  try {
    const result = await query('SELECT * FROM get_airlines()');
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// POST /api/airlines — delegates all validation & duplicate checks to insert_airline()
export async function POST(request) {
  try {
    const { id, name, country, headquarters, email, iata } = await request.json();

    if (!id || !name || !country || !headquarters || !email || !iata) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    await query(
      'SELECT insert_airline($1, $2, $3, $4, $5, $6)',
      [id, name, country, headquarters, email, iata]
    );
    return NextResponse.json({ message: 'Airline added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// PUT /api/airlines — delegates to update_airline()
export async function PUT(request) {
  try {
    const { id, name, country, headquarters, email, iata } = await request.json();

    if (!id || !name || !country || !headquarters || !email || !iata) {
      return NextResponse.json({ error: 'All fields are required for update.' }, { status: 400 });
    }

    await query(
      'SELECT update_airline($1, $2, $3, $4, $5, $6)',
      [id, name, country, headquarters, email, iata]
    );
    return NextResponse.json({ message: 'Airline updated successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// DELETE /api/airlines?id=X — delegates to delete_airline()
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await query('SELECT delete_airline($1)', [id]);
    return NextResponse.json({ message: 'Airline deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
