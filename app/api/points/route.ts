import { NextResponse } from "next/server"
import { getAllPoints, createPoint } from "@/lib/database"

export async function GET() {
  try {
    const points = await getAllPoints()
    return NextResponse.json({ success: true, points })
  } catch (error) {
    console.error("Get points error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка при получении пунктов",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const { point_id, point_name, door_open_1, door_open_2, door_open_3, latitude, longitude, adress } =
      await request.json()

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

    const point = await createPoint(
      point_id.trim().toUpperCase(),
      point_name.trim(),
      door_open_1?.trim() || undefined,
      door_open_2?.trim() || undefined,
      door_open_3?.trim() || undefined,
      latitude?.trim() || undefined,
      longitude?.trim() || undefined,
      adress?.trim() || undefined,
    )

    return NextResponse.json({ success: true, point })
  } catch (error) {
    console.error("Create point error:", error)

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
        error: "Ошибка при создании пункта",
      },
      { status: 500 },
    )
  }
}
