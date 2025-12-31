import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ASSESSMENT_USERNAME: process.env.ASSESSMENT_USERNAME || null,
  });
}
