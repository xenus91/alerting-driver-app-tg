"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import UploadResults from "./upload-results"

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      setError("Пожалуйста, выберите файл")
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Ошибка при загрузке файла")
      }

      setResult(data)
      setFile(null)

      // Сбрасываем input файла
      const fileInput = document.getElementById("file-input") as HTMLInputElement
      if (fileInput) {
        fileInput.value = ""
      }
    } catch (error) {
      console.error("Upload error:", error)
      setError(error instanceof Error ? error.message : "Произошла ошибка при загрузке")
    } finally {
      setIsUploading(false)
    }
  }

  const handleSendMessages = async (campaignId: number) => {
    try {
      const response = await fetch("/api/send-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ campaignId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Ошибка при отправке сообщений")
      }

      return data
    } catch (error) {
      console.error("Send messages error:", error)
      throw error
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Загрузка файла рассылки
          </CardTitle>
          <CardDescription>
            Загрузите Excel файл с данными рейсов. Сообщения будут сгенерированы автоматически.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-input">Excel файл</Label>
              <Input
                id="file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              <p className="text-sm text-gray-500">Поддерживаются файлы .xlsx и .xls</p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isUploading || !file}>
              {isUploading ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Загрузить и обработать рейсы
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && <UploadResults result={result} onSendMessages={handleSendMessages} />}
    </div>
  )
}
