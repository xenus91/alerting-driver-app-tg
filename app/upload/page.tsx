"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileSpreadsheet, Send } from "lucide-react"
import UploadResults from "@/components/upload-results"

interface UploadResult {
  success: boolean
  tripId?: number
  results?: {
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
  error?: string
  message?: string
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

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setUploadResult(null)
      setSendResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()
      setUploadResult(result)
    } catch (error) {
      console.error("Upload error:", error)
      setUploadResult({
        success: false,
        error: "Ошибка при загрузке файла",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleSendMessages = async () => {
    if (!uploadResult?.tripId) return

    setIsSending(true)
    try {
      const response = await fetch("/api/send-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId: uploadResult.tripId,
        }),
      })

      const result = await response.json()
      setSendResult(result)
    } catch (error) {
      console.error("Send messages error:", error)
      setSendResult({
        success: false,
        error: "Ошибка при отправке сообщений",
      })
    } finally {
      setIsSending(false)
    }
  }

  const canSendMessages = uploadResult?.success && uploadResult?.results && uploadResult.results.processed > 0

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <FileSpreadsheet className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Загрузка рейсов</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Выберите Excel файл</CardTitle>
          <CardDescription>
            Загрузите файл с данными о рейсах. Файл должен содержать колонки: phone, trip_identifier, vehicle_number,
            planned_loading_time, point_type, point_num, point_id, driver_comment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="file">Excel файл</Label>
            <Input id="file" type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
          </div>

          {file && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <FileSpreadsheet className="h-4 w-4" />
              <span>{file.name}</span>
              <span>({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}

          <Button onClick={handleUpload} disabled={!file || isUploading} className="w-full">
            {isUploading ? (
              <>
                <Upload className="mr-2 h-4 w-4 animate-spin" />
                Загрузка...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Загрузить файл
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {uploadResult && !uploadResult.success && (
        <Alert variant="destructive">
          <AlertDescription>{uploadResult.error}</AlertDescription>
        </Alert>
      )}

      {uploadResult?.success && uploadResult.results && (
        <UploadResults results={uploadResult.results} tripId={uploadResult.tripId!} />
      )}

      {canSendMessages && !sendResult && (
        <Card>
          <CardHeader>
            <CardTitle>Отправка сообщений</CardTitle>
            <CardDescription>
              Готово к отправке: {uploadResult.results!.processed} сообщений
              {uploadResult.results!.unverified_users > 0 && (
                <span className="text-orange-600">
                  {" "}
                  (Пропущено неверифицированных: {uploadResult.results!.unverified_users})
                </span>
              )}
              {uploadResult.results!.missing_points > 0 && (
                <span className="text-red-600">
                  {" "}
                  (Пропущено из-за отсутствующих пунктов: {uploadResult.results!.missing_points})
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSendMessages} disabled={isSending} className="w-full" size="lg">
              {isSending ? (
                <>
                  <Send className="mr-2 h-4 w-4 animate-pulse" />
                  Отправка сообщений...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Отправить сообщения ({uploadResult.results!.processed})
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {sendResult && (
        <Card>
          <CardHeader>
            <CardTitle>Результат отправки</CardTitle>
          </CardHeader>
          <CardContent>
            {sendResult.success && sendResult.results ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{sendResult.results.total}</div>
                    <div className="text-sm text-gray-500">Всего</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{sendResult.results.sent}</div>
                    <div className="text-sm text-gray-500">Отправлено</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{sendResult.results.errors}</div>
                    <div className="text-sm text-gray-500">Ошибок</div>
                  </div>
                </div>

                {sendResult.results.details.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    <h4 className="font-medium">Детали отправки:</h4>
                    {sendResult.results.details.map((detail, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <span className="font-mono text-sm">{detail.phone}</span>
                        <div className="flex items-center space-x-2">
                          {detail.status === "sent" ? (
                            <span className="text-green-600 text-sm">✓ Отправлено</span>
                          ) : (
                            <span className="text-red-600 text-sm">✗ Ошибка</span>
                          )}
                          {detail.error && <span className="text-xs text-red-600">{detail.error}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>{sendResult.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
