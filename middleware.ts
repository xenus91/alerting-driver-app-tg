import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Разрешаем все запросы к webhook от Telegram
  if (request.nextUrl.pathname === "/api/webhook") {
    // Добавляем заголовки для разрешения внешних запросов
    const response = NextResponse.next()
    response.headers.set("Access-Control-Allow-Origin", "*")
    response.headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/webhook/:path*"],
}
