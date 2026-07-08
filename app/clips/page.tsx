'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Clip {
  id: number;
  url: string;
  title: string;
  tag: string | null;
  company: string | null;
  captured_at: string;
  r2_folder: string;
  file_count: number;
  has_screenshot: boolean;
  has_html: boolean;
  has_pdf: boolean;
}

export default function ClipsPage() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClips();
  }, []);

  const fetchClips = async () => {
    try {
      const response = await fetch('/api/clips');
      if (!response.ok) throw new Error('Failed to fetch clips');
      
      const data = await response.json();
      setClips(data.clips);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading clips...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Edward Clipper</h1>
          <p className="mt-2 text-gray-600">
            Captured web content archive • {clips.length} clips
          </p>
        </div>

        {clips.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-4">No clips captured yet</div>
            <div className="text-sm text-gray-400">
              Install the browser extension to start capturing content
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {clips.map((clip) => (
              <div
                key={clip.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                      {clip.title}
                    </h3>
                    {clip.tag && (
                      <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full whitespace-nowrap">
                        {clip.tag}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-3">
                    <div className="truncate">{getDomain(clip.url)}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDate(clip.captured_at)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-2 text-xs text-gray-500">
                      {clip.has_screenshot && <span className="bg-green-100 text-green-700 px-2 py-1 rounded">IMG</span>}
                      {clip.has_html && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">HTML</span>}
                      {clip.has_pdf && <span className="bg-red-100 text-red-700 px-2 py-1 rounded">PDF</span>}
                    </div>
                    <span className="text-xs text-gray-400">{clip.file_count} files</span>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={clip.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-blue-600 text-white text-sm py-2 px-3 rounded hover:bg-blue-700 transition-colors text-center"
                    >
                      Visit Original
                    </Link>
                    <button
                      onClick={() => window.open(`/clips/view/${clip.id}`, '_blank')}
                      className="flex-1 bg-gray-600 text-white text-sm py-2 px-3 rounded hover:bg-gray-700 transition-colors"
                    >
                      View Archive
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}