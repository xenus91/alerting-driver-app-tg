import { NextResponse } from "next/server"
import { updatePoint, deletePoint } from "@/lib/database"

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number.parseInt(params.id)
    const { point_id, point_name, door_open_1, door_open_2, door_open_3 } = await request.json()

    if (!point_id?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Номер пункта обязателен",
        },
        { status: 400 },
      )
    }

    if (!point_name?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Название пункта обязательно",
        },
        { status: 400 },
      )
    }

    const point = await updatePoint(
      id,
      point_id.trim().toUpperCase(),
      point_name.trim(),
      door_open_1?.trim() || undefined,
      door_open_2?.trim() || undefined,
      door_open_3?.trim() || undefined,
    )

    return NextResponse.json({ success: true, point })
  } catch (error) {
    console.error("Update point error:", error)

    // Проверяем на ошибку уникальности
    if (error instanceof Error && error.message.includes("unique")) {
      return NextResponse.json(
        {
          success: false,
          error: "Пункт с таким номером уже существует",
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при обновлении пункта",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number.parseInt(params.id)
    await deletePoint(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete point error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при удалении пункта",
      },
      { status: 500 },
    )
  }
}
