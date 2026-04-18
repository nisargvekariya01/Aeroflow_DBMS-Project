import { query, handleDbError } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/bookings — calls stored function get_bookings()
export async function GET() {
  try {
    const result = await query('SELECT * FROM get_bookings()');
    return NextResponse.json(result.rows);
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// POST /api/bookings — insert_booking() validates:
//   • Flight leg existence
//   • Seat capacity via fn_check_seat_available()
//   • Duplicate seat number on same leg
//   • Seat type (Economy / Business only)
export async function POST(request) {
  try {
    const { id, flight_id, route_id, leg_sequence_no, user_id,
            seat_type, seat_number, booking_date, booking_status,
            booking_sequence_no } = await request.json();

    if (!id || !flight_id || !route_id || !leg_sequence_no || !user_id ||
        !seat_type || !seat_number || !booking_date || !booking_status || !booking_sequence_no) {
      return NextResponse.json({ error: 'All booking fields are required.' }, { status: 400 });
    }

    await query(
      'SELECT insert_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [id, flight_id, route_id, leg_sequence_no, user_id,
       seat_type, seat_number, booking_date, booking_status, booking_sequence_no]
    );
    return NextResponse.json({ message: 'Booking added successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// PUT /api/bookings — simple field update
// Note: trg_audit_booking_status prevents Cancelled → Confirmed regressions in DB.
export async function PUT(request) {
  try {
    const { id, flight_id, route_id, leg_sequence_no, user_id,
            seat_type, seat_number, booking_date, booking_status,
            booking_sequence_no } = await request.json();

    await query(
      `UPDATE Booking
       SET Flight_ID=$2, Route_ID=$3, Leg_Sequence_No=$4, User_ID=$5,
           Seat_Type=$6, Seat_Number=$7, Booking_Date=$8,
           Bookng_Status=$9, Booking_Sequence_No=$10
       WHERE Booking_ID = $1`,
      [id, flight_id, route_id, leg_sequence_no, user_id,
       seat_type, seat_number, booking_date, booking_status, booking_sequence_no]
    );
    return NextResponse.json({ message: 'Booking updated successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}

// DELETE /api/bookings?id=X
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await query('DELETE FROM Booking WHERE Booking_ID = $1', [id]);
    return NextResponse.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    const { status, body } = handleDbError(error);
    return NextResponse.json(body, { status });
  }
}
