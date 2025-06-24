import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export interface User {
  id: number
  telegram_id: number
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
}

export interface Trip {
  id: number
  trip_identifier?: string
  vehicle_number?: string
  planned_loading_time?: string
  driver_comment?: string
  created_at: string
  status: string
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
  created_at: string
}

export async function createUser(telegramId: number, phone: string, name: string) {
  try {
    const normalizedPhone = phone.startsWith("+") ? phone.slice(1) : phone

    console.log(`Creating user: telegramId=${telegramId}, phone=${phone} -> ${normalizedPhone}, name=${name}`)

    const result = await sql`
      INSERT INTO users (telegram_id, phone, name, registration_state)
      VALUES (${telegramId}, ${normalizedPhone}, ${name}, 'awaiting_first_name')
      ON CONFLICT (telegram_id) DO UPDATE SET
        phone = EXCLUDED.phone,
        name = EXCLUDED.name
      RETURNING *
    `

    console.log(`User created/updated:`, result[0])
    return result[0] as User
  } catch (error) {
    console.error("Error creating user:", error)
    throw error
  }
}

export async function updateUserRegistrationStep(telegramId: number, step: string, data?: any) {
  try {
    let updateQuery

    switch (step) {
      case "first_name":
        updateQuery = sql`
          UPDATE users 
          SET temp_first_name = ${data}, registration_state = 'awaiting_last_name'
          WHERE telegram_id = ${telegramId}
          RETURNING *
        `
        break
      case "last_name":
        updateQuery = sql`
          UPDATE users 
          SET temp_last_name = ${data}, registration_state = 'awaiting_carpark'
          WHERE telegram_id = ${telegramId}
          RETURNING *
        `
        break
      case "carpark":
        updateQuery = sql`
          UPDATE users 
          SET carpark = ${data}, 
              first_name = temp_first_name,
              last_name = temp_last_name,
              full_name = temp_first_name || ' ' || temp_last_name,
              registration_state = 'completed',
              temp_first_name = NULL,
              temp_last_name = NULL
          WHERE telegram_id = ${telegramId}
          RETURNING *
        `
        break
      default:
        throw new Error(`Unknown registration step: ${step}`)
    }

    const result = await updateQuery
    console.log(`User registration step updated:`, result[0])
    return result[0] as User
  } catch (error) {
    console.error("Error updating user registration step:", error)
    throw error
  }
}

export async function getUserByTelegramId(telegramId: number) {
  try {
    const result = await sql`
      SELECT * FROM users WHERE telegram_id = ${telegramId}
    `
    return result[0] as User | undefined
  } catch (error) {
    console.error("Error getting user by telegram id:", error)
    throw error
  }
}

export async function getUserByPhone(phone: string) {
  try {
    const normalizedPhone = phone.startsWith("+") ? phone.slice(1) : phone

    console.log(`Looking for user by phone: ${phone} -> ${normalizedPhone}`)

    const result = await sql`
      SELECT * FROM users WHERE phone = ${normalizedPhone}
    `

    console.log(`Found user:`, result[0] || "not found")
    return result[0] as User | undefined
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

    const result = await sql`
      SELECT phone, verified, first_name, last_name, full_name, name, telegram_id
      FROM users 
      WHERE phone = ANY(${normalizedPhones})
    `

    console.log(`Found ${result.length} users`)
    return result as Array<
      Pick<User, "phone" | "verified" | "first_name" | "last_name" | "full_name" | "name" | "telegram_id">
    >
  } catch (error) {
    console.error("Error getting users with verification:", error)
    throw error
  }
}

export async function createTrip() {
  try {
    const result = await sql`
      INSERT INTO trips (status) VALUES ('active')
      RETURNING *
    `
    return result[0] as Trip
  } catch (error) {
    console.error("Error creating trip:", error)
    throw error
  }
}

