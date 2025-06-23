"use client"

import { useState } from "react"
import FileUpload from "@/components/file-upload"
import UploadResults from "@/components/upload-results"

interface UploadResult {
  success: boolean
  campaign?: any
  totalRows?: number
  validRows?: number
  readyToSend?: number
  notFoundPhones?: string[]
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

export default function UploadPage() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

  const handleUploadSuccess = (result: UploadResult) => {
    setUploadResult(result)
  }

  const handleSendMessages = async (campaignId: number): Promise<SendResult> => {
    try {
      const response = await fetch("/api/send-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ campaignId }),
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
