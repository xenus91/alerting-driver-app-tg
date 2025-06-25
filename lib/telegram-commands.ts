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
      throw new Error(data.description || "Failed to set commands")
    }

    console.log("✅ Telegram bot commands set successfully:", commands)
    return data.result
  } catch (error) {
    console.error("❌ Error setting Telegram commands:", error)
    throw error
  }
}
