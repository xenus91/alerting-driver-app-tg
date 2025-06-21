import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    status: "OK",
    message: "Webhook endpoint доступен",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  })
}

export async function POST() {
  return NextResponse.json({
    status: "OK",
    message: "Webhook может принимать POST запросы",
    timestamp: new Date().toISOString(),
  })
}
