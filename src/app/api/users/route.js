import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/users — calls stored function get_users()
export async function GET() {
  try {
    const result = await query('SELECT * FROM get_users()');
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// POST /api/users — insert_user() validates required fields, dup ID, and unique email
export async function POST(request) {
  try {
    const { id, name, email, phone, address } = await request.json();

    if (!id || !name || !email || !phone || !address) {
      return NextResponse.json({ error: 'All user fields are required.' }, { status: 400 });
    }

    await query(
      'SELECT insert_user($1,$2,$3,$4,$5)',
      [id, name, email, phone, address]
    );
    return NextResponse.json({ message: 'User added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// PUT /api/users — simple field update
export async function PUT(request) {
  try {
    const { id, name, email, phone, address } = await request.json();

    await query(
      `UPDATE "User" SET Name=$2, Email=$3, Phone=$4, Address=$5
       WHERE User_ID = $1`,
      [id, name, email, phone, address]
    );
    return NextResponse.json({ message: 'User updated successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// DELETE /api/users?id=X
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await query('DELETE FROM "User" WHERE User_ID = $1', [id]);
    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
