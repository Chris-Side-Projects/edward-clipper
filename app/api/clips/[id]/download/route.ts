import { NextRequest, NextResponse } from 'next/server';
import { getClipById } from '@/lib/database';
import { isBlobConfigured, getObject } from '@/lib/blob';
import path from 'path';
import fs from 'fs';

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
    
    const useBlob = isBlobConfigured();
    let pdfBuffer: Buffer;
    
    if (useBlob) {
      // R2 storage
      try {
        pdfBuffer = await getObject(`${clip.file_path}/document.pdf`);
      } catch (err) {
        return NextResponse.json(
          { error: 'PDF file not found in storage' },
          { status: 404 }
        );
      }
    } else {
      // Local filesystem
      const pdfPath = path.join(process.env.CLIPS_DIR || './data/clips', clip.file_path, 'document.pdf');
      
      if (!fs.existsSync(pdfPath)) {
        return NextResponse.json(
          { error: 'PDF file not found on filesystem' },
          { status: 404 }
        );
      }
      
      pdfBuffer = fs.readFileSync(pdfPath);
    }
    
    // Return PDF with appropriate headers
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${clip.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('Failed to serve PDF:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve PDF' },
      { status: 500 }
    );
  }
}