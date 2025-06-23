import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = Number.parseInt(params.id)
    const body = await request.json()

    const { first_name, last_name, full_name, carpark, role, verified, registration_state } = body

    await sql`
      UPDATE users 
      SET 
        first_name = ${first_name || null},
        last_name = ${last_name || null},
        full_name = ${full_name || null},
        carpark = ${carpark || null},
        role = ${role || "driver"},
        verified = ${verified || false},
        registration_state = ${registration_state || "completed"}
      WHERE id = ${userId}
    `

    return NextResponse.json({
      success: true,
      message: "Пользователь обновлен успешно",
    })
  } catch (error) {
    console.error("Update user error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при обновлении пользователя",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = Number.parseInt(params.id)

    await sql`DELETE FROM users WHERE id = ${userId}`

    return NextResponse.json({
      success: true,
      message: "Пользователь удален успешно",
    })
  } catch (error) {
    console.error("Delete user error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при удалении пользователя",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      },
      { status: 500 },
    )
  }
}
