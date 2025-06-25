import { type NextRequest, NextResponse } from "next/server"
import { Pool } from "@neondatabase/serverless"
import sql from "sql-template-strings"
import { getTrips } from "@/lib/database"

export const config = {
  runtime: "edge",
}

export const dynamic = "force-dynamic"

async function queryDatabase(query: any) {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    })
    const client = await pool.connect()
    const result = await client.query(query)
    client.release()
    return result.rows
  } catch (error) {
    console.error("Database query failed:", error)
    throw error
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { trip_id, message_id, response, user_id } = body

    if (!trip_id || !message_id || !response || !user_id) {
      return new NextResponse(JSON.stringify({ message: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Insert the campaign response into the database
    const insertQuery = sql`
      INSERT INTO trip_message_responses (trip_id, message_id, response, user_id, created_at)
      VALUES (${trip_id}, ${message_id}, ${response}, ${user_id}, NOW())
      RETURNING *
    `

    const insertedResponse = await queryDatabase(insertQuery)

    return new NextResponse(JSON.stringify({ data: insertedResponse }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Error processing campaign response:", error)
    return new NextResponse(JSON.stringify({ message: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

export async function GET() {
  try {
    const trips = await getTrips()
    return NextResponse.json({ campaigns: trips })
  } catch (error) {
    console.error("Get trips error:", error)
    return NextResponse.json(
      {
        error: "Ошибка при получении рейсов",
      },
      { status: 500 },
    )
  }
}
