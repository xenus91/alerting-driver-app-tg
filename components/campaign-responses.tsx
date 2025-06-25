"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { RefreshCw, CheckCircle, XCircle, Clock, ChevronDown, ChevronRight, MessageSquare } from "lucide-react"

interface CampaignMessage {
  id: number
  phone: string
  message: string
  status: string
  response_status: string
  response_comment?: string
  response_at?: string
  sent_at?: string
}

interface ResponseStats {
  total: number
  sent: number
  confirmed: number
  rejected: number
  pending: number
}

interface CampaignResponsesProps {
  campaignId: number
  campaignName: string
}

export default function CampaignResponses({ campaignId, campaignName }: CampaignResponsesProps) {
  const [responses, setResponses] = useState<{
    confirmed: CampaignMessage[]
    rejected: CampaignMessage[]
    pending: CampaignMessage[]
  } | null>(null)
  const [stats, setStats] = useState<ResponseStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmed, setShowConfirmed] = useState(false)
  const [showRejected, setShowRejected] = useState(false)
  const [showPending, setShowPending] = useState(false)

  const fetchResponses = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/campaign-responses?campaignId=${campaignId}`)
      const data = await response.json()

      if (data.success) {
        setResponses(data.responses)
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Error fetching responses:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchResponses()
  }, [campaignId])

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—"
    return new Date(dateString).toLocaleString("ru-RU")
  }

  if (!responses || !stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className={`h-6 w-6 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Загрузка ответов..." : "Нет данных"}
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
              Ответы пользов��телей
            </CardTitle>
            <CardDescription>Кампания: {campaignName}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchResponses} disabled={isLoading}>
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Статистика */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Всего</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.sent}</div>
            <div className="text-xs text-muted-foreground">Отправлено</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
            <div className="text-xs text-muted-foreground">Подтверждено</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <div className="text-xs text-muted-foreground">Отклонено</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Ожидает</div>
          </div>
        </div>

        {/* Прогресс бар */}
        {stats.sent > 0 && (
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="flex h-2 rounded-full overflow-hidden">
                <div
                  className="bg-green-600 transition-all duration-300"
                  style={{
                    width: `${(stats.confirmed / stats.sent) * 100}%`,
                  }}
                />
                <div
                  className="bg-red-600 transition-all duration-300"
                  style={{
                    width: `${(stats.rejected / stats.sent) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {stats.confirmed + stats.rejected} из {stats.sent} ответили (
                {Math.round(((stats.confirmed + stats.rejected) / stats.sent) * 100)}%)
              </span>
            </div>
          </div>
        )}

        {/* Подтвержденные */}
        {responses.confirmed.length > 0 && (
          <Collapsible open={showConfirmed} onOpenChange={setShowConfirmed}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  {showConfirmed ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Подтвержденные ({responses.confirmed.length})
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 mt-2">
                {responses.confirmed.map((msg) => (
                  <div key={msg.id} className="p-3 border rounded-lg bg-green-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm">{msg.phone}</span>
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Подтверждено
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">{msg.message}</div>
                    <div className="text-xs text-muted-foreground">Ответ получен: {formatDate(msg.response_at)}</div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Отклоненные */}
        {responses.rejected.length > 0 && (
          <Collapsible open={showRejected} onOpenChange={setShowRejected}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  {showRejected ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <XCircle className="h-4 w-4 text-red-600" />
                  Отклоненные ({responses.rejected.length})
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 mt-2">
                {responses.rejected.map((msg) => (
                  <div key={msg.id} className="p-3 border rounded-lg bg-red-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm">{msg.phone}</span>
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Отклонено
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">{msg.message}</div>
                    {msg.response_comment && (
                      <div className="text-sm bg-white p-2 rounded border-l-4 border-red-500 mb-2">
                        <strong>Комментарий:</strong> {msg.response_comment}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">Ответ получен: {formatDate(msg.response_at)}</div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Ожидающие */}
        {responses.pending.length > 0 && (
          <Collapsible open={showPending} onOpenChange={setShowPending}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  {showPending ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Clock className="h-4 w-4 text-orange-600" />
                  Ожидают ответа ({responses.pending.length})
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 mt-2">
                {responses.pending.map((msg) => (
                  <div key={msg.id} className="p-3 border rounded-lg bg-orange-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm">{msg.phone}</span>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                        <Clock className="h-3 w-3 mr-1" />
                        Ожидает
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">{msg.message}</div>
                    <div className="text-xs text-muted-foreground">Отправлено: {formatDate(msg.sent_at)}</div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )
}
