import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { handleRouteError } from '@/lib/apiError';
import { auditDocAccess } from '@/lib/docAccess';
import { isBlobConfigured, putObject } from '@/lib/blob';
import { insertClip } from '@/lib/database';
import { generateMultipagePDF } from '@/lib/pdfGenerator';

// Edward Clipper: Standalone web clipper with R2 storage
// When R2 is configured (CLOUDFLARE_R2_* + EDWARD_CLIPS_BUCKET), artifacts are stored in R2
// Otherwise falls back to local filesystem storage
const CLIPS_DIR = process.env.CLIPS_DIR || path.join(process.cwd(), 'data', 'clips');
// API key for extension authentication
const API_KEY = process.env.EDWARD_CLIPPER_KEY;

export async function POST(req: NextRequest) {
  // Validate API key
  const authKey = req.headers.get('x-clipper-key');
  if (!API_KEY) {
    return NextResponse.json(
      { error: 'Clipper disabled: EDWARD_CLIPPER_KEY is not configured' },
      { status: 503 }
    );
  }
  if (authKey !== API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      title, url, bodyText, headings, images, links, tables,
      meta, jsonLd, dataElements, html, screenshot, tag, capturedAt, format,
      pages, pageCount // New fields for multipage PDF
    } = body;

    // Handle multipage PDF generation
    if (format === 'multipage-pdf' && pages && Array.isArray(pages)) {
      return await handleMultipagePDF(pages, title, tag, url, req);
    }

    // Create timestamped folder: clips/2026-03-07/18-55-30_forge-stripe/
    const now = new Date(capturedAt || Date.now());
    const dateDir = now.toISOString().slice(0, 10); // 2026-03-07
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '-'); // 18-55-30
    
    // Sanitize tag and URL for folder name
    const urlSlug = (url || '')
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .slice(0, 80);
    const tagSlug = tag ? `_${tag.replace(/[^a-zA-Z0-9-]/g, '_')}` : '';
    const folderName = `${timeStr}${tagSlug}_${urlSlug}`;
    
    const useBlob = isBlobConfigured();
    const relativeDir = `clips/${dateDir}/${folderName}`;
    const clipDir = path.join(CLIPS_DIR, dateDir, folderName);

    // Build the artifacts once; persist them to R2 (when configured) or local FS.
    const artifacts: { name: string; body: Buffer | string; contentType: string }[] = [];

    if (screenshot) {
      const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '');
      artifacts.push({
        name: 'screenshot.png',
        body: Buffer.from(base64Data, 'base64'),
        contentType: 'image/png',
      });
    }
    if (html) {
      artifacts.push({ name: 'page.html', body: html, contentType: 'text/html; charset=utf-8' });
    }

    const content = {
      title,
      url,
      capturedAt: now.toISOString(),
      tag,
      meta,
      headings,
      tables,
      jsonLd,
      dataElements,
      images,
      links: links?.slice(0, 200), // cap links
    };
    artifacts.push({
      name: 'content.json',
      body: JSON.stringify(content, null, 2),
      contentType: 'application/json',
    });

    if (bodyText) {
      artifacts.push({ name: 'text.txt', body: bodyText, contentType: 'text/plain; charset=utf-8' });
    }

    const summary = [
      `# ${title || 'Untitled'}`,
      `**URL:** ${url}`,
      `**Captured:** ${now.toISOString()}`,
      tag ? `**Tag:** ${tag}` : '',
      '',
      '## Headings',
      ...(headings || []).map((h: any) => `${'#'.repeat(h.level)} ${h.text}`),
      '',
      '## Tables',
      ...(tables || []).map((t: any, i: number) => {
        const rows = t.map((r: string[]) => '| ' + r.join(' | ') + ' |').join('\n');
        return `### Table ${i + 1}\n${rows}`;
      }),
      '',
      `## Text (first 5000 chars)`,
      (bodyText || '').slice(0, 5000),
    ].filter(Boolean).join('\n');
    artifacts.push({ name: 'summary.md', body: summary, contentType: 'text/markdown; charset=utf-8' });

    const files = artifacts.map(a => a.name);

    if (useBlob) {
      // R2: PUT each artifact under clips/<date>/<folder>/<file>. No local
      // mkdir, no index.jsonl append (no persistent volume), and no chromium
      // PDF render (chromium is not in the cloud image; the render was always
      // best-effort).
      for (const a of artifacts) {
        const buf = typeof a.body === 'string' ? Buffer.from(a.body, 'utf-8') : a.body;
        await putObject(`${relativeDir}/${a.name}`, buf, a.contentType);
      }
    } else {
      // Local FS: byte-identical to before.
      fs.mkdirSync(clipDir, { recursive: true });
      for (const a of artifacts) {
        fs.writeFileSync(path.join(clipDir, a.name), a.body);
      }

      // Generate PDF if requested
      if (format === 'pdf' && html) {
        try {
          const htmlPath = path.join(clipDir, 'page.html');
          const pdfPath = path.join(clipDir, 'page.pdf');
          // Use Chromium headless to render HTML to PDF
          execSync(
            `/usr/bin/chromium-browser --headless --no-sandbox --disable-gpu --print-to-pdf="${pdfPath}" "file://${htmlPath}"`,
            { timeout: 30000, stdio: 'pipe' }
          );
          if (fs.existsSync(pdfPath)) files.push('page.pdf');
        } catch (pdfErr: any) {
          console.error('PDF generation error:', pdfErr.message);
          // Non-fatal: continue without PDF
        }
      }

      // Also append to a master index
      const indexPath = path.join(CLIPS_DIR, 'index.jsonl');
      const indexEntry = JSON.stringify({
        date: dateDir,
        time: timeStr,
        title,
        url,
        tag,
        folder: `${dateDir}/${folderName}`,
        capturedAt: now.toISOString(),
      });
      fs.appendFileSync(indexPath, indexEntry + '\n');
    }

    const relativePath = relativeDir;

    // Store clip metadata in database
    try {
      insertClip({
        url: url || '',
        title: title || 'Untitled',
        tag: tag || undefined,
        company: undefined, // Can be extracted later from domain/content
        file_path: relativePath
      });
    } catch (dbErr: any) {
      console.error('Database insert error (non-fatal):', dbErr.message);
    }

    // Audit logging: clip capture event
    auditDocAccess(req, `clip:${relativePath}`, '/api/clipper/capture');

    // `files` was built above from the artifacts actually persisted (+ page.pdf
    // when the local chromium render succeeded), so it reflects the real output
    // under both the R2 and local-FS paths.
    return NextResponse.json({
      ok: true,
      path: relativePath,
      files,
    });
  } catch (err: unknown) {
    return handleRouteError(err, 'Clipper capture error');
  }
}