export async function updateTripStatus(tripId: number, status: string) {
  try {
    const result = await sql`
      UPDATE trips 
      SET status = ${status}
      WHERE id = ${tripId}
      RETURNING *
    `
    console.log(`Trip ${tripId} status updated to ${status}`)
    return result[0] as Trip
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

    const result = await sql`
      INSERT INTO trip_messages (
        trip_id, phone, message, telegram_id, response_status,
        trip_identifier, vehicle_number, planned_loading_time, driver_comment
      )
      VALUES (
        ${tripId}, ${normalizedPhone}, ${message}, ${telegramId || null}, 'pending',
        ${tripData?.trip_identifier || null}, ${tripData?.vehicle_number || null}, 
        ${tripData?.planned_loading_time || null}, ${tripData?.driver_comment || null}
      )
      RETURNING *
    `

    console.log(`DEBUG: Created trip message:`, result[0])
    return result[0] as TripMessage
  } catch (error) {
    console.error("Error creating trip message:", error)
    throw error
  }
}

export async function updateTripMessage(messageId: number, message: string) {
  try {
    const result = await sql`
      UPDATE trip_messages 
      SET message = ${message}
      WHERE id = ${messageId}
      RETURNING *
    `
    console.log(`Trip message ${messageId} updated with formatted content`)
    return result[0] as TripMessage
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
) {
  try {
    console.log(
      `DEBUG: Creating trip point - tripId: ${tripId}, pointId: ${pointId}, type: ${pointType}, num: ${pointNum}, tripIdentifier: ${tripIdentifier}`,
    )

    const pointResult = await sql`
      SELECT id FROM points WHERE point_id = ${pointId}
    `

    console.log(`DEBUG: Found point with ID ${pointId}:`, pointResult)

    if (pointResult.length === 0) {
      console.warn(`Point not found for point_id: ${pointId}`)
      return null
    }

    const result = await sql`
      INSERT INTO trip_points (trip_id, point_id, point_type, point_num, trip_identifier)
      VALUES (${tripId}, ${pointResult[0].id}, ${pointType}, ${pointNum}, ${tripIdentifier || null})
      RETURNING *
    `

    console.log(`DEBUG: Created trip point:`, result[0])
    return result[0] as TripPoint
  } catch (error) {
    console.error("Error creating trip point:", error)
    throw error
  }
}

export async function getAllPoints() {
  try {
    const result = await sql`
      SELECT * FROM points
      ORDER BY point_id ASC
    `
    return result as Point[]
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
) {
  try {
    const result = await sql`
      INSERT INTO points (point_id, point_name, door_open_1, door_open_2, door_open_3, latitude, longitude)
      VALUES (${pointId}, ${pointName}, ${doorOpen1 || null}, ${doorOpen2 || null}, ${doorOpen3 || null}, ${latitude || null}, ${longitude || null})
      RETURNING *
    `
    return result[0] as Point
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
) {
  try {
    const result = await sql`
      UPDATE points 
      SET point_id = ${pointId},
          point_name = ${pointName}, 
          door_open_1 = ${doorOpen1 || null},
          door_open_2 = ${doorOpen2 || null},
          door_open_3 = ${doorOpen3 || null},
          latitude = ${latitude || null},
          longitude = ${longitude || null},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `
    return result[0] as Point
  } catch (error) {
    console.error("Error updating point:", error)
    throw error
  }
}

export async function deletePoint(id: number) {
  try {
    await sql`
      DELETE FROM points WHERE id = ${id}
    `
    console.log(`Point ${id} deleted`)
  } catch (error) {
    console.error("Error deleting point:", error)
    throw error
  }
}

export async function getTripPoints(tripId: number) {
  try {
    const result = await sql`
      SELECT tp.*, p.point_name, p.point_id as point_short_id, p.door_open_1, p.door_open_2, p.door_open_3, p.latitude, p.longitude
      FROM trip_points tp
      JOIN points p ON tp.point_id = p.id
      WHERE tp.trip_id = ${tripId}
      ORDER BY tp.point_type, tp.point_num
    `
    return result as TripPoint[]
  } catch (error) {
    console.error("Error getting trip points:", error)
    throw error
  }
}

export async function updateMessageStatus(messageId: number, status: string, errorMessage?: string) {
  try {
    const result = await sql`
      UPDATE trip_messages 
      SET status = ${status}, 
          error_message = ${errorMessage || null},
          sent_at = ${status === "sent" ? new Date().toISOString() : null}
      WHERE id = ${messageId}
      RETURNING *
    `
    return result[0] as TripMessage
  } catch (error) {
    console.error("Error updating message status:", error)
    throw error
  }
}

export async function updateMessageResponse(messageId: number, responseStatus: string, responseComment?: string) {
  try {
    const result = await sql`
      UPDATE trip_messages 
      SET response_status = ${responseStatus}, 
          response_comment = ${responseComment || null},
          response_at = ${new Date().toISOString()}
      WHERE id = ${messageId}
      RETURNING *
    `
    return result[0] as TripMessage
  } catch (error) {
    console.error("Error updating message response:", error)
    throw error
  }
}

export async function setUserPendingAction(userId: number, actionType: string, relatedMessageId?: number) {
  try {
    const result = await sql`
      INSERT INTO user_pending_actions (user_id, action_type, related_message_id)
      VALUES (${userId}, ${actionType}, ${relatedMessageId || null})
      ON CONFLICT (user_id) DO UPDATE SET
        action_type = EXCLUDED.action_type,
        related_message_id = EXCLUDED.related_message_id,
        created_at = CURRENT_TIMESTAMP
      RETURNING *
    `
    console.log(`Pending action set for user ${userId}:`, result[0])
    return result[0] as UserPendingAction
  } catch (error) {
    console.error("Error setting user pending action:", error)
    throw error
  }
}

export async function getUserPendingAction(userId: number): Promise<UserPendingAction | undefined> {
  try {
    const result = await sql`
      SELECT * FROM user_pending_actions WHERE user_id = ${userId}
    `
    console.log(`Pending action for user ${userId}:`, result[0] || "not found")
    return result[0] as UserPendingAction | undefined
  } catch (error) {
    console.error("Error getting user pending action:", error)
    throw error
  }
}

export async function deleteUserPendingAction(userId: number) {
  try {
    await sql`
      DELETE FROM user_pending_actions WHERE user_id = ${userId}
    `
    console.log(`Pending action deleted for user ${userId}`)
  } catch (error) {
    console.error("Error deleting user pending action:", error)
    throw error
  }
}

export async function getTripMessageByTelegramId(telegramUserId: number, tripMessageId: number) {
  try {
    const result = await sql`
      SELECT tm.* 
      FROM trip_messages tm
      JOIN users u ON tm.telegram_id = u.telegram_id
      WHERE u.telegram_id = ${telegramUserId} AND tm.id = ${tripMessageId}
      LIMIT 1
    `
    console.log(
      `Trip message for telegram_id ${telegramUserId} and message_id ${tripMessageId}:`,
      result[0] || "not found",
    )
    return result[0] as TripMessage | undefined
  } catch (error) {
    console.error("Error getting trip message by telegram id:", error)
    throw error
  }
}

export async function getTripMessages(tripId: number) {
  try {
    const result = await sql`
      SELECT tm.*, u.first_name, u.full_name
      FROM trip_messages tm
      LEFT JOIN users u ON tm.telegram_id = u.telegram_id
      WHERE tm.trip_id = ${tripId}
      ORDER BY tm.created_at DESC
    `
    return result as (TripMessage & { first_name?: string; full_name?: string })[]
  } catch (error) {
    console.error("Error getting trip messages:", error)
    throw error
  }
}

export async function getTrips() {
  try {
    const result = await sql`
      SELECT t.*, 
             COUNT(tm.id) as total_messages,
             COUNT(CASE WHEN tm.status = 'sent' THEN 1 END) as sent_messages,
             COUNT(CASE WHEN tm.status = 'error' THEN 1 END) as error_messages,
             COUNT(CASE WHEN tm.response_status = 'confirmed' THEN 1 END) as confirmed_responses,
             COUNT(CASE WHEN tm.response_status = 'rejected' THEN 1 END) as rejected_responses,
             COUNT(CASE WHEN tm.response_status = 'pending' AND tm.status = 'sent' THEN 1 END) as pending_responses,
             MIN(tm.sent_at) as first_sent_at,
             MAX(tm.sent_at) as last_sent_at
      FROM trips t
      LEFT JOIN trip_messages tm ON t.id = tm.trip_id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `
    return result
  } catch (error) {
    console.error("Error getting trips:", error)
    throw error
  }
}

export async function getAllUsers() {
  try {
    const result = await sql`
      SELECT id, telegram_id, phone, name, first_name, last_name, full_name, carpark, created_at, registration_state, verified
      FROM users
      ORDER BY created_at DESC
    `
    return result as User[]
  } catch (error) {
    console.error("Error getting all users:", error)
    throw error
  }
}

// Функции для обратной совместимости (старые названия)
export async function createCampaign() {
  return createTrip()
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

export async function getCampaignMessageByTelegramId(telegramUserId: number, messageId: number) {
  return getTripMessageByTelegramId(telegramUserId, messageId)
}

export async function getCampaignMessages(tripId: number) {
  return getTripMessages(tripId)
}

export async function getCampaigns() {
  return getTrips()
}

export async function getTripDataForMessages(tripId: number) {
  try {
    const result = await sql`
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
      WHERE tm.trip_id = ${tripId}
      ORDER BY tm.phone, tm.trip_identifier, tp.point_type, tp.point_num
    `
    return result
  } catch (error) {
    console.error("Error getting trip data for messages:", error)
    throw error
  }
}

export async function getTripDataGroupedByPhone(tripId: number) {
  try {
    console.log(`=== DEBUG: getTripDataGroupedByPhone for tripId: ${tripId} ===`)

    const result = await sql`
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
      WHERE tm.trip_id = ${tripId} AND tm.status = 'pending' AND tm.telegram_id IS NOT NULL
      ORDER BY tm.phone, tm.trip_identifier
    `

    console.log(`DEBUG: Found ${result.length} trip messages:`)
    result.forEach((row, index) => {
      console.log(`  ${index + 1}. Phone: ${row.phone}, Trip: ${row.trip_identifier}, Vehicle: ${row.vehicle_number}`)
    })

    const groupedData = new Map()

    for (const row of result) {
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

        const tripPointsResult = await sql`
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
          WHERE tp.trip_id = ${tripId} AND tp.trip_identifier = ${row.trip_identifier}
          ORDER BY tp.point_type DESC, tp.point_num
        `

        console.log(`DEBUG: Found ${tripPointsResult.length} points for trip ${row.trip_identifier}:`)
        tripPointsResult.forEach((point, index) => {
          console.log(
            `  ${index + 1}. Type: ${point.point_type}, Num: ${point.point_num}, ID: ${point.point_id}, Name: ${point.point_name}`,
          )
        })

        const loading_points = []
        const unloading_points = []

        for (const point of tripPointsResult) {
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
    // Удаляем связанные записи в правильном порядке
    await sql`DELETE FROM trip_messages WHERE trip_id = ${tripId}`
    await sql`DELETE FROM trip_points WHERE trip_id = ${tripId}`
    await sql`DELETE FROM trips WHERE id = ${tripId}`

    console.log(`Trip ${tripId} and related records deleted`)
  } catch (error) {
    console.error("Error deleting trip:", error)
    throw error
  }
}
