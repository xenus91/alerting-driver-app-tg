"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, Calendar, MessageSquare, Eye } from "lucide-react"

interface Campaign {
  id: number
  name: string
  created_at: string
  status: string
  total_messages: number
  sent_messages: number
  error_messages: number
  confirmed_responses: number
  rejected_responses: number
  pending_responses: number
}

interface CampaignsListProps {
  onCampaignSelect: (campaign: { id: number; name: string }) => void
}

export default function CampaignsList({ onCampaignSelect }: CampaignsListProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchCampaigns = async () => {
    try {
      const response = await fetch("/api/campaigns")
      const data = await response.json()
      setCampaigns(data.campaigns || [])
    } catch (error) {
      console.error("Error fetching campaigns:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ru-RU")
  }

  const getStatusBadge = (campaign: Campaign) => {
    if (campaign.error_messages > 0 && campaign.sent_messages === 0) {
      return <Badge variant="destructive">Ошибка</Badge>
    } else if (campaign.sent_messages === campaign.total_messages) {
      return <Badge variant="default">Завершено</Badge>
    } else if (campaign.sent_messages > 0) {
      return <Badge variant="secondary">Частично отправлено</Badge>
    } else {
      return <Badge variant="outline">Ожидает</Badge>
    }
  }

  const getResponseRate = (campaign: Campaign) => {
    if (campaign.sent_messages === 0) return 0
    return Math.round(((campaign.confirmed_responses + campaign.rejected_responses) / campaign.sent_messages) * 100)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Загрузка кампаний...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Кампании рассылки
            </CardTitle>
            <CardDescription>Выберите кампанию для просмотра ответов</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCampaigns}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Кампании не найдены</p>
            <p className="text-sm">Загрузите файл для создания первой кампании</p>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{campaign.name}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(campaign.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(campaign)}
                    {campaign.sent_messages > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCampaignSelect({ id: campaign.id, name: campaign.name })}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Ответы
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-3">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{campaign.total_messages}</div>
                    <div className="text-xs text-muted-foreground">Всего</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">{campaign.sent_messages}</div>
                    <div className="text-xs text-muted-foreground">Отправлено</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{campaign.confirmed_responses}</div>
                    <div className="text-xs text-muted-foreground">Подтверждено</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-600">{campaign.rejected_responses}</div>
                    <div className="text-xs text-muted-foreground">Отклонено</div>
                  </div>
                </div>

                {/* Прогресс отправки */}
                {campaign.total_messages > 0 && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(campaign.sent_messages / campaign.total_messages) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round((campaign.sent_messages / campaign.total_messages) * 100)}% отправлено
                    </p>
                  </div>
                )}

                {/* Прогресс ответов */}
                {campaign.sent_messages > 0 && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="flex h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-green-600 transition-all duration-300"
                          style={{
                            width: `${(campaign.confirmed_responses / campaign.sent_messages) * 100}%`,
                          }}
                        />
                        <div
                          className="bg-red-600 transition-all duration-300"
                          style={{
                            width: `${(campaign.rejected_responses / campaign.sent_messages) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getResponseRate(campaign)}% ответили (
                      {campaign.confirmed_responses + campaign.rejected_responses} из {campaign.sent_messages})
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
