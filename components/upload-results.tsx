"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, XCircle, AlertTriangle, Send, RefreshCw, Users, UserX, MapPin } from 'lucide-react'

interface UploadResult {
  success: boolean
  totalRows?: number
  validRows?: number
  readyToSend?: number
  notFoundPhones?: number
  notVerifiedPhones?: number
  notFoundPoints?: number
  notFoundPhonesList?: string[]
  notVerifiedPhonesList?: string[]
  readyTrips?: Array<{
    phone: string
    trip_identifier: string
    vehicle_number: string
  }>
  tripData?: any[]
  errors?: string[]
  error?: string
  details?: string
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
  onSendMessages: (tripData: any[]) => Promise<SendResult>
}

export default function UploadResults({ result, onSendMessages }: UploadResultsProps) {
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)

  const handleSendMessages = async () => {
    if (!result.tripData || result.tripData.length === 0) {
      console.error("No trip data available for sending")
      setSendResult({
        success: false,
        error: "Нет данных для отправки"
      })
      return
    }

    console.log("Sending trip data:", result.tripData)
    
    setIsSending(true)
    try {
      const response = await onSendMessages(result.tripData)
      setSendResult(response)
    } catch (error) {
      setSendResult({
        success: false,
        error: "Ошибка при отправке сообщений",
      })
    } finally {
      setIsSending(false)
    }
  }

  const formatPhone = (phone: string) => {
    if (phone.startsWith("7") && phone.length === 11) {
      return `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9, 11)}`
    }
    return phone
  }

  if (!result.success) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Ошибка обработки файла
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {result.error || "Неизвестная ошибка"}
              {result.details && (
                <div className="mt-2">
                  <strong>Детали:</strong> {result.details}
                </div>
              )}
            </AlertDescription>
          </Alert>
          {result.errors && result.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Ошибки валидации:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {result.errors.map((error, index) => (
                  <li key={index} className="text-red-600">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Статистика обработки */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            Файл успешно обработан
          </CardTitle>
          <CardDescription>Результаты анализа данных из файла</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{result.totalRows || 0}</div>
              <div className="text-sm text-muted-foreground">Всего строк</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{result.validRows || 0}</div>
              <div className="text-sm text-muted-foreground">Валидных</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{result.readyToSend || 0}</div>
              <div className="text-sm text-muted-foreground">Готово к отправке</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {(result.notFoundPhones || 0) + (result.notVerifiedPhones || 0) + (result.notFoundPoints || 0)}
              </div>
              <div className="text-sm text-muted-foreground">Проблем</div>
            </div>
          </div>

          {/* Детали проблем */}
          {((result.notFoundPhones || 0) > 0 ||
            (result.notVerifiedPhones || 0) > 0 ||
            (result.notFoundPoints || 0) > 0) && (
            <div className="space-y-4">
              <Separator />
              <h4 className="font-medium text-orange-600">Обнаружены проблемы:</h4>

              {(result.notFoundPhones || 0) > 0 && (
                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span>
                        <strong>{result.notFoundPhones} пользователей не найдено</strong> - эти номера не
                        зарегистрированы в системе
                      </span>
                      <Badge variant="secondary">{result.notFoundPhones}</Badge>
                    </div>
                    {result.notFoundPhonesList && result.notFoundPhonesList.length > 0 && (
                      <div className="mt-2">
                        <details className="cursor-pointer">
                          <summary className="text-sm font-medium">Показать номера</summary>
                          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                            {result.notFoundPhonesList.map((phone, index) => (
                              <div key={index} className="text-sm font-mono bg-gray-100 p-1 rounded">
                                {formatPhone(phone)}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {(result.notVerifiedPhones || 0) > 0 && (
                <Alert>
                  <UserX className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span>
                        <strong>{result.notVerifiedPhones} пользователей не верифицировано</strong> - эти пользователи
                        не подтвердили свой номер
                      </span>
                      <Badge variant="destructive">{result.notVerifiedPhones}</Badge>
                    </div>
                    {result.notVerifiedPhonesList && result.notVerifiedPhonesList.length > 0 && (
                      <div className="mt-2">
                        <details className="cursor-pointer">
                          <summary className="text-sm font-medium">Показать номера</summary>
                          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                            {result.notVerifiedPhonesList.map((phone, index) => (
                              <div
                                key={index}
                                className="text-sm font-mono bg-red-50 p-1 rounded border border-red-200"
                              >
                                {formatPhone(phone)}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {(result.notFoundPoints || 0) > 0 && (
                <Alert>
                  <MapPin className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span>
                        <strong>{result.notFoundPoints} пунктов не найдено</strong> - эти пункты отсутствуют в базе
                        данных
                      </span>
                      <Badge variant="destructive">{result.notFoundPoints}</Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Готовые к отправке рейсы */}
          {result.readyTrips && result.readyTrips.length > 0 && (
            <div className="mt-6">
              <Separator />
              <h4 className="font-medium text-green-600 mt-4 mb-3">
                Готово к отправке ({result.readyTrips.length} рейсов):
              </h4>
              <div className="grid gap-2 max-h-40 overflow-y-auto">
                {result.readyTrips.map((trip, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        {trip.trip_identifier}
                      </Badge>
                      <span className="text-sm font-medium">{trip.vehicle_number}</span>
                    </div>
                    <span className="text-sm font-mono text-green-700">{formatPhone(trip.phone)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Кнопка отправки */}
      {(result.readyToSend || 0) > 0 && !sendResult && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Готово к отправке</h3>
                <p className="text-sm text-muted-foreground">{result.readyToSend} рейсов будут отправлены водителям</p>
              </div>
              <Button onClick={handleSendMessages} disabled={isSending} size="lg">
                {isSending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Отправить сообщения
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Результат отправки */}
      {sendResult && (
        <Card className={sendResult.success ? "border-green-200" : "border-red-200"}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${sendResult.success ? "text-green-600" : "text-red-600"}`}>
              {sendResult.success ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              {sendResult.success ? "Сообщения отправлены" : "Ошибка отправки"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sendResult.success && sendResult.results ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
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
                {sendResult.results.errors > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Некоторые сообщения не удалось отправить. Проверьте детали ниже.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{sendResult.error || "Неизвестная ошибка при отправке"}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
