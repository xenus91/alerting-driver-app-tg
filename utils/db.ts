import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function getUserByTelegramId(telegramId: number) {
  try {
    const result = await sql`
      SELECT * FROM users 
      WHERE telegram_id = ${telegramId}
      LIMIT 1
    `

    return result[0] || null
  } catch (error) {
    console.error("Error getting user by telegram ID:", error)
    throw error
  }
}

export async function createUser(userData: {
  telegram_id: number
  first_name?: string
  last_name?: string
  username?: string
  phone?: string
}) {
  try {
    const result = await sql`
      INSERT INTO users (
        telegram_id, 
        first_name, 
        last_name, 
        username, 
        phone,
        registration_state
      )
      VALUES (
        ${userData.telegram_id},
        ${userData.first_name || null},
        ${userData.last_name || null},
        ${userData.username || null},
        ${userData.phone || null},
        'pending'
      )
      RETURNING *
    `

    return result[0]
  } catch (error) {
    console.error("Error creating user:", error)
    throw error
  }
}

export async function updateUser(
  telegramId: number,
  userData: {
    phone?: string
    first_name?: string
    last_name?: string
    registration_state?: string
  },
) {
  try {
    const result = await sql`
      UPDATE users 
      SET 
        phone = COALESCE(${userData.phone || null}, phone),
        first_name = COALESCE(${userData.first_name || null}, first_name),
        last_name = COALESCE(${userData.last_name || null}, last_name),
        registration_state = COALESCE(${userData.registration_state || null}, registration_state),
        full_name = CASE 
          WHEN ${userData.first_name || null} IS NOT NULL OR ${userData.last_name || null} IS NOT NULL 
          THEN CONCAT(
            COALESCE(${userData.first_name || null}, first_name, ''), 
            ' ', 
            COALESCE(${userData.last_name || null}, last_name, '')
          )
          ELSE full_name
        END
      WHERE telegram_id = ${telegramId}
      RETURNING *
    `

    return result[0] || null
  } catch (error) {
    console.error("Error updating user:", error)
    throw error
  }
}
