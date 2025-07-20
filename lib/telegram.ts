import { TelegramClient } from "telegram"
import { StringSession } from "telegram/sessions"
import { Api } from "telegram/tl"
import { getAppConfig } from "./app-config"

const apiId = Number.parseInt(process.env.TELEGRAM_API_ID || "0")
const apiHash = process.env.TELEGRAM_API_HASH || ""
const botToken = process.env.TELEGRAM_BOT_TOKEN || ""
const stringSession = new StringSession(process.env.TELEGRAM_STRING_SESSION || "") // fill this out

interface PointData {
  point_type: "P" | "D"
  point_num: number
  point_id: string
  point_name?: string
  latitude?: string
  longitude?: string
  reception_windows?: string
}

interface TripData {
  trip_id: number
  trip_identifier: string
  vehicle_number: string
  planned_loading_time: string
  driver_comment?: string
  message_id: number
  points: PointData[]
}

let client: TelegramClient | null = null

async function getTelegramClient() {
  if (client) {
    return client
  }

  client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  })

  await client.start({
    botAuthToken: botToken,
  })

  console.log("Telegram client started.")
  return client
}

export interface TelegramMessage {
  message_id: number
  from: {
    id: number
    first_name: string
    last_name?: string
    username?: string
  }
  chat: {
    id: number
    type: string
  }
  text?: string
  contact?: {
    phone_number: string
    first_name: string
    last_name?: string
  }
}

