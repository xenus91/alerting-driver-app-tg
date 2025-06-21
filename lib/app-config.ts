export function getAppUrl(): string {
  // Для Vercel - используем VERCEL_URL в первую очередь
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}` // <--- Вот это, скорее всего, ваш домен
  }

  // Для кастомного домена или других платформ
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes("lite.vusercontent.net")) {
    return process.env.NEXTAUTH_URL
  }

  // Для локальной разработки
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000"
  }

  // Fallback - пытаемся определить из заголовков запроса
  return "https://your-app.vercel.app"
}

export function getWebhookUrl(): string {
  return `${getAppUrl()}/api/webhook`
}

// Новая функция для проверки доступности URL
export async function checkUrlAccessibility(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "TelegramBot (like TwitterBot)",
      },
    })
    return response.ok
  } catch (error) {
    return false
  }
}
