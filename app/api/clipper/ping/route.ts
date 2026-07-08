import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({ ok: true, server: 'edward-clipper', time: new Date().toISOString() });
  } catch (err) {
    console.error('[API /clipper/ping] GET', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
