import { NextRequest, NextResponse } from 'next/server';
import { getClipById } from '@/lib/database';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await params;
    const clip = getClipById(clipId);
    
    if (!clip) {
      return NextResponse.json(
        { error: 'Clip not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(clip);
  } catch (error) {
    console.error('Failed to fetch clip:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clip' },
      { status: 500 }
    );
  }
}