export interface TelegramCallbackQuery {
  id: string
  from: {
    id: number
    first_name: string
    last_name?: string
    username?: string
  }
  message?: TelegramMessage
  data?: string
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

export async function sendReplyToMessage(chatId: number, replyToMessageId: number, text: string) {
  try {
    const client = await getTelegramClient()
    const result = await client.sendMessage(chatId, {
      message: text,
      parseMode: "HTML",
      replyToMessageId: replyToMessageId,
    })
    return { success: true, messageId: result.id }
  } catch (error: any) {
    console.error("Error sending reply message:", error)
    return { success: false, error: error.message }
  }
}

export async function sendMessage(chatId: number, text: string) {
  try {
    const client = await getTelegramClient()
    const result = await client.sendMessage(chatId, {
      message: text,
      parseMode: "HTML",
    })
    return { success: true, messageId: result.id }
  } catch (error: any) {
    console.error("Error sending Telegram message:", error)
    return { success: false, error: error.message }
  }
}

export async function editMessageReplyMarkup(chatId: number, messageId: number, replyMarkup?: any) {
  console.log("=== EDITING MESSAGE REPLY MARKUP ===")
  console.log("Chat ID:", chatId)
  console.log("Message ID:", messageId)
  console.log("New reply markup:", JSON.stringify(replyMarkup, null, 2))

  try {
    const client = await getTelegramClient()
    await client.editMessage(chatId, messageId, {
      replyMarkup: replyMarkup,
    })
    console.log("=== MESSAGE REPLY MARKUP EDITED SUCCESSFULLY ===")
    return { success: true }
  } catch (error: any) {
    console.error("Error editing message reply markup:", error)
    return { success: false, error: error.message }
  }
}

function buildRouteUrl(points: PointData[]): string | null {
  // Ensure all points have latitude and longitude
  const allPointsHaveCoords = points.every((p) => p.latitude && p.longitude)
  if (!allPointsHaveCoords) {
    return null // Cannot build route if any point is missing coordinates
  }

  const baseUrl = "https://yandex.ru/maps/buildroute?"
  const params = []

  points.forEach((point, index) => {
    params.push(`r%5B${index}%5D%5Bpoint%5D=${point.longitude}%2C${point.latitude}`)
    params.push(`r%5B${index}%5D%5Btext%5D=${encodeURIComponent(point.point_name || point.point_id)}`)
  })

  params.push("r%5Btype%5D=auto")
  params.push("z=10") // Zoom level

  return baseUrl + params.join("&")
}

export async function sendContactRequest(chatId: number) {
  try {
    const client = await getTelegramClient()
    const result = await client.sendMessage(chatId, {
      message: "Пожалуйста, поделитесь своим номером телефона для регистрации в системе рассылки.",
      replyMarkup: new Api.ReplyKeyboardMarkup({
        resizeKeyboard: true,
        oneTimeKeyboard: true,
        rows: [
          [
            new Api.KeyboardButton({
              text: "📱 Поделиться номером",
              requestContact: true,
            }),
          ],
        ],
      }),
    })
    return { success: true, messageId: result.id }
  } catch (error: any) {
    console.error("Error sending contact request:", error)
    return { success: false, error: error.message }
  }
}

export async function sendMultipleTripMessageWithButtons(
  chatId: number,
  trips: TripData[],
  isCorrection = false,
  isResend = false,
  deletedTripIdentifiers: string[] = [],
) {
  try {
    let fullMessage = ""

    if (isCorrection) {
      fullMessage += `🔄 <b>КОРРЕКТИРОВКА РЕЙСОВ</b>\n\n`
    } else if (isResend) {
      fullMessage += `🔄 <b>ПОВТОРНАЯ ОТПРАВКА ЗАЯВОК</b>\n\n`
    }

    // Add deleted trips info if any
    if (deletedTripIdentifiers.length > 0) {
      fullMessage += `❌ <b>Удаленные рейсы:</b> ${deletedTripIdentifiers.join(", ")}\n\n`
    }

    const appConfig = await getAppConfig()
    const botUsername = appConfig.NEXT_PUBLIC_BOT_USERNAME

    const inlineKeyboardButtons: Api.KeyboardButtonRow[] = []

    // Sort trips by planned_loading_time
    const sortedTrips = [...trips].sort(
      (a, b) => new Date(a.planned_loading_time).getTime() - new Date(b.planned_loading_time).getTime(),
    )

    sortedTrips.forEach((trip, tripIndex) => {
      fullMessage += `<b>Рейс ${tripIndex + 1}:</b>\n`
      fullMessage += `Транспортировка: <b>${trip.trip_identifier}</b>\n`
      fullMessage += `Транспорт: <b>${trip.vehicle_number}</b>\n`

      const plannedLoadingDate = new Date(trip.planned_loading_time)
      const formattedDate = plannedLoadingDate.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      const formattedTime = plannedLoadingDate.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
      fullMessage += `Плановое время погрузки: <b>${formattedDate} ${formattedTime}</b>\n`

      if (trip.driver_comment) {
        fullMessage += `Комментарий: <i>${trip.driver_comment}</i>\n`
      }

      fullMessage += `\n<b>Маршрут:</b>\n`

      // Combine and sort all points by point_num
      const allPoints = [...trip.points].sort((a, b) => a.point_num - b.point_num)

      let hasAllCoordinates = true
      allPoints.forEach((point, index) => {
        const pointTypeIcon = point.point_type === "P" ? "📦" : "📤"
        const pointTypeName = point.point_type === "P" ? "Погрузка" : "Разгрузка"
        fullMessage += `${index + 1}) ${pointTypeIcon} <b>${point.point_id} ${point.point_name}</b> (${pointTypeName})\n`
        if (point.latitude && point.longitude) {
          fullMessage += `   <a href="http://maps.google.com/maps?q=${point.latitude},${point.longitude}">Показать на карте</a>\n`
        } else {
          hasAllCoordinates = false // If any point lacks coordinates, we won't build the full route
        }
        if (point.reception_windows) {
          fullMessage += `   Окна приемки: ${point.reception_windows}\n`
        }
      })

      // Build route URL only if all points have coordinates
      if (hasAllCoordinates && allPoints.length > 1) {
        const routeUrl = buildRouteUrl(allPoints)
        if (routeUrl) {
          fullMessage += `\n<a href="${routeUrl}">Построить маршрут</a>\n`
        }
      }

      fullMessage += `\n` // Add a newline for separation between trips

      // Add buttons for each trip
      inlineKeyboardButtons.push([
        new Api.KeyboardButtonCallback({
          text: `✅ Подтвердить ${trip.trip_identifier}`,
          data: Buffer.from(`confirm_${trip.trip_id}`),
        }),
      ])
      inlineKeyboardButtons.push([
        new Api.KeyboardButtonCallback({
          text: `❌ Отказаться ${trip.trip_identifier}`,
          data: Buffer.from(`reject_${trip.trip_id}`),
        }),
      ])
      inlineKeyboardButtons.push([
        new Api.KeyboardButtonCallback({
          text: `⛔ Отклонить ${trip.trip_identifier}`,
          data: Buffer.from(`decline_${trip.trip_id}`),
        }),
      ])
      inlineKeyboardButtons.push([
        new Api.KeyboardButtonUrl({
          text: `💬 Чат с диспетчером ${trip.trip_identifier}`,
          url: `https://t.me/${botUsername}?start=chat_${trip.trip_id}`,
        }),
      ])
      inlineKeyboardButtons.push([
        new Api.KeyboardButtonUrl({ text: "📞 Позвонить диспетчеру", url: "tel:+79050550020" }),
      ])
      inlineKeyboardButtons.push([
        new Api.KeyboardButtonUrl({ text: "📞 Позвонить оператору", url: "tel:+79050550020" }),
      ])
    })

    const replyMarkup = new Api.ReplyInlineMarkup({
      rows: inlineKeyboardButtons,
    })

    // Check if there's an existing message to edit
    const existingMessageId = sortedTrips[0]?.message_id // Assuming all trips in a correction share the same message_id for now

    if (existingMessageId && isCorrection) {
      const editResult = await editTelegramMessage(chatId, existingMessageId, fullMessage, replyMarkup)
      if (editResult.success) {
        return { success: true, messageId: existingMessageId }
      } else {
        return { success: false, error: editResult.error }
      }
    } else {
      const sendResult = await sendTelegramMessage(chatId, fullMessage, replyMarkup)
      return sendResult
    }
  } catch (error: any) {
    console.error("Error in sendMultipleTripMessageWithButtons:", error)
    return { success: false, error: error.message }
  }
}

export async function sendTelegramMessage(
  chatId: number,
  message: string,
  replyMarkup?: Api.TypeReplyMarkup,
  parseMode: "html" | "markdown" | undefined = "html",
) {
  try {
    const client = await getTelegramClient()
    const result = await client.sendMessage(chatId, {
      message: message,
      parseMode: parseMode,
      replyMarkup: replyMarkup,
    })
    return { success: true, messageId: result.id }
  } catch (error: any) {
    console.error("Error sending Telegram message:", error)
    return { success: false, error: error.message }
  }
}

export async function editTelegramMessage(
  chatId: number,
  messageId: number,
  message: string,
  replyMarkup?: Api.TypeReplyMarkup,
  parseMode: "html" | "markdown" | undefined = "html",
) {
  try {
    const client = await getTelegramClient()
    await client.editMessage(chatId, messageId, {
      message: message,
      parseMode: parseMode,
      replyMarkup: replyMarkup,
    })
    return { success: true }
  } catch (error: any) {
    console.error("Error editing Telegram message:", error)
    return { success: false, error: error.message }
  }
}

export async function deleteTelegramMessage(chatId: number, messageId: number) {
  try {
    const client = await getTelegramClient()
    await client.deleteMessages(chatId, [messageId], { revoke: true })
    return { success: true }
  } catch (error: any) {
    console.error("Error deleting Telegram message:", error)
    return { success: false, error: error.message }
  }
}

export async function sendMessageWithButtons(chatId: number, text: string, messageId: number) {
  try {
    const client = await getTelegramClient()
    const result = await client.sendMessage(chatId, {
      message: text,
      parseMode: "HTML",
      replyMarkup: new Api.ReplyInlineMarkup({
        rows: [
          [
            new Api.KeyboardButtonCallback({
              text: "✅ Подтвердить",
              data: Buffer.from(`confirm_${messageId}`),
            }),
          ],
          [
            new Api.KeyboardButtonCallback({
              text: "❌ Отклонить",
              data: Buffer.from(`reject_${messageId}`),
            }),
          ],
        ],
      }),
    })
    return { success: true, messageId: result.id }
  } catch (error: any) {
    console.error("Error sending Telegram message with buttons:", error)
    return { success: false, error: error.message }
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  try {
    const client = await getTelegramClient()
    await client.invoke(
      new Api.messages.SetBotCallbackAnswer({
        callbackQueryId: callbackQueryId,
        message: text,
        showAlert: false,
      }),
    )
    return { success: true }
  } catch (error: any) {
    console.error("Error answering callback query:", error)
    return { success: false, error: error.message }
  }
}

export async function setTelegramCommands(chatId: number, commands: Api.BotCommand[]) {
  try {
    const client = await getTelegramClient()
    await client.invoke(
      new Api.bots.SetBotCommands({
        scope: new Api.BotCommandScopeAllPrivateChats(),
        langCode: "ru",
        commands: commands,
      }),
    )
    return { success: true }
  } catch (error: any) {
    console.error("Error setting Telegram commands:", error)
    return { success: false, error: error.message }
  }
}

export async function getTelegramCommands(chatId: number) {
  try {
    const client = await getTelegramClient()
    const result = await client.invoke(
      new Api.bots.GetBotCommands({
        scope: new Api.BotCommandScopeAllPrivateChats(),
        langCode: "ru",
      }),
    )
    return { success: true, commands: result }
  } catch (error: any) {
    console.error("Error getting Telegram commands:", error)
    return { success: false, error: error.message }
  }
}

export async function deleteTelegramCommands(chatId: number) {
  try {
    const client = await getTelegramClient()
    await client.invoke(
      new Api.bots.ResetBotCommands({
        scope: new Api.BotCommandScopeAllPrivateChats(),
        langCode: "ru",
      }),
    )
    return { success: true }
  } catch (error: any) {
    console.error("Error deleting Telegram commands:", error)
    return { success: false, error: error.message }
  }
}

export async function getWebhookInfo() {
  try {
    const client = await getTelegramClient()
    const info = await client.invoke(new Api.bots.GetWebhookInfo({}))
    return { success: true, info }
  } catch (error: any) {
    console.error("Error getting webhook info:", error)
    return { success: false, error: error.message }
  }
}

export async function setWebhook(url: string, dropPendingUpdates = false) {
  try {
    const client = await getTelegramClient()
    const result = await client.invoke(
      new Api.bots.SetWebhook({
        url: url,
        dropPendingUpdates: dropPendingUpdates,
      }),
    )
    return { success: true, result }
  } catch (error: any) {
    console.error("Error setting webhook:", error)
    return { success: false, error: error.message }
  }
}

export async function deleteWebhook(dropPendingUpdates = false) {
  try {
    const client = await getTelegramClient()
    const result = await client.invoke(
      new Api.bots.DeleteWebhook({
        dropPendingUpdates: dropPendingUpdates,
      }),
    )
    return { success: true, result }
  } catch (error: any) {
    console.error("Error deleting webhook:", error)
    return { success: false, error: error.message }
  }
}
