import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    {
      status: "OK",
      message: "Endpoint доступен",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      vercel_url: process.env.VERCEL_URL,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    },
  )
}

export async function POST() {
  return NextResponse.json(
    {
      status: "OK",
      message: "POST запросы принимаются",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    },
  )
}
