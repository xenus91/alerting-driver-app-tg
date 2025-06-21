import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    message: "Webhook endpoint is accessible",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercel_url: process.env.VERCEL_URL,
  })
}

export async function POST() {
  return NextResponse.json({
    status: "healthy",
    message: "Webhook can receive POST requests",
    timestamp: new Date().toISOString(),
  })
}
