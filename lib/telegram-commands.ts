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

    // Устанавливаем команды для всех пользователей
    const response = await fetch(`${TELEGRAM_API_URL}/setMyCommands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        commands: commands,
        scope: {
          type: "default",
        },
        language_code: "ru",
      }),
    })

    const data = await response.json()
    console.log("Telegram setMyCommands response:", JSON.stringify(data, null, 2))

    if (!data.ok) {
      throw new Error(data.description || "Failed to set commands")
    }

    // Также устанавливаем для приватных чатов
    const privateResponse = await fetch(`${TELEGRAM_API_URL}/setMyCommands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        commands: commands,
        scope: {
          type: "all_private_chats",
        },
        language_code: "ru",
      }),
    })

    const privateData = await privateResponse.json()
    console.log("Telegram setMyCommands (private) response:", JSON.stringify(privateData, null, 2))

    console.log("✅ Telegram bot commands set successfully for all scopes")
    console.log("Commands set:", commands)

    return { default: data.result, private: privateData.result }
  } catch (error) {
    console.error("❌ Error setting Telegram commands:", error)
    throw error
  }
}

export async function deleteTelegramCommands() {
  try {
    console.log("=== DELETING ALL TELEGRAM COMMANDS ===")

    // Удаляем команды для всех областей
    const scopes = [
      { type: "default" },
      { type: "all_private_chats" },
      { type: "all_group_chats" },
      { type: "all_chat_administrators" },
    ]

    const results = []

    for (const scope of scopes) {
      try {
        const response = await fetch(`${TELEGRAM_API_URL}/deleteMyCommands`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scope }),
        })

        const data = await response.json()
        console.log(`Delete commands for scope ${scope.type}:`, data)
        results.push({ scope: scope.type, success: data.ok, data })
      } catch (error) {
        console.error(`Error deleting commands for scope ${scope.type}:`, error)
        results.push({ scope: scope.type, success: false, error })
      }
    }

    console.log("✅ Telegram bot commands deletion completed for all scopes")
    return results
  } catch (error) {
    console.error("❌ Error deleting Telegram commands:", error)
    throw error
  }
}

export async function setCustomTelegramCommands(commands: Array<{ command: string; description: string }>) {
  try {
    console.log("=== SETTING CUSTOM TELEGRAM COMMANDS ===")
    console.log("Custom commands to set:", JSON.stringify(commands, null, 2))

    // Устанавливаем для всех областей
    const scopes = [{ type: "default" }, { type: "all_private_chats" }]

    const results = []

    for (const scope of scopes) {
      try {
        const response = await fetch(`${TELEGRAM_API_URL}/setMyCommands`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            commands: commands,
            scope: scope,
            language_code: "ru",
          }),
        })

        const data = await response.json()
        console.log(`Set commands for scope ${scope.type}:`, data)
        results.push({ scope: scope.type, success: data.ok, data })

        if (!data.ok) {
          console.error(`Failed to set commands for scope ${scope.type}:`, data.description)
        }
      } catch (error) {
        console.error(`Error setting commands for scope ${scope.type}:`, error)
        results.push({ scope: scope.type, success: false, error })
      }
    }

    console.log("✅ Custom Telegram bot commands set for all scopes")
    return results
  } catch (error) {
    console.error("❌ Error setting custom Telegram commands:", error)
    throw error
  }
}

// Новая функция для получения команд всех областей
export async function getAllTelegramCommands() {
  try {
    console.log("=== GETTING ALL TELEGRAM COMMANDS ===")

    const scopes = [
      { type: "default" },
      { type: "all_private_chats" },
      { type: "all_group_chats" },
      { type: "all_chat_administrators" },
    ]

    const results = []

    for (const scope of scopes) {
      try {
        const response = await fetch(`${TELEGRAM_API_URL}/getMyCommands`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scope }),
        })

        const data = await response.json()
        results.push({
          scope: scope.type,
          success: data.ok,
          commands: data.result || [],
          count: data.result ? data.result.length : 0,
        })
      } catch (error) {
        console.error(`Error getting commands for scope ${scope.type}:`, error)
        results.push({ scope: scope.type, success: false, error, commands: [], count: 0 })
      }
    }

    console.log("Commands by scope:", results)
    return results
  } catch (error) {
    console.error("❌ Error getting all Telegram commands:", error)
    throw error
  }
}
