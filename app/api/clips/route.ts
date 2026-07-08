import { NextResponse } from 'next/server';
import { getClips } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const clips = getClips(limit, offset);
    
    return NextResponse.json({
      clips,
      pagination: {
        limit,
        offset,
        hasMore: clips.length === limit
      }
    });
  } catch (error) {
    console.error('Failed to fetch clips:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clips' },
      { status: 500 }
    );
  }
}