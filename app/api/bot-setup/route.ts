import { type NextRequest, NextResponse } from "next/server"

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME

export async function POST(request: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ success: false, error: "TELEGRAM_BOT_TOKEN не настроен" }, { status: 500 })
  }

  try {
    const { action, description, shortDescription } = await request.json()

    if (action === "setDescription") {
      // Устанавливаем полное описание бота
      const descriptionResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyDescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description:
            description ||
            `🚗 Система управления рейсами и водителями

Этот бот поможет вам:
• Получать уведомления о новых рейсах
• Подтверждать или отклонять рейсы
• Управлять своим статусом водителя
• Получать информацию о маршрутах

Для начала работы поделитесь своим контактом.`,
          language_code: "ru",
        }),
      })

      // Устанавливаем короткое описание
      const shortDescResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyShortDescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          short_description: shortDescription || "🚗 Система управления рейсами для водителей",
          language_code: "ru",
        }),
      })

      const descResult = await descriptionResponse.json()
      const shortResult = await shortDescResponse.json()

      if (descResult.ok && shortResult.ok) {
        return NextResponse.json({
          success: true,
          message: "Описание бота успешно обновлено",
          description: descResult,
          shortDescription: shortResult,
        })
      } else {
        return NextResponse.json({
          success: false,
          error: "Ошибка при установке описания",
          details: { descResult, shortResult },
        })
      }
    }

    if (action === "setCommands") {
      // Устанавливаем команды бота
      const commandsResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commands: [
            {
              command: "start",
              description: "Начать работу с ботом",
            },
            {
              command: "help",
              description: "Помощь по использованию бота",
            },
            {
              command: "status",
              description: "Проверить статус регистрации",
            },
          ],
          language_code: "ru",
        }),
      })

      const commandsResult = await commandsResponse.json()

      if (commandsResult.ok) {
        return NextResponse.json({
          success: true,
          message: "Команды бота успешно установлены",
          commands: commandsResult,
        })
      } else {
        return NextResponse.json({
          success: false,
          error: "Ошибка при установке команд",
          details: commandsResult,
        })
      }
    }

    return NextResponse.json({ success: false, error: "Неизвестное действие" })
  } catch (error) {
    console.error("Ошибка настройки бота:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Внутренняя ошибка сервера",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ success: false, error: "TELEGRAM_BOT_TOKEN не настроен" }, { status: 500 })
  }

  try {
    // Получаем текущую информацию о боте
    const botInfoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`)
    const botInfo = await botInfoResponse.json()

    // Получаем текущие команды
    const commandsResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyCommands`)
    const commands = await commandsResponse.json()

    // Получаем описание (может не работать в старых версиях API)
    let description = null
    try {
      const descResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMyDescription`)
      description = await descResponse.json()
    } catch (e) {
      // Игнорируем ошибку, если метод не поддерживается
    }

    return NextResponse.json({
      success: true,
      botInfo: botInfo.result,
      commands: commands.result,
      description: description?.result,
      botUsername: BOT_USERNAME,
    })
  } catch (error) {
    console.error("Ошибка получения информации о боте:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка получения информации о боте",
      },
      { status: 500 },
    )
  }
}
