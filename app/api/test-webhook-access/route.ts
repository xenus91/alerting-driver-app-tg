import { NextResponse } from "next/server"

export async function GET() {
  const timestamp = new Date().toISOString()

  return NextResponse.json(
    {
      status: "OK",
      message: "Webhook endpoint доступен",
      timestamp: timestamp,
      environment: process.env.NODE_ENV,
      vercel_url: process.env.VERCEL_URL,
      headers_received: "GET request successful",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    },
  )
}

export async function POST(request: Request) {
  const timestamp = new Date().toISOString()

  try {
    const body = await request.text()
    console.log(`=== TEST WEBHOOK POST at ${timestamp} ===`)
    console.log("Body received:", body)

    return NextResponse.json(
      {
        status: "OK",
        message: "POST request received successfully",
        timestamp: timestamp,
        body_length: body.length,
        content_type: request.headers.get("content-type"),
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    )
  } catch (error) {
    console.error("Test webhook error:", error)
    return NextResponse.json(
      {
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: timestamp,
      },
      { status: 500 },
    )
  }
}
