import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/luggage — plain SELECT
export async function GET() {
  try {
    const result = await query('SELECT * FROM Luggage ORDER BY Luggage_ID');
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// POST /api/luggage — insert_luggage() validates:
//   • All required fields present
//   • Weight > 0 and weight <= 50 kg (business rule)
//   • Booking existence
//   • Duplicate luggage ID
export async function POST(request) {
  try {
    const { id, booking_id, tag_number, weight } = await request.json();

    if (!id || !booking_id || !tag_number || !weight) {
      return NextResponse.json({ error: 'All luggage fields are required.' }, { status: 400 });
    }

    await query(
      'SELECT insert_luggage($1,$2,$3,$4)',
      [id, booking_id, tag_number, weight]
    );
    return NextResponse.json({ message: 'Luggage added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// PUT /api/luggage — simple field update
export async function PUT(request) {
  try {
    const { id, booking_id, tag_number, weight } = await request.json();

    await query(
      'UPDATE Luggage SET Booking_ID=$2, Tag_Number=$3, Weight=$4 WHERE Luggage_ID=$1',
      [id, booking_id, tag_number, weight]
    );
    return NextResponse.json({ message: 'Luggage updated successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// DELETE /api/luggage?id=X
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await query('DELETE FROM Luggage WHERE Luggage_ID=$1', [id]);
    return NextResponse.json({ message: 'Luggage deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