// Next.js App Router: increase body size limit for screenshots + HTML
export const maxDuration = 30;

// Handler for multipage PDF generation
async function handleMultipagePDF(pages: any[], title: string, tag: string, url: string, req: NextRequest) {
  try {
    const now = new Date();
    const dateDir = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '-');
    
    const urlSlug = (url || '')
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .slice(0, 80);
    const tagSlug = tag ? `_${tag.replace(/[^a-zA-Z0-9-]/g, '_')}` : '';
    const folderName = `${timeStr}${tagSlug}_${urlSlug}`;
    
    const useBlob = isBlobConfigured();
    const relativeDir = `clips/${dateDir}/${folderName}`;
    
    // Generate PDF from all pages
    const pdfBuffer = await generateMultipagePDF(pages, title || 'Multipage Document');
    
    const artifacts = [
      {
        name: 'document.pdf',
        body: pdfBuffer,
        contentType: 'application/pdf',
      },
      {
        name: 'pages.json',
        body: JSON.stringify({ pages: pages.length, title, url, capturedAt: now.toISOString() }, null, 2),
        contentType: 'application/json',
      }
    ];

    if (useBlob) {
      // R2: PUT each artifact
      for (const a of artifacts) {
        const buf = typeof a.body === 'string' ? Buffer.from(a.body, 'utf-8') : a.body;
        await putObject(`${relativeDir}/${a.name}`, buf, a.contentType);
      }
    } else {
      // Local FS
      const clipDir = path.join(process.env.CLIPS_DIR || './data/clips', dateDir, folderName);
      fs.mkdirSync(clipDir, { recursive: true });
      for (const a of artifacts) {
        fs.writeFileSync(path.join(clipDir, a.name), a.body);
      }
    }

    // Store clip metadata in database
    const clipId = insertClip({
      url: url || '',
      title: title || 'Multipage Document',
      tag: tag || undefined,
      company: undefined,
      file_path: relativeDir
    });

    // Audit logging
    auditDocAccess(req, `multipage-pdf:${relativeDir}`, '/api/clipper/capture');

    return NextResponse.json({
      ok: true,
      path: relativeDir,
      files: artifacts.map(a => a.name),
      pages: pages.length,
      clipId,
      viewUrl: `/clips/view/${clipId}`
    });
  } catch (err: unknown) {
    return handleRouteError(err, 'Multipage PDF generation error');
  }
}

