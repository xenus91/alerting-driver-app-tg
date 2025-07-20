"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, XCircle, AlertTriangle, Send, RefreshCw, Users, UserX, MapPin } from "lucide-react"

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
  notFoundPointsList?: string[] // Добавляем список не найденных пунктов
  readyTrips?: Array<{
    phone: string
    trip_identifier: string
    vehicle_number: string
  }>
  tripData?: any[]
  errors?: string[]
  error?: string
  details?: string
  // Добавляем поля для ошибки trip_already_assigned
  trip_identifiers?: string[]
  conflict_data?: Array<{
    trip_identifier: string
    driver_phone: string
    driver_name: string
    trip_id: number
  }>
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
  // Добавляем поля для ошибки trip_already_assigned, так как они приходят в ответе API
  trip_identifiers?: string[]
  conflict_data?: Array<{
    trip_identifier: string
    driver_phone: string
    driver_name: string
    trip_id: number
  }>
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
        error: "Нет данных для отправки",
      })
      return
    }

    console.log("Sending trip data:", result.tripData)

    setIsSending(true)
    try {
      // Отправляем POST запрос с правильной структурой данных
      const response = await fetch("/api/send-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tripData: result.tripData, // Используем tripData, а не campaignId
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("API Error Response:", errorData) // Логируем полный ответ API при ошибке
        throw new Error(errorData.error || "Ошибка сервера")
      }

      const responseData = await response.json()
      console.log("API Success Response Data:", responseData) // Логируем полный ответ API при успехе
      setSendResult(responseData)
    } catch (error) {
      console.error("Error sending messages:", error)
      setSendResult({
        success: false,
        error: error instanceof Error ? error.message : "Ошибка при отправке сообщений",
        // Если ошибка пришла из API, пытаемся сохранить trip_identifiers и conflict_data
        trip_identifiers: (error as any).trip_identifiers,
        conflict_data: (error as any).conflict_data,
      })
    } finally {
      setIsSending(false)
    }
  }

  const formatPhone = (phone: string) => {
    if (phone.startsWith("7") && phone.length === 11) {
      return `+7 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9, 11)}`
    }
    if (phone.startsWith("380") && phone.length === 12) {
      return `+380 (${phone.slice(3, 5)}) ${phone.slice(5, 8)}-${phone.slice(8, 10)}-${phone.slice(10, 12)}`
    }
    return phone
  }

  // Используем sendResult для отображения ошибок после попытки отправки
  const currentErrorState = sendResult || result
  const isTripAlreadyAssignedError = currentErrorState.error?.trim() === "trip_already_assigned"

  if (!currentErrorState.success && currentErrorState.error) {
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
              {isTripAlreadyAssignedError ? (
                <>
                  <strong>Ошибка: Рейс уже назначен!</strong>
                  <p className="mt-2">
                    Рейс(ы) со следующими идентификаторами уже существуют в системе и назначены водителям:
                  </p>
                  {currentErrorState.trip_identifiers && currentErrorState.trip_identifiers.length > 0 && (
                    <ul className="list-disc list-inside mt-2">
                      {currentErrorState.trip_identifiers.map((id, index) => (
                        <li key={index}>
                          <strong>{id}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                  {currentErrorState.conflict_data && currentErrorState.conflict_data.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium mb-2">Детали конфликта:</h5>
                      <div className="space-y-2">
                        {currentErrorState.conflict_data.map((conflict, index) => (
                          <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                            <p>
                              <strong>Идентификатор рейса:</strong> {conflict.trip_identifier}
                            </p>
                            <p>
                              <strong>Водитель:</strong> {conflict.driver_name} ({formatPhone(conflict.driver_phone)})
                            </p>
                            {/* Добавляем trip_id, если он есть и нужен для отображения */}
                            {conflict.trip_id && (
                              <p>
                                <strong>ID рейса в системе:</strong> {conflict.trip_id}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {currentErrorState.error || "Неизвестная ошибка"}
                  {currentErrorState.details && (
                    <div className="mt-2">
                      <strong>Детали:</strong> {currentErrorState.details}
                    </div>
                  )}
                </>
              )}
            </AlertDescription>
          </Alert>
          {currentErrorState.errors && currentErrorState.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Ошибки валидации:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {currentErrorState.errors.map((error, index) => (
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
                    {result.notFoundPointsList && result.notFoundPointsList.length > 0 && (
                      <div className="mt-2">
                        <details className="cursor-pointer">
                          <summary className="text-sm font-medium">Показать ID пунктов</summary>
                          <div className="mt-2 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                            {result.notFoundPointsList.map((pointId, index) => (
                              <div
                                key={index}
                                className="text-sm font-mono bg-red-50 p-2 rounded border border-red-200 text-center"
                              >
                                <strong>{pointId}</strong>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
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
                <AlertDescription>
                  {sendResult.error || "Неизвестная ошибка при отправке"}
                  {sendResult.details && (
                    <div className="mt-2">
                      <strong>Детали:</strong> {sendResult.details}
                    </div>
                  )}
                  {/* Добавляем отображение conflict_data и trip_identifiers для sendResult */}
                  {sendResult.error?.trim() === "trip_already_assigned" && (
                    <>
                      <p className="mt-2">
                        Рейс(ы) со следующими идентификаторами уже существуют в системе и назначены водителям:
                      </p>
                      {sendResult.trip_identifiers && sendResult.trip_identifiers.length > 0 && (
                        <ul className="list-disc list-inside mt-2">
                          {sendResult.trip_identifiers.map((id, index) => (
                            <li key={index}>
                              <strong>{id}</strong>
                            </li>
                          ))}
                        </ul>
                      )}
                      {sendResult.conflict_data && sendResult.conflict_data.length > 0 && (
                        <div className="mt-4">
                          <h5 className="font-medium mb-2">Детали конфликта:</h5>
                          <div className="space-y-2">
                            {sendResult.conflict_data.map((conflict, index) => (
                              <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                                <p>
                                  <strong>Идентификатор рейса:</strong> {conflict.trip_identifier}
                                </p>
                                <p>
                                  <strong>Водитель:</strong> {conflict.driver_name} (
                                  {formatPhone(conflict.driver_phone)})
                                </p>
                                {conflict.trip_id && (
                                  <p>
                                    <strong>ID рейса в системе:</strong> {conflict.trip_id}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
