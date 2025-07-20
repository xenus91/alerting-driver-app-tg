import { Pool } from "pg"
import { subscriptionService } from "./subscription-service"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function query(text: string, params?: any[]) {
  const client = await pool.connect()
  try {
    const res = await client.query(text, params)
    return res
  } finally {
    client.release()
  }
}

export interface User {
  id: number
  telegram_id: string
  phone: string
  name: string
  first_name?: string
  last_name?: string
  full_name?: string
  carpark?: string
  registration_state?: string
  temp_first_name?: string
  temp_last_name?: string
  verified?: boolean
  created_at: string
  updated_at: string
  username: string | null
  role: string
}

export interface Trip {
  id: number
  trip_identifier?: string
  vehicle_number?: string
  planned_loading_time?: string
  driver_comment?: string
  carpark?: string
  created_at: string
  status: string
  points: Point[]
  total_messages?: number
  sent_messages?: number
  error_messages?: number
  confirmed_responses?: number
  rejected_responses?: number
  declined_responses?: number
  pending_responses?: number
  first_sent_at?: string
  last_sent_at?: string
}

export interface Point {
  id: number
  point_id: string
  point_name: string
  door_open_1?: string
  door_open_2?: string
  door_open_3?: string
  latitude?: number
  longitude?: number
  address: string
  created_at: string
  updated_at: string
}

export interface TripPoint {
  id: number
  trip_id: number
  point_id: number
  point_type: "P" | "D"
  point_num: number
  trip_identifier?: string
  created_at: string
  point_name?: string
  point_short_id?: string
  door_open_1?: string
  door_open_2?: string
  door_open_3?: string
  latitude?: number
  longitude?: number
  driver_phone?: string
}

export interface TripMessage {
  id: number
  trip_id: number
  phone: string
  message: string
  telegram_id?: number
  status: string
  error_message?: string
  sent_at?: string
  created_at: string
  response_status: string
  response_comment?: string
  response_at?: string
  trip_identifier?: string
  vehicle_number?: string
  planned_loading_time?: string
  driver_comment?: string
  sent_time?: string
}

export interface UserPendingAction {
  user_id: number
  action_type: string
  related_message_id?: number
  action_data?: string
  created_at: string
}

export async function createUser(telegramId: string, phone: string, name: string) {
  try {
    const normalizedPhone = phone.startsWith("+") ? phone.slice(1) : phone

    console.log(`Creating user: telegramId=${telegramId}, phone=${phone} -> ${normalizedPhone}, name=${name}`)

    const result = await query(
      `
      INSERT INTO users (telegram_id, phone, name, registration_state)
      VALUES ($1, $2, $3, 'awaiting_first_name')
      ON CONFLICT (telegram_id) DO UPDATE SET
        phone = EXCLUDED.phone,
        name = EXCLUDED.name
      RETURNING *
    `,
      [telegramId, normalizedPhone, name],
    )

    console.log(`User created/updated:`, result.rows[0])
    return result.rows[0] as User
  } catch (error) {
    console.error("Error creating user:", error)
    throw error
  }
}

export async function updateUserRegistrationStep(telegramId: string, step: string, data?: any) {
  try {
    let updateQuery

    switch (step) {
      case "first_name":
        updateQuery = query(
          `
          UPDATE users 
          SET temp_first_name = $1, registration_state = 'awaiting_last_name'
          WHERE telegram_id = $2
          RETURNING *
        `,
          [data, telegramId],
        )
        break
      case "last_name":
        updateQuery = query(
          `
          UPDATE users 
          SET temp_last_name = $1, registration_state = 'awaiting_carpark'
          WHERE telegram_id = $2
          RETURNING *
        `,
          [data, telegramId],
        )
        break
      case "carpark":
        updateQuery = query(
          `
          UPDATE users 
          SET carpark = $1, 
              first_name = temp_first_name,
              last_name = temp_last_name,
              full_name = temp_first_name || ' ' || temp_last_name,
              registration_state = 'completed',
              temp_first_name = NULL,
              temp_last_name = NULL
          WHERE telegram_id = $2
          RETURNING *
        `,
          [data, telegramId],
        )
        break
      default:
        throw new Error(`Unknown registration step: ${step}`)
    }

    const result = await updateQuery
    console.log(`User registration step updated:`, result.rows[0])
    return result.rows[0] as User
  } catch (error) {
    console.error("Error updating user registration step:", error)
    throw error
  }
}

