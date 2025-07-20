"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Plus } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { TripCorrectionModal } from "@/components/trip-correction-modal"
import { TripTable } from "@/components/trip-table"
import type { Trip } from "@/lib/database"

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false)
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")

  const fetchTrips = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/trips")
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      // Исправлено: Убедитесь, что data.trips является массивом
      if (data && Array.isArray(data.trips)) {
        setTrips(data.trips)
      } else {
        // Если API возвращает просто массив, то используем его напрямую
        setTrips(Array.isArray(data) ? data : [])
        console.warn("API /api/trips did not return data.trips, assuming direct array response.")
      }
    } catch (e: any) {
      setError(e.message)
      toast({
        title: "Ошибка загрузки рейсов",
        description: e.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTrips()
  }, [])

  const handleEditTrip = (trip: Trip) => {
    setSelectedTrip(trip)
    setModalMode("edit")
    setIsCorrectionModalOpen(true)
  }

  const handleDeleteTrip = async (tripId: string) => {
    if (!window.confirm("Вы уверены, что хотите удалить этот рейс?")) {
      return
    }
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      toast({
        title: "Рейс удален",
        description: `Рейс с ID ${tripId} успешно удален.`,
      })
      fetchTrips() // Refresh the list
    } catch (e: any) {
      toast({
        title: "Ошибка удаления рейса",
        description: e.message,
        variant: "destructive",
      })
    }
  }

  const handleCorrectionSent = () => {
    setIsCorrectionModalOpen(false)
    setSelectedTrip(null)
    fetchTrips() // Refresh the list after correction/creation
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Загрузка рейсов...
      </div>
    )
  if (error) return <div className="text-red-500 p-8">Ошибка: {error}</div>

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Управление рассылками</h1>
          <Button
            onClick={() => {
              setSelectedTrip(null)
              setModalMode("create")
              setIsCorrectionModalOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Быстрая рассылка
          </Button>
        </div>
        <TripTable trips={trips} onEdit={handleEditTrip} onDelete={handleDeleteTrip} />

        <TripCorrectionModal
          isOpen={isCorrectionModalOpen}
          onClose={() => {
            setIsCorrectionModalOpen(false)
            setSelectedTrip(null)
          }}
          mode={modalMode}
          initialTrip={selectedTrip}
          onCorrectionSent={handleCorrectionSent}
        />
      </main>
    </div>
  )
}
