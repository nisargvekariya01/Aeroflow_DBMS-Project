import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await query(
      `SELECT g.*, a.IATA_Code AS airport_iata
       FROM Gate g
       JOIN Airport a ON g.Airport_ID = a.Airport_ID
       ORDER BY g.Airport_ID, g.Gate_No`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request) {
  try {
    const { airport_id, gate_no, gate_status } = await request.json();

    if (!airport_id || !gate_no || !gate_status) {
      return NextResponse.json({ error: 'Airport ID, Gate No, and Status are required.' }, { status: 400 });
    }

    await query(
      `INSERT INTO Gate (Airport_ID, Gate_No, Gate_Status)
       VALUES ($1,$2,$3)`,
      [airport_id, gate_no, gate_status]
    );
    return NextResponse.json({ message: 'Gate added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request) {
  try {
    const { airport_id, gate_no, gate_status } = await request.json();

    await query(
      `UPDATE Gate SET Gate_Status=$3 WHERE Airport_ID=$1 AND Gate_No=$2`,
      [airport_id, gate_no, gate_status]
    );
    return NextResponse.json({ message: 'Gate updated successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const airport_id = searchParams.get('airport_id');
    const gate_no    = searchParams.get('gate_no');

    if (!airport_id || !gate_no) {
      return NextResponse.json(
        { error: 'All primary keys (airport_id, gate_no) are required' },
        { status: 400 }
      );
    }

    await query('DELETE FROM Gate WHERE Airport_ID=$1 AND Gate_No=$2', [airport_id, gate_no]);
    return NextResponse.json({ message: 'Gate deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
