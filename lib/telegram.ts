// lib/telegram.ts

import TelegramBot from "node-telegram-bot-api"

const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  console.error("Telegram bot token is not defined in environment variables.")
  process.exit(1)
}

const bot = new TelegramBot(token, { polling: true })

interface TripPoint {
  latitude: number | string
  longitude: number | string
}

function buildRouteUrl(points: any[]): string | null {
  // Проверяем, что все точки имеют координаты
  const validPoints = points.filter(
    (point) =>
      point.latitude &&
      point.longitude &&
      point.latitude.toString().trim() !== "" &&
      point.longitude.toString().trim() !== "",
  )

  // Если не все точки имеют координаты, не строим маршрут
  if (validPoints.length !== points.length || validPoints.length < 2) {
    return null
  }

  const coordinates = validPoints.map((point) => `${point.longitude},${point.latitude}`).join("~")
  return `https://yandex.ru/maps/?rtext=${coordinates}&rtt=auto`
}

async function sendMultipleTripMessageWithButtons(
  chatId: number,
  messageText: string,
  allPoints: any[],
): Promise<void> {
  let message = messageText

  // Проверяем, есть ли координаты у всех точек для построения маршрута
  const allPointsHaveCoordinates = allPoints.every(
    (point) =>
      point.latitude &&
      point.longitude &&
      point.latitude.toString().trim() !== "" &&
      point.longitude.toString().trim() !== "",
  )

  if (allPointsHaveCoordinates && allPoints.length > 1) {
    const routeUrl = buildRouteUrl(allPoints)
    if (routeUrl) {
      message += `\n🗺️ [Построить маршрут](${routeUrl})\n`
    }
  }

  try {
    await bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    })
  } catch (error) {
    console.error("Error sending Telegram message:", error)
  }
}

export { bot, sendMultipleTripMessageWithButtons }
