import { NextResponse } from 'next/server';

export function handleRouteError(error: unknown, context: string = 'API error') {
  console.error(`[${context}]`, error);
  
  const message = error instanceof Error ? error.message : 'Internal server error';
  
  return NextResponse.json(
    { error: message },
    { status: 500 }
  );
}