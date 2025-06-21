"use client"

import { useState } from "react"
import CampaignsList from "@/components/campaigns-list"
import CampaignResponses from "@/components/campaign-responses"

export default function CampaignsPage() {
  const [selectedCampaign, setSelectedCampaign] = useState<{ id: number; name: string } | null>(null)

  const handleCampaignSelect = (campaign: { id: number; name: string }) => {
    setSelectedCampaign(campaign)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Кампании рассылки</h1>
        <p className="text-muted-foreground">Управление рассылками и просмотр ответов пользователей</p>
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
