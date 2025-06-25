import { NextResponse } from "next/server"
import { deleteTelegramCommands, setTelegramCommands } from "@/lib/telegram-commands"

export async function POST() {
  try {
    console.log("🔄 FORCE REFRESH: Starting complete commands refresh...")

    // 1. Удаляем все команды из всех областей
    console.log("Step 1: Deleting all commands from all scopes...")
    await deleteTelegramCommands()

    // 2. Ждем 2 секунды для обработки
    console.log("Step 2: Waiting for Telegram to process deletion...")
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // 3. Устанавливаем команды заново
    console.log("Step 3: Setting commands for all scopes...")
    const result = await setTelegramCommands()

    // 4. Еще одна пауза
    console.log("Step 4: Final wait for cache refresh...")
    await new Promise((resolve) => setTimeout(resolve, 1000))

    console.log("✅ FORCE REFRESH: Complete!")

    return NextResponse.json({
      success: true,
      message: "Команды принудительно обновлены для всех областей. Попробуйте перезапустить Telegram.",
      result: result,
      steps: [
        "Удалены команды из всех областей",
        "Установлены команды для default scope",
        "Установлены команды для private chats",
        "Рекомендуется перезапустить Telegram",
      ],
    })
  } catch (error) {
    console.error("❌ Error in force refresh:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
