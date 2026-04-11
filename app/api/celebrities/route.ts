import { NextResponse } from 'next/server';
import { italianCelebrities } from '@/lib/italianCelebrities';

export async function GET() {
  return NextResponse.json(italianCelebrities);
}
