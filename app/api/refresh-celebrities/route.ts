import { NextRequest, NextResponse } from "next/server";

import { refreshCelebrities } from "@/lib/celebrityStore";

function extractProvidedSecret(request: NextRequest) {
  const headerSecret = request.headers.get("x-refresh-secret");
  const querySecret = request.nextUrl.searchParams.get("secret");
  const authorizationHeader = request.headers.get("authorization");
  const bearerSecret = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length)
    : null;

  return headerSecret ?? querySecret ?? bearerSecret ?? null;
}

function isAuthorized(request: NextRequest) {
  const expectedSecret = process.env.REFRESH_SECRET;

  if (!expectedSecret) {
    return {
      ok: false,
      status: 500,
      message: "REFRESH_SECRET is not configured.",
    };
  }

  const providedSecret = extractProvidedSecret(request);

  if (!providedSecret || providedSecret !== expectedSecret) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized refresh request.",
    };
  }

  return {
    ok: true,
    status: 200,
    message: "Authorized",
  };
}

export async function GET(request: NextRequest) {
  const authorization = isAuthorized(request);

  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.message }, { status: authorization.status });
  }

  try {
    const result = await refreshCelebrities();

    return NextResponse.json({
      updatedCount: result.updatedCount,
      unchangedCount: result.unchangedCount,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Celebrity refresh failed:", error);

    return NextResponse.json(
      {
        updatedCount: 0,
        unchangedCount: 0,
        errors: [error instanceof Error ? error.message : "Unknown refresh error"],
      },
      { status: 500 },
    );
  }
}
