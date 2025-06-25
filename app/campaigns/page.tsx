"use client"

import { useState } from "react"
import CampaignsList from "@/components/campaigns-list"
import CampaignResponses from "@/components/campaign-responses"

export default function CampaignsPage() {
  // В начале компонента добавить состояние для текущего пользователя
  const [currentUser, setCurrentUser] = useState<{ role: string; carpark: string } | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<{ id: number; name: string } | null>(null)

  const handleCampaignSelect = (campaign: { id: number; name: string }) => {
    setSelectedCampaign(campaign)
  }

  return (
    <div className="space-y-6">
      {/* В заголовке обновить описание */}
      <div>
        <h1 className="text-2xl font-bold">Кампании рассылки</h1>
        <p className="text-muted-foreground">
          {currentUser?.role === "operator"
            ? `Рассылки для автопарка ${currentUser.carpark}`
            : "Управление рассылками и просмотр ответов пользователей"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CampaignsList onCampaignSelect={handleCampaignSelect} />

        {selectedCampaign && (
          <CampaignResponses campaignId={selectedCampaign.id} campaignName={selectedCampaign.name} />
        )}
      </div>
    </div>
  )
}
