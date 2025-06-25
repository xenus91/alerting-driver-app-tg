const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

export async function setTelegramCommands() {
  try {
    const commands = [
      {
        command: "start",
        description: "🚀 Начать работу с ботом",
      },
      {
        command: "toroute",
        description: "🗺️ Построить маршрут между точками",
      },
      {
        command: "status",
        description: "📊 Проверить статус регистрации",
      },
      {
        command: "help",
        description: "❓ Получить справку",
      },
    ]

    console.log("=== SETTING TELEGRAM COMMANDS ===")
    console.log("Commands to set:", JSON.stringify(commands, null, 2))

    const response = await fetch(`${TELEGRAM_API_URL}/setMyCommands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        commands: commands,
      }),
    })

    const data = await response.json()
    console.log("Telegram setMyCommands response:", JSON.stringify(data, null, 2))

    if (!data.ok) {
      throw new Error(data.description || "Failed to set commands")
    }

    console.log("✅ Telegram bot commands set successfully")
    console.log("Commands set:", commands)

    return data.result
  } catch (error) {
    console.error("❌ Error setting Telegram commands:", error)
    throw error
  }
}

export async function deleteTelegramCommands() {
  try {
    console.log("=== DELETING ALL TELEGRAM COMMANDS ===")

    const response = await fetch(`${TELEGRAM_API_URL}/deleteMyCommands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })

    const data = await response.json()
    console.log("Telegram deleteMyCommands response:", JSON.stringify(data, null, 2))

    if (!data.ok) {
      throw new Error(data.description || "Failed to delete commands")
    }

    console.log("✅ All Telegram bot commands deleted successfully")
    return data.result
  } catch (error) {
    console.error("❌ Error deleting Telegram commands:", error)
    throw error
  }
}
