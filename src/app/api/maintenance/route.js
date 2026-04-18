import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/maintenance — calls stored function get_maintenance()
export async function GET() {
  try {
    const result = await query('SELECT * FROM get_maintenance()');
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// POST /api/maintenance — insert_maintenance() validates:
//   • All required fields present
//   • Aircraft existence
//   • Duplicate maintenance ID
//   • Completion date >= start date
// Aircraft status sync (Completed→AVAILABLE, other→INACTIVE) is handled
// automatically by trigger trg_maintenance_status_sync. No JS status logic.
export async function POST(request) {
  try {
    const { id, aircraft_id, type, notes, status,
            scheduled_date, start_date, completion_date, total_cost } = await request.json();

    if (!id || !aircraft_id || !type || !status || !scheduled_date) {
      return NextResponse.json(
        { error: 'Maintenance ID, Aircraft, Type, Status, and Scheduled Date are required.' },
        { status: 400 }
      );
    }

    await query(
      'SELECT insert_maintenance($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [id, aircraft_id, type, notes || null, status,
       scheduled_date, start_date || null, completion_date || null, total_cost || null]
    );
    return NextResponse.json({ message: 'Maintenance record added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// PUT /api/maintenance — update_maintenance() handles aircraft swap:
//   • Old aircraft restored to AVAILABLE if reassigned
//   • New aircraft status updated via trigger
// Replaces the multi-step JS aircraft swap logic.
export async function PUT(request) {
  try {
    const { id, aircraft_id, type, notes, status,
            scheduled_date, start_date, completion_date, total_cost } = await request.json();

    await query(
      'SELECT update_maintenance($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [id, aircraft_id, type, notes || null, status,
       scheduled_date, start_date || null, completion_date || null, total_cost || null]
    );
    return NextResponse.json({ message: 'Maintenance record updated successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// DELETE /api/maintenance?id=X
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await query('DELETE FROM Maintenance WHERE Maintenance_ID = $1', [id]);
    return NextResponse.json({ message: 'Maintenance deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
