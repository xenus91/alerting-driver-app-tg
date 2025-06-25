const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`

export async function setTelegramBotCommands() {
  try {
    const commands = [
      {
        command: "start",
        description: "🚀 Начать работу с ботом / Регистрация",
      },
      {
        command: "toroute",
        description: "🗺️ Построить маршрут между точками",
      },
    ]

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

    if (!data.ok) {
      throw new Error(data.description || "Failed to set bot commands")
    }

    console.log("✅ Bot commands set successfully:", commands)
    return data.result
  } catch (error) {
    console.error("❌ Error setting bot commands:", error)
    throw error
  }
}

export async function getTelegramBotCommands() {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/getMyCommands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })

    const data = await response.json()

    if (!data.ok) {
      throw new Error(data.description || "Failed to get bot commands")
    }

    return data.result
  } catch (error) {
    console.error("Error getting bot commands:", error)
    throw error
  }
}
