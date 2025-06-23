"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, AlertTriangle, UserX, MapPin } from "lucide-react"

interface UploadResult {
  total: number
  processed: number
  errors: number
  unverified_users: number
  missing_points: number
  details: Array<{
    phone: string
    status: string
    error?: string
    user_name?: string
    trips_count?: number
    trip_identifier?: string
  }>
}

interface UploadResultsProps {
  results: UploadResult
  tripId: number
}

export default function UploadResults({ results, tripId }: UploadResultsProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Успешно
          </Badge>
        )
      case "error":
        return <Badge variant="destructive">Ошибка</Badge>
      default:
        return <Badge variant="secondary">Неизвестно</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Результаты загрузки (Рейс #{tripId})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{results.total}</div>
              <div className="text-sm text-gray-500">Всего</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{results.processed}</div>
              <div className="text-sm text-gray-500">Обработано</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{results.errors}</div>
              <div className="text-sm text-gray-500">Ошибок</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{results.unverified_users}</div>
              <div className="text-sm text-gray-500">Неверифицированных</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{results.missing_points}</div>
              <div className="text-sm text-gray-500">Отсутствующих пунктов</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Детали обработки</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.details.map((detail, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(detail.status)}
                  <div>
                    <div className="font-medium">
                      {detail.phone} {detail.user_name && `(${detail.user_name})`}
                    </div>
                    {detail.trip_identifier && (
                      <div className="text-sm text-gray-500">Рейс: {detail.trip_identifier}</div>
                    )}
                    {detail.trips_count && <div className="text-sm text-gray-500">Рейсов: {detail.trips_count}</div>}
                    {detail.error && (
                      <div className="text-sm text-red-600 flex items-center space-x-1">
                        {detail.error.includes("не верифицирован") && <UserX className="h-3 w-3" />}
                        {detail.error.includes("Пункты не найдены") && <MapPin className="h-3 w-3" />}
                        <span>{detail.error}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>{getStatusBadge(detail.status)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
