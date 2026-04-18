import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await query('SELECT * FROM Crew ORDER BY Crew_ID');
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request) {
  try {
    const { id, name, role, experience, language_proficiency } = await request.json();

    if (!id || !name || !role || experience === undefined || !language_proficiency) {
      return NextResponse.json({ error: 'All crew fields are required.' }, { status: 400 });
    }

    await query(
      `INSERT INTO Crew (Crew_ID, Name, Role, Experience, Language_Proficiency)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, name, role, experience, language_proficiency]
    );
    return NextResponse.json({ message: 'Crew member added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request) {
  try {
    const { id, name, role, experience, language_proficiency } = await request.json();

    await query(
      `UPDATE Crew SET Name=$2, Role=$3, Experience=$4, Language_Proficiency=$5
       WHERE Crew_ID=$1`,
      [id, name, role, experience, language_proficiency]
    );
    return NextResponse.json({ message: 'Crew member updated successfully' });
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

    await query('DELETE FROM Crew WHERE Crew_ID=$1', [id]);
    return NextResponse.json({ message: 'Crew deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
