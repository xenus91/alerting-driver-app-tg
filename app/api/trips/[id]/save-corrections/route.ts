//app/api/trips/[id]/save-corrections/route.ts

import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@vercel/postgres"

export async function POST(request: NextRequest) {
  try {
    const { phone, corrections, deletedTrips = [] } = await request.json()

    if (!phone || !corrections || !Array.isArray(corrections)) {
      return NextResponse.json({ success: false, error: "Invalid request data" }, { status: 400 })
    }

    const client = await sql.connect()

    try {
      await client.query("BEGIN")

      // Handle deleted trips first
      if (deletedTrips.length > 0) {
        for (const tripIdentifier of deletedTrips) {
          // Delete trip_points associated with the trip_identifier
          await client.query(
            `DELETE FROM trip_points WHERE trip_id IN (SELECT id FROM trips WHERE trip_identifier = $1 AND driver_phone = $2)`,
            [tripIdentifier, phone],
          )

          // Delete trip_messages associated with the trip_identifier
          await client.query(
            `DELETE FROM trip_messages WHERE trip_id IN (SELECT id FROM trips WHERE trip_identifier = $1 AND driver_phone = $2)`,
            [tripIdentifier, phone],
          )

          // Delete the trip itself
          await client.query(`DELETE FROM trips WHERE trip_identifier = $1 AND driver_phone = $2`, [
            tripIdentifier,
            phone,
          ])
        }
      }

      const tripIdentifiersToProcess = [...new Set(corrections.map((c: any) => c.trip_identifier))]

      for (const tripIdentifier of tripIdentifiersToProcess) {
        const tripsForThisIdentifier = corrections.filter((c: any) => c.trip_identifier === tripIdentifier)
        const originalTripIdentifier = tripsForThisIdentifier[0].original_trip_identifier || tripIdentifier

        // Check if the trip_identifier is already assigned to another driver
        const conflictCheck = await client.query(
          `SELECT t.trip_identifier, u.phone AS driver_phone, u.full_name AS driver_name, t.id AS trip_id
           FROM trips t
           JOIN users u ON t.driver_phone = u.phone
           WHERE t.trip_identifier = $1 AND t.driver_phone != $2`,
          [tripIdentifier, phone],
        )

        if (conflictCheck.rows.length > 0) {
          await client.query("ROLLBACK")
          return NextResponse.json(
            {
              success: false,
              error: "trip_already_assigned",
              trip_identifiers: conflictCheck.rows.map((row) => row.trip_identifier),
              conflict_data: conflictCheck.rows,
            },
            { status: 409 },
          )
        }

        // Find existing trip_id for this trip_identifier and driver_phone
        const existingTripResult = await client.query(
          `SELECT id, message_id FROM trips WHERE trip_identifier = $1 AND driver_phone = $2`,
          [originalTripIdentifier, phone],
        )
        let tripId: number | null = null
        let messageId: number | null = null

        if (existingTripResult.rows.length > 0) {
          tripId = existingTripResult.rows[0].id
          messageId = existingTripResult.rows[0].message_id
          // Update existing trip details
          await client.query(
            `UPDATE trips SET
             trip_identifier = $1,
             vehicle_number = $2,
             planned_loading_time = $3,
             driver_comment = $4,
             updated_at = NOW()
             WHERE id = $5`,
            [
              tripIdentifier,
              tripsForThisIdentifier[0].vehicle_number,
              tripsForThisIdentifier[0].planned_loading_time,
              tripsForThisIdentifier[0].driver_comment,
              tripId,
            ],
          )
          // Delete existing points for this trip
          await client.query(`DELETE FROM trip_points WHERE trip_id = $1`, [tripId])
        } else {
          // Insert new trip
          const insertTripResult = await client.query(
            `INSERT INTO trips (trip_identifier, driver_phone, vehicle_number, planned_loading_time, driver_comment, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             RETURNING id`,
            [
              tripIdentifier,
              phone,
              tripsForThisIdentifier[0].vehicle_number,
              tripsForThisIdentifier[0].planned_loading_time,
              tripsForThisIdentifier[0].driver_comment,
            ],
          )
          tripId = insertTripResult.rows[0].id
        }

        // Insert new points for the trip
        for (const correction of tripsForThisIdentifier) {
          await client.query(
            `INSERT INTO trip_points (trip_id, point_type, point_num, point_id, point_name, latitude, longitude, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
            [
              tripId,
              correction.point_type,
              correction.point_num,
              correction.point_id,
              correction.point_name,
              correction.latitude,
              correction.longitude,
            ],
          )
        }

        // Update or insert trip_messages entry
        if (messageId) {
          await client.query(
            `UPDATE trip_messages SET
             trip_id = $1,
             driver_phone = $2,
             message_type = 'trip_details',
             updated_at = NOW()
             WHERE message_id = $3`,
            [tripId, phone, messageId],
          )
        } else {
          // If no message_id, it's a new trip or a trip without a message yet.
          // We don't create a message here, it's handled by send-messages or resend-combined
          // For now, we just ensure the trip is saved.
        }
      }

      await client.query("COMMIT")
      return NextResponse.json({ success: true })
    } catch (dbError: any) {
      await client.query("ROLLBACK")
      console.error("Database transaction error:", dbError)
      return NextResponse.json(
        { success: false, error: "Failed to save corrections", details: dbError.message },
        { status: 500 },
      )
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error("Error in save-corrections route:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error", details: error.message },
      { status: 500 },
    )
  }
}
