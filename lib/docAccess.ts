// Simple audit logging (can be enhanced later)
import { NextRequest } from 'next/server';

export function auditDocAccess(req: NextRequest, resource: string, endpoint: string) {
  const timestamp = new Date().toISOString();
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  console.log(`[AUDIT] ${timestamp} - ${endpoint} - ${resource} - IP:${ip} - UA:${userAgent.slice(0, 100)}`);
}