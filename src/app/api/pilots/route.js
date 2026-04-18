import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await query('SELECT * FROM Pilot ORDER BY Pilot_ID');
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request) {
  try {
    const { id, name, license_number, email, experience_level } = await request.json();

    if (!id || !name || !license_number || !email || !experience_level) {
      return NextResponse.json({ error: 'All pilot fields are required.' }, { status: 400 });
    }

    await query(
      `INSERT INTO Pilot (Pilot_ID, Name, License_Number, Email, Experience_Level)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, name, license_number, email, experience_level]
    );
    return NextResponse.json({ message: 'Pilot added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request) {
  try {
    const { id, name, license_number, email, experience_level } = await request.json();

    await query(
      `UPDATE Pilot SET Name=$2, License_Number=$3, Email=$4, Experience_Level=$5
       WHERE Pilot_ID=$1`,
      [id, name, license_number, email, experience_level]
    );
    return NextResponse.json({ message: 'Pilot updated successfully' });
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

    await query('DELETE FROM Pilot WHERE Pilot_ID=$1', [id]);
    return NextResponse.json({ message: 'Pilot deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
