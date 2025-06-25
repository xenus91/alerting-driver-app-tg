"use client"

import BotDiagnostics from "@/components/bot-diagnostics"
import AdvancedBotDiagnostics from "@/components/advanced-bot-diagnostics"
import WebhookDiagnostics from "@/components/webhook-diagnostics"
import BotSetup from "@/components/bot-setup"

export default function BotSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Настройки Telegram бота</h1>
        <p className="text-muted-foreground">Диагностика и конфигурация бота</p>
      </div>

      {/* Настройка бота */}
      <BotSetup />

      {/* Добавить диагностику webhook */}
      <WebhookDiagnostics />

      <div className="grid gap-6 lg:grid-cols-2">
        <BotDiagnostics />
        <AdvancedBotDiagnostics />
      </div>
    </div>
  )
}
