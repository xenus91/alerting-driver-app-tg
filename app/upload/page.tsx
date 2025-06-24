"use client"

import { useState } from "react"
import FileUpload from "@/components/file-upload"
import UploadResults from "@/components/upload-results"

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
  tripId?: number
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
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

  const handleUploadSuccess = (result: UploadResult) => {
    setUploadResult(result)
  }

  const handleSendMessages = async (tripData: any[]): Promise<SendResult> => {
    try {
      const response = await fetch("/api/send-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tripData }),
      })

      const result = await response.json()
      return result
    } catch (error) {
      return {
        success: false,
        error: "Ошибка при отправке сообщений",
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Загрузка файлов</h1>
        <p className="text-muted-foreground">Создание новой кампании рассылки</p>
      </div>

      <FileUpload onUploadSuccess={handleUploadSuccess} />

      {uploadResult && <UploadResults result={uploadResult} onSendMessages={handleSendMessages} />}
    </div>
  )
}
