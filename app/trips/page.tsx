"use client"

import { Button } from "@/components/ui/button"
import { Upload, Zap } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { QuickTripForm } from "@/components/quick-trip-form"

export default function TripsPage() {
  const [isQuickTripOpen, setIsQuickTripOpen] = useState(false)

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Рассылки</h1>

      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-4">
          <Button onClick={() => setIsQuickTripOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            <Zap className="h-4 w-4 mr-2" />
            Быстрая рассылка
          </Button>
          <Button asChild>
            <Link href="/upload">
              <Upload className="h-4 w-4 mr-2" />
              Загрузить файл
            </Link>
          </Button>
        </div>
      </div>

      <QuickTripForm
        isOpen={isQuickTripOpen}
        onClose={() => setIsQuickTripOpen(false)}
        onTripSent={() => {
          setIsQuickTripOpen(false)
          // Обновляем список рассылок
          window.location.reload()
        }}
      />
    </div>
  )
}
