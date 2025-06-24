import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = Number.parseInt(params.id)
    const { name, first_name, last_name, carpark, role } = await request.json()

    console.log(`Updating user ${userId}:`, { name, first_name, last_name, carpark, role })

    const result = await sql`
      UPDATE users 
      SET name = ${name},
          first_name = ${first_name},
          last_name = ${last_name},
          full_name = ${first_name && last_name ? `${first_name} ${last_name}` : name},
          carpark = ${carpark},
          role = ${role}
      WHERE id = ${userId}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
    }

    console.log(`User ${userId} updated successfully`)

    return NextResponse.json({
      success: true,
      user: result[0],
    })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json(
      {
        error: "Ошибка при обновлении пользователя",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
