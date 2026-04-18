import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const start = Date.now();
    const result = await query('SELECT NOW() as db_time');
    const end = Date.now();

    return NextResponse.json({
      status: 'connected',
      message: 'Successfully reached college server!',
      db_time: result.rows[0].db_time,
      latency_ms: end - start,
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to connect to database',
      error: error.message,
      tip: 'Check your credentials in .env.local and ensure the server firewall allows your IP.'
    }, { status: 500 });
  }
}
