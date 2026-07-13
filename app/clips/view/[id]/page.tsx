'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface ClipRecord {
  id: string;
  url: string;
  title: string;
  tag?: string;
  company?: string;
  file_path: string;
  created_at: string;
}

export default function ClipViewer() {
  const params = useParams();
  const clipId = params.id as string;
  const [clip, setClip] = useState<ClipRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!clipId) return;
    
    fetch(`/api/clips/${clipId}`)
      .then(res => {
        if (!res.ok) throw new Error('Clip not found');
        return res.json();
      })
      .then(data => {
        setClip(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [clipId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading clip...</div>
      </div>
    );
  }

  if (error || !clip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Clip Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'The requested clip does not exist.'}</p>
          <Link href="/clips" className="text-blue-600 hover:underline">
            ← Back to Clips Library
          </Link>
        </div>
      </div>
    );
  }

  const pdfUrl = `/api/clips/${clipId}/download`;
  const createdDate = new Date(clip.created_at).toLocaleString();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-6">
          <Link href="/clips" className="text-blue-600 hover:underline mb-4 inline-block">
            ← Back to Clips Library
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{clip.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>📅 {createdDate}</span>
            <span>🔗 <a href={clip.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {clip.url}
            </a></span>
            {clip.tag && <span>🏷️ {clip.tag}</span>}
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Document Viewer</h2>
            <a 
              href={pdfUrl}
              download={`${clip.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium inline-flex items-center gap-2"
            >
              ⬇️ Download PDF
            </a>
          </div>
          
          {/* Embedded PDF Viewer */}
          <div className="border rounded-lg overflow-hidden" style={{ height: '80vh' }}>
            <iframe
              src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
              className="w-full h-full"
              title={`PDF: ${clip.title}`}
            />
          </div>
          
          {/* Fallback for browsers that don't support embedded PDFs */}
          <div className="mt-4 text-center text-gray-600">
            <p>Can't see the PDF? <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Open in new tab</a></p>
          </div>
        </div>
        
        {/* Metadata */}
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Clip Details</h3>
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <div>
              <dt className="font-medium text-gray-700 inline">ID:</dt>
              <dd className="ml-2 inline text-gray-600">{clip.id}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-700 inline">File Path:</dt>
              <dd className="ml-2 inline text-gray-600 font-mono text-xs">{clip.file_path}</dd>
            </div>
            {clip.company && (
              <div>
                <dt className="font-medium text-gray-700 inline">Company:</dt>
                <dd className="ml-2 inline text-gray-600">{clip.company}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}