export async function getUserByTelegramId(telegramId: string) {
  try {
    const result = await query(
      `
      SELECT * FROM users WHERE telegram_id = $1
    `,
      [telegramId],
    )
    return result.rows[0] as User | undefined
  } catch (error) {
    console.error("Error getting user by telegram id:", error)
    throw error
  }
}

export async function getUserByPhone(phone: string) {
  try {
    const normalizedPhone = phone.startsWith("+") ? phone.slice(1) : phone

    console.log(`Looking for user by phone: ${phone} -> ${normalizedPhone}`)

    const result = await query(
      `
      SELECT * FROM users WHERE phone = $1
    `,
      [normalizedPhone],
    )

    console.log(`Found user:`, result.rows[0] || "not found")
    return result.rows[0] as User | undefined
  } catch (error) {
    console.error("Error getting user by phone:", error)
    throw error
  }
}

export async function getUsersWithVerificationByPhones(phones: string[]) {
  try {
    if (phones.length === 0) {
      return []
    }

    const normalizedPhones = phones.map((phone) => (phone.startsWith("+") ? phone.slice(1) : phone))

    console.log(`Looking for users by phones:`, normalizedPhones)

    const result = await query(
      `
      SELECT phone, verified, first_name, last_name, full_name, name, telegram_id
      FROM users 
      WHERE phone = ANY($1)
    `,
      [normalizedPhones],
    )

    console.log(`Found ${result.rows.length} users`)
    return result.rows as Array<
      Pick<User, "phone" | "verified" | "first_name" | "last_name" | "full_name" | "name" | "telegram_id">
    >
  } catch (error) {
    console.error("Error getting users with verification:", error)
    throw error
  }
}

export async function createTrip(carpark?: string) {
  try {
    const result = await query(
      `
      INSERT INTO trips (status, carpark) VALUES ('active', $1)
      RETURNING *
    `,
      [carpark || null],
    )
    console.log(`Created trip with carpark: ${carpark}`)
    return result.rows[0] as Trip
  } catch (error) {
    console.error("Error creating trip:", error)
    throw error
  }
}

export async function updateTripStatus(tripId: number, status: string) {
  try {
    const result = await query(
      `
      UPDATE trips 
      SET status = $1
      WHERE id = $2
      RETURNING *
    `,
      [status, tripId],
    )
    console.log(`Trip ${tripId} status updated to ${status}`)
    return result.rows[0] as Trip
  } catch (error) {
    console.error("Error updating trip status:", error)
    throw error
  }
}

export async function createTripMessage(
  tripId: number,
  phone: string,
  message: string,
  telegramId?: number,
  tripData?: {
    trip_identifier?: string
    vehicle_number?: string
    planned_loading_time?: string
    driver_comment?: string
  },
) {
  try {
    const normalizedPhone = phone.startsWith("+") ? phone.slice(1) : phone

    console.log(`DEBUG: Creating trip message:`, {
      tripId,
      phone: normalizedPhone,
      telegramId,
      trip_identifier: tripData?.trip_identifier,
      vehicle_number: tripData?.vehicle_number,
      planned_loading_time: tripData?.planned_loading_time,
      driver_comment: tripData?.driver_comment,
    })

    const result = await query(
      `
      INSERT INTO trip_messages (
        trip_id, phone, message, telegram_id, response_status,
        trip_identifier, vehicle_number, planned_loading_time, driver_comment
      )
      VALUES (
        $1, $2, $3, $4, 'pending',
        $5, $6, $7, $8
      )
      RETURNING *
    `,
      [
        tripId,
        normalizedPhone,
        message,
        telegramId || null,
        tripData?.trip_identifier || null,
        tripData?.vehicle_number || null,
        tripData?.planned_loading_time || null,
        tripData?.driver_comment || null,
      ],
    )

    console.log(`DEBUG: Created trip message:`, result.rows[0])
    return result.rows[0] as TripMessage
  } catch (error) {
    console.error("Error creating trip message:", error)
    throw error
  }
}

