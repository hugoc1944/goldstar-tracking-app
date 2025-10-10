// lib/http.ts
import { NextResponse } from 'next/server';

export function ok<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data as any, typeof init === 'number' ? { status: init } : init);
}

export function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}