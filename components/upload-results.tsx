"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { CheckCircle, AlertCircle, Send, ChevronDown, ChevronRight, Users, AlertTriangle, MapPin } from "lucide-react"

interface UploadResult {
  success: boolean
  campaign?: any
  totalRows?: number
  validRows?: number
  readyToSend?: number
  notFoundPhones?: string[]
  notFoundPoints?: string[]
  readyTrips?: Array<{
    phone: string
    user_name: string
    trip_identifier: string
    message_id: number
  }>
  errors?: string[]
  error?: string
}

interface SendResult {
  success: boolean
  results?: {
    total: number
    sent: number
    errors: number
    details: Array<{
      phone: string
      status: string
      error?: string
    }>
  }
  error?: string
}

interface UploadResultsProps {
  result: UploadResult
  onSendMessages: (campaignId: number) => Promise<SendResult>
}

export default function UploadResults({ result, onSendMessages }: UploadResultsProps) {
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [showNotFoundPhones, setShowNotFoundPhones] = useState(false)
  const [showNotFoundPoints, setShowNotFoundPoints] = useState(false)
  const [showReadyTrips, setShowReadyTrips] = useState(false)
  const [showSendDetails, setShowSendDetails] = useState(false)
  const [showUnverifiedPhones, setShowUnverifiedPhones] = useState(false) // <-- НОВОЕ СОСТОЯНИЕ

  const handleSendMessages = async () => {
    if (!result.campaign) return

    setIsSending(true)
    try {
      const sendRes = await onSendMessages(result.campaign.id)
      setSendResult(sendRes)
    } catch (error) {
      setSendResult({
        success: false,
        error: "Ошибка при отправке сообщений",
      })
    } finally {
      setIsSending(false)
    }
  }

  if (!result.success) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {result.error}
          {result.errors && result.errors.length > 0 && (
            <div className="mt-2">
              <p className="font-medium">Детали ошибок:</p>
              <ul className="list-disc list-inside">
                {result.errors.map((error, index) => (
                  <li key={index} className="text-sm">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Файл успешно обработан
          </CardTitle>
          <CardDescription>Кампания: {result.campaign?.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{result.totalRows}</div>
              <div className="text-sm text-muted-foreground">Всего строк</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{result.validRows}</div>
              <div className="text-sm text-muted-foreground">Валидных</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{result.readyToSend}</div>
              <div className="text-sm text-muted-foreground">Готово к отправке</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {(result.notFoundPhones?.length || 0) + (result.notFoundPoints?.length || 0)}
              </div>
              <div className="text-sm text-muted-foreground">Проблем</div>
            </div>
          </div>

          {/* Готовые к отправке рейсы */}
          {result.readyTrips && result.readyTrips.length > 0 && (
            <Collapsible open={showReadyTrips} onOpenChange={setShowReadyTrips}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="mb-2">
                  {showReadyTrips ? (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-2" />
                  )}
                  Готовые рейсы ({result.readyTrips.length})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Alert className="mb-4">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="mb-2">Рейсы готовые к отправке:</p>
                    <div className="space-y-2">
                      {result.readyTrips.map((trip, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <span className="font-medium">{trip.user_name}</span>
                            <span className="text-sm text-muted-foreground ml-2">({trip.phone})</span>
                          </div>
                          <Badge variant="secondary">Рейс {trip.trip_identifier}</Badge>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Не найденные номера телефонов */}
          {result.notFoundPhones && result.notFoundPhones.length > 0 && (
            <Collapsible open={showNotFoundPhones} onOpenChange={setShowNotFoundPhones}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="mb-2">
                  {showNotFoundPhones ? (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-2" />
                  )}
                  Номера не найдены в БД ({result.notFoundPhones.length})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Alert variant="destructive" className="mb-4">
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    <p className="mb-2">Эти номера не зарегистрированы в боте:</p>
                    <div className="flex flex-wrap gap-1">
                      {result.notFoundPhones.map((phone, index) => (
                        <Badge key={index} variant="destructive">
                          {phone}
                        </Badge>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              </CollapsibleContent>
            </Collapsible>
          )}
          {/* НОВАЯ СЕКЦИЯ: Неверифицированные пользователи */}
          {result.unverifiedPhones && result.unverifiedPhones.length > 0 && (
            <Collapsible open={showUnverifiedPhones} onOpenChange={setShowUnverifiedPhones}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="mb-2">
                  {showUnverifiedPhones ? (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-2" />
                  )}
                  Неверифицированные пользователи ({result.unverifiedPhones.length})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="mb-2">
                      Эти пользователи не имеют доступа к приложению, уведомления отправлены не будут:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {result.unverifiedPhones.map((phone, index) => (
                        <Badge key={index} variant="destructive">
                          {phone}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-2 text-sm">
                      Просьба обратиться к Администратору
                    </p>
                  </AlertDescription>
                </Alert>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Не найденные пункты */}
          {result.notFoundPoints && result.notFoundPoints.length > 0 && (
            <Collapsible open={showNotFoundPoints} onOpenChange={setShowNotFoundPoints}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="mb-2">
                  {showNotFoundPoints ? (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-2" />
                  )}
                  Пункты не найдены в БД ({result.notFoundPoints.length})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Alert variant="destructive" className="mb-4">
                  <MapPin className="h-4 w-4" />
                  <AlertDescription>
                    <p className="mb-2">Эти пункты отсутствуют в базе данных:</p>
                    <div className="flex flex-wrap gap-1">
                      {result.notFoundPoints.map((pointId, index) => (
                        <Badge key={index} variant="destructive">
                          {pointId}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-2 text-sm">Добавьте эти пункты в базу данных или исправьте файл.</p>
                  </AlertDescription>
                </Alert>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Ошибки валидации */}
          {result.errors && result.errors.length > 0 && (
            <Collapsible open={showErrors} onOpenChange={setShowErrors}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="mb-2">
                  {showErrors ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                  Ошибки обработки ({result.errors.length})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {result.errors.map((error, index) => (
                        <li key={index} className="text-sm">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Кнопка отправки */}
          {result.readyToSend! > 0 && !sendResult && (
            <Button onClick={handleSendMessages} disabled={isSending} className="w-full" size="lg">
              {isSending ? (
                <>
                  <Send className="mr-2 h-4 w-4 animate-pulse" />
                  Отправка сообщений...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Отправить сообщения ({result.readyToSend})
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Результат отправки */}
      {sendResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {sendResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              Результат отправки
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sendResult.success && sendResult.results ? (
              <div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{sendResult.results.total}</div>
                    <div className="text-sm text-muted-foreground">Всего</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{sendResult.results.sent}</div>
                    <div className="text-sm text-muted-foreground">Отправлено</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{sendResult.results.errors}</div>
                    <div className="text-sm text-muted-foreground">Ошибок</div>
                  </div>
                </div>

                <Collapsible open={showSendDetails} onOpenChange={setShowSendDetails}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">
                      {showSendDetails ? (
                        <ChevronDown className="h-4 w-4 mr-2" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mr-2" />
                      )}
                      Показать детали отправки
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                      {sendResult.results.details.map((detail, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <span className="font-mono text-sm">{detail.phone}</span>
                          <div className="flex items-center gap-2">
                            {detail.status === "sent" ? (
                              <Badge variant="default">Отправлено</Badge>
                            ) : (
                              <Badge variant="destructive">Ошибка</Badge>
                            )}
                            {detail.error && <span className="text-xs text-red-600">{detail.error}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{sendResult.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