export async function updateTripMessage(messageId: number, message: string) {
  try {
    const result = await query(
      `
      UPDATE trip_messages 
      SET message = $1
      WHERE id = $2
      RETURNING *
    `,
      [message, messageId],
    )
    console.log(`Trip message ${messageId} updated with formatted content`)
    return result.rows[0] as TripMessage
  } catch (error) {
    console.error("Error updating trip message:", error)
    throw error
  }
}

export async function createTripPoint(
  tripId: number,
  pointId: string,
  pointType: "P" | "D",
  pointNum: number,
  tripIdentifier?: string,
  driverPhone?: string,
) {
  try {
    console.log(
      `DEBUG: Creating trip point - tripId: ${tripId}, pointId: ${pointId}, type: ${pointType}, num: ${pointNum}, tripIdentifier: ${tripIdentifier}, driverPhone: ${driverPhone}`,
    )

    const pointResult = await query(
      `
      SELECT id FROM points WHERE point_id = $1
    `,
      [pointId],
    )

    console.log(`DEBUG: Found point with ID ${pointId}:`, pointResult)

    if (pointResult.rows.length === 0) {
      console.warn(`Point not found for point_id: ${pointId}`)
      return null
    }

    const result = await query(
      `
      INSERT INTO trip_points (trip_id, point_id, point_type, point_num, trip_identifier, driver_phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
      [tripId, pointResult.rows[0].id, pointType, pointNum, tripIdentifier || null, driverPhone],
    )

    console.log(`DEBUG: Created trip point:`, result.rows[0])
    return result.rows[0] as TripPoint
  } catch (error) {
    console.error("Error creating trip point:", error)
    throw error
  }
}

export async function getAllPoints() {
  try {
    const result = await query(`
      SELECT * FROM points
      ORDER BY point_id ASC
    `)
    return result.rows as Point[]
  } catch (error) {
    console.error("Error getting all points:", error)
    throw error
  }
}

export async function createPoint(
  pointId: string,
  pointName: string,
  doorOpen1?: string,
  doorOpen2?: string,
  doorOpen3?: string,
  latitude?: number,
  longitude?: number,
  address?: string,
) {
  try {
    const result = await query(
      `
      INSERT INTO points (point_id, point_name, door_open_1, door_open_2, door_open_3, latitude, longitude, address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [
        pointId,
        pointName,
        doorOpen1 || null,
        doorOpen2 || null,
        doorOpen3 || null,
        latitude || null,
        longitude || null,
        address || null,
      ],
    )
    return result.rows[0] as Point
  } catch (error) {
    console.error("Error creating point:", error)
    throw error
  }
}

export async function updatePoint(
  id: number,
  pointId: string,
  pointName: string,
  doorOpen1?: string,
  doorOpen2?: string,
  doorOpen3?: string,
  latitude?: number,
  longitude?: number,
  address?: string,
) {
  try {
    const result = await query(
      `
      UPDATE points 
      SET point_id = $1,
          point_name = $2, 
          door_open_1 = $3,
          door_open_2 = $4,
          door_open_3 = $5,
          latitude = $6,
          longitude = $7,
          address = $8,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `,
      [
        pointId,
        pointName,
        doorOpen1 || null,
        doorOpen2 || null,
        doorOpen3 || null,
        latitude || null,
        longitude || null,
        address || null,
        id,
      ],
    )
    return result.rows[0] as Point
  } catch (error) {
    console.error("Error updating point:", error)
    throw error
  }
}

export async function deletePoint(id: number) {
  try {
    await query(
      `
      DELETE FROM points WHERE id = $1
    `,
      [id],
    )
    console.log(`Point ${id} deleted`)
  } catch (error) {
    console.error("Error deleting point:", error)
    throw error
  }
}

export async function getTripPoints(tripId: number) {
  try {
    const result = await query(
      `
      SELECT tp.*, p.point_name, p.point_id as point_short_id, p.door_open_1, p.door_open_2, p.door_open_3, p.latitude, p.longitude
      FROM trip_points tp
      JOIN points p ON tp.point_id = p.id
      WHERE tp.trip_id = $1
      ORDER BY tp.point_type, tp.point_num
    `,
      [tripId],
    )
    return result.rows as TripPoint[]
  } catch (error) {
    console.error("Error getting trip points:", error)
    throw error
  }
}

export async function updateMessageStatus(
  messageId: number,
  status: string,
  errorMessage?: string,
  telegramMessageId?: number,
) {
  try {
    const result = await query(
      `
      UPDATE trip_messages 
      SET status = $1, 
          error_message = $2,
          sent_at = $3,
          telegram_message_id = $4
      WHERE id = $5
      RETURNING *
    `,
      [
        status,
        errorMessage || null,
        status === "sent" ? new Date().toISOString() : null,
        telegramMessageId || null,
        messageId,
      ],
    )
    return result.rows[0] as TripMessage
  } catch (error) {
    console.error("Error updating message status:", error)
    throw error
  }
}

export async function updateMessageResponse(messageId: number, responseStatus: string, responseComment?: string) {
  try {
    const result = await query(
      `
      UPDATE trip_messages 
      SET response_status = $1, 
          response_comment = $2,
          response_at = $3
      WHERE id = $4
      RETURNING *
    `,
      [responseStatus, responseComment || null, new Date().toISOString(), messageId],
    )
    try {
      await subscriptionService.checkSubscriptions()
    } catch (error) {
      console.error("Error checking subscriptions after response update:", error)
    }
    return result.rows[0] as TripMessage
  } catch (error) {
    console.error("Error updating message response:", error)
    throw error
  }
}

export async function setUserPendingAction(
  userId: number,
  actionType: string,
  relatedMessageId?: number,
  actionData?: any,
) {
  try {
    const dataString = actionData ? JSON.stringify(actionData) : null
    console.log(
      `Setting pending action for user ${userId}: ${actionType}, messageId: ${relatedMessageId}, data: ${dataString}`,
    )

    const result = await query(
      `
      INSERT INTO user_pending_actions (user_id, action_type, related_message_id, action_data)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO UPDATE SET
        action_type = EXCLUDED.action_type,
        related_message_id = EXCLUDED.related_message_id,
        action_data = EXCLUDED.action_data,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
      [userId, actionType, relatedMessageId || null, dataString],
    )
    console.log(`Pending action set for user ${userId}:`, result.rows[0])
    return result.rows[0] as UserPendingAction
  } catch (error) {
    console.error("Error setting user pending action:", error)
    throw error
  }
}

export async function getUserPendingAction(userId: number): Promise<UserPendingAction | undefined> {
  try {
    const result = await query(
      `
      SELECT * FROM user_pending_actions WHERE user_id = $1
    `,
      [userId],
    )
    console.log(`Pending action for user ${userId}:`, result.rows[0] || "not found")
    return result.rows[0] as UserPendingAction | undefined
  } catch (error) {
    console.error("Error getting user pending action:", error)
    throw error
  }
}

export async function deleteUserPendingAction(userId: number) {
  try {
    await query(
      `
      DELETE FROM user_pending_actions WHERE user_id = $1
    `,
      [userId],
    )
    console.log(`Pending action deleted for user ${userId}`)
  } catch (error) {
    console.error("Error deleting user pending action:", error)
    throw error
  }
}

export async function getTripMessageByTelegramId(telegramUserId: string, tripMessageId: number) {
  try {
    const result = await query(
      `
      SELECT tm.* 
      FROM trip_messages tm
      JOIN users u ON tm.telegram_id = u.telegram_id
      WHERE u.telegram_id = $1 AND tm.id = $2
      LIMIT 1
    `,
      [telegramUserId, tripMessageId],
    )
    console.log(
      `Trip message for telegram_id ${telegramUserId} and message_id ${tripMessageId}:`,
      result.rows[0] || "not found",
    )
    return result.rows[0] as TripMessage | undefined
  } catch (error) {
    console.error("Error getting trip message by telegram id:", error)
    throw error
  }
}

export async function getTripMessages(tripId: number) {
  try {
    const result = await query(
      `
      SELECT tm.*, u.first_name, u.full_name
      FROM trip_messages tm
      LEFT JOIN users u ON tm.telegram_id = u.telegram_id
      WHERE tm.trip_id = $1
      ORDER BY tm.created_at DESC
    `,
      [tripId],
    )
    return result.rows as (TripMessage & { first_name?: string; full_name?: string })[]
  } catch (error) {
    console.error("Error getting trip messages:", error)
    throw error
  }
}

export async function getTrips(carparkFilter?: string) {
  try {
    let query

    if (carparkFilter) {
      query = query(
        `
        SELECT 
          t.id,
          t.created_at,
          t.carpark,
          COUNT(DISTINCT u.telegram_id) AS total_messages, 
          COUNT(DISTINCT CASE WHEN tm.status = 'sent' THEN u.telegram_id END) AS sent_messages,
          COUNT(DISTINCT CASE WHEN tm.status = 'error' THEN u.telegram_id END) AS error_messages,
          COUNT(DISTINCT CASE WHEN tm.response_status = 'confirmed' THEN u.telegram_id END) AS confirmed_responses,
          COUNT(DISTINCT CASE WHEN tm.response_status = 'rejected' THEN u.telegram_id END) AS rejected_responses,
          COUNT(DISTINCT CASE WHEN tm.response_status = 'pending' AND tm.status = 'sent' THEN u.telegram_id END) AS pending_responses,
          COUNT(DISTINCT CASE WHEN tm.response_status = 'declined' AND tm.status = 'sent' THEN u.telegram_id END) AS declined_responses,
          MIN(tm.sent_at) AS first_sent_at,
          MAX(tm.sent_at) AS last_sent_at
        FROM trips t
        LEFT JOIN trip_messages tm ON t.id = tm.trip_id
        LEFT JOIN users u ON tm.phone = u.phone
        WHERE t.carpark = $1
        GROUP BY t.id, t.created_at, t.carpark
        ORDER BY t.created_at DESC
      `,
        [carparkFilter],
      )
    } else {
      query = query(`
        SELECT 
          t.id,
          t.created_at,
          t.carpark,
          COUNT(DISTINCT u.telegram_id) AS total_messages,
          COUNT(DISTINCT CASE WHEN tm.status = 'sent' THEN u.telegram_id END) AS sent_messages,
          COUNT(DISTINCT CASE WHEN tm.status = 'error' THEN u.telegram_id END) AS error_messages,
          COUNT(DISTINCT CASE WHEN tm.response_status = 'confirmed' THEN u.telegram_id END) AS confirmed_responses,
          COUNT(DISTINCT CASE WHEN tm.response_status = 'rejected' THEN u.telegram_id END) AS rejected_responses,
          COUNT(DISTINCT CASE WHEN tm.response_status = 'pending' AND tm.status = 'sent' THEN u.telegram_id END) AS pending_responses,
          COUNT(DISTINCT CASE WHEN tm.response_status = 'declined' AND tm.status = 'sent' THEN u.telegram_id END) AS declined_responses,
          MIN(tm.sent_at) AS first_sent_at,
          MAX(tm.sent_at) AS last_sent_at
        FROM trips t
        LEFT JOIN trip_messages tm ON t.id = tm.trip_id
        LEFT JOIN users u ON tm.phone = u.phone
        GROUP BY t.id, t.created_at, t.carpark
        ORDER BY t.created_at DESC
      `)
    }

    const result = await query
    return result.rows
  } catch (error) {
    console.error("Error getting trips:", error)
    throw error
  }
}

export async function getAllUsers() {
  try {
    const result = await query(`
      SELECT id, telegram_id, phone, name, first_name, last_name, full_name, carpark, created_at, registration_state, verified, username, role
      FROM users
      ORDER BY created_at DESC
    `)
    return result.rows as User[]
  } catch (error) {
    console.error("Error getting all users:", error)
    throw error
  }
}

export async function createCampaign(carpark?: string) {
  return createTrip(carpark)
}

export async function createCampaignMessage(
  tripId: number,
  phone: string,
  message: string,
  telegramId?: number,
  tripData?: {
    trip_identifier?: string
    vehicle_number?: string
    planned_loading_time?: string
    driver_comment?: string
  },
) {
  return createTripMessage(tripId, phone, message, telegramId, tripData)
}

export async function getCampaignMessageByTelegramId(telegramUserId: string, messageId: number) {
  return getTripMessageByTelegramId(telegramUserId, messageId)
}

export async function getCampaignMessages(tripId: number) {
  return getTripMessages(tripId)
}

export async function getCampaigns(carparkFilter?: string) {
  return getTrips(carparkFilter)
}

export async function getTripDataForMessages(tripId: number) {
  try {
    const result = await query(
      `
      SELECT DISTINCT
        tm.phone,
        tm.telegram_id,
        tm.trip_identifier,
        tm.vehicle_number,
        tm.planned_loading_time,
        tm.driver_comment,
        tp.point_type,
        tp.point_num,
        p.point_id,
        p.point_name,
        p.door_open_1,
        p.door_open_2,
        p.door_open_3,
        p.latitude,
        p.longitude,
        u.first_name,
        u.full_name
      FROM trip_messages tm
      LEFT JOIN trip_points tp ON tm.trip_id = tp.trip_id
      LEFT JOIN points p ON tp.point_id = p.id
      LEFT JOIN users u ON tm.telegram_id = u.telegram_id
      WHERE tm.trip_id = $1
      ORDER BY tm.phone, tm.trip_identifier, tp.point_type, tp.point_num
    `,
      [tripId],
    )
    return result.rows
  } catch (error) {
    console.error("Error getting trip data for messages:", error)
    throw error
  }
}

export async function getTripDataGroupedByPhone(tripId: number) {
  try {
    console.log(`=== DEBUG: getTripDataGroupedByPhone for tripId: ${tripId} ===`)

    const result = await query(
      `
      SELECT DISTINCT
        tm.phone,
        tm.telegram_id,
        tm.trip_identifier,
        tm.vehicle_number,
        tm.planned_loading_time,
        tm.driver_comment,
        u.first_name,
        u.full_name
      FROM trip_messages tm
      LEFT JOIN users u ON tm.telegram_id = u.telegram_id
      WHERE tm.trip_id = $1 AND tm.status = 'pending' AND tm.telegram_id IS NOT NULL
      ORDER BY tm.phone, tm.trip_identifier
    `,
      [tripId],
    )

    console.log(`DEBUG: Found ${result.rows.length} trip messages:`)
    result.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. Phone: ${row.phone}, Trip: ${row.trip_identifier}, Vehicle: ${row.vehicle_number}`)
    })

    const groupedData = new Map()

    for (const row of result.rows) {
      console.log(`DEBUG: Processing row - Phone: ${row.phone}, Trip: ${row.trip_identifier}`)

      if (!groupedData.has(row.phone)) {
        groupedData.set(row.phone, {
          phone: row.phone,
          telegram_id: row.telegram_id,
          first_name: row.first_name,
          full_name: row.full_name,
          trips: new Map(),
        })
        console.log(`DEBUG: Created new phone group for ${row.phone}`)
      }

      const phoneGroup = groupedData.get(row.phone)

      if (row.trip_identifier && !phoneGroup.trips.has(row.trip_identifier)) {
        console.log(`DEBUG: Getting points for trip_identifier: ${row.trip_identifier}, phone: ${row.phone}`)

        const tripPointsResult = await query(
          `
          SELECT DISTINCT
            tp.point_type,
            tp.point_num,
            p.point_id,
            p.point_name,
            p.door_open_1,
            p.door_open_2,
            p.door_open_3,
            p.latitude,
            p.longitude
          FROM trip_points tp
          JOIN points p ON tp.point_id = p.id
          WHERE tp.trip_id = $1 AND tp.trip_identifier = $2
          ORDER BY tp.point_type DESC, tp.point_num
        `,
          [tripId, row.trip_identifier],
        )

        console.log(`DEBUG: Found ${tripPointsResult.rows.length} points for trip ${row.trip_identifier}:`)
        tripPointsResult.rows.forEach((point, index) => {
          console.log(
            `  ${index + 1}. Type: ${point.point_type}, Num: ${point.point_num}, ID: ${point.point_id}, Name: ${point.point_name}`,
          )
        })

        const loading_points = []
        const unloading_points = []

        for (const point of tripPointsResult.rows) {
          const pointInfo = {
            point_id: point.point_id,
            point_name: point.point_name,
            point_num: point.point_num,
            door_open_1: point.door_open_1,
            door_open_2: point.door_open_2,
            door_open_3: point.door_open_3,
            latitude: point.latitude,
            longitude: point.longitude,
          }

          if (point.point_type === "P") {
            loading_points.push(pointInfo)
            console.log(`DEBUG: Added loading point: ${point.point_name}`)
          } else if (point.point_type === "D") {
            unloading_points.push(pointInfo)
            console.log(`DEBUG: Added unloading point: ${point.point_name}`)
          }
        }

        phoneGroup.trips.set(row.trip_identifier, {
          trip_identifier: row.trip_identifier,
          vehicle_number: row.vehicle_number,
          planned_loading_time: row.planned_loading_time,
          driver_comment: row.driver_comment,
          loading_points: loading_points,
          unloading_points: unloading_points,
        })

        console.log(
          `DEBUG: Created trip ${row.trip_identifier} with ${loading_points.length} loading and ${unloading_points.length} unloading points`,
        )
      }
    }

    console.log(`DEBUG: Final grouped data has ${groupedData.size} phone groups`)
    for (const [phone, phoneData] of groupedData) {
      console.log(`DEBUG: Phone ${phone} has ${phoneData.trips.size} trips`)
      for (const [tripId, trip] of phoneData.trips) {
        console.log(
          `  Trip ${tripId}: ${trip.loading_points.length} loading, ${trip.unloading_points.length} unloading`,
        )
      }
    }

    return groupedData
  } catch (error) {
    console.error("Error getting grouped trip data:", error)
    throw error
  }
}

export async function deleteTrip(tripId: number) {
  try {
    await query(`DELETE FROM trip_messages WHERE trip_id = $1`, [tripId])
    await query(`DELETE FROM trip_points WHERE trip_id = $1`, [tripId])
    await query(`DELETE FROM trips WHERE id = $1`, [tripId])

    console.log(`Trip ${tripId} and related records deleted`)
  } catch (error) {
    console.error("Error deleting trip:", error)
    throw error
  }
}
