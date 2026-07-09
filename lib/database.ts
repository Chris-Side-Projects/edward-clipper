// Temporary file-based database for Railway deployment
// SQLite requires compilation which fails on Railway's build environment

import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.DATA_DIR || './data'
const CLIPS_FILE = path.join(DATA_DIR, 'clips.json')

export interface ClipRecord {
  id: string
  url: string
  title: string
  tag?: string
  company?: string
  file_path: string
  created_at: string
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Load clips from JSON file
function loadClips(): ClipRecord[] {
  try {
    if (fs.existsSync(CLIPS_FILE)) {
      return JSON.parse(fs.readFileSync(CLIPS_FILE, 'utf-8'))
    }
  } catch (error) {
    console.error('Error loading clips:', error)
  }
  return []
}

// Save clips to JSON file
function saveClips(clips: ClipRecord[]) {
  try {
    fs.writeFileSync(CLIPS_FILE, JSON.stringify(clips, null, 2))
  } catch (error) {
    console.error('Error saving clips:', error)
  }
}

export function initDatabase() {
  // File-based storage, no initialization needed
  console.log(`Using file-based clip storage at: ${CLIPS_FILE}`)
}

export function insertClip(clip: Omit<ClipRecord, 'id' | 'created_at'>): string {
  const clips = loadClips()
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2)
  const newClip: ClipRecord = {
    ...clip,
    id,
    created_at: new Date().toISOString()
  }
  
  clips.push(newClip)
  saveClips(clips)
  return id
}

export function getClips(limit = 50, offset = 0): ClipRecord[] {
  const clips = loadClips()
  return clips
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(offset, offset + limit)
}

export function searchClips(query: string): ClipRecord[] {
  const clips = loadClips()
  const lowercaseQuery = query.toLowerCase()
  
  return clips.filter(clip => 
    clip.title.toLowerCase().includes(lowercaseQuery) ||
    clip.url.toLowerCase().includes(lowercaseQuery) ||
    clip.tag?.toLowerCase().includes(lowercaseQuery) ||
    clip.company?.toLowerCase().includes(lowercaseQuery)
  )
}