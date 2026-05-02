import { NextResponse } from "next/server";

import { getCelebrities } from "@/lib/celebrityStore";
import { italianCelebrities } from "@/lib/italianCelebrities";

export async function GET() {
  try {
    const celebrities = await getCelebrities();

    if (celebrities.length > 0) {
      return NextResponse.json(celebrities);
    }
  } catch (error) {
    console.error("Failed to load celebrities from store:", error);
  }

  return NextResponse.json(italianCelebrities);
}
