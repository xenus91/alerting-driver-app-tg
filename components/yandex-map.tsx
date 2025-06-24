"use client"

import { useEffect, useRef } from "react"

interface YandexMapProps {
  latitude?: string
  longitude?: string
  onCoordinatesChange?: (lat: string, lng: string) => void
  className?: string
}

declare global {
  interface Window {
    ymaps: any
  }
}

export function YandexMap({ latitude, longitude, onCoordinatesChange, className }: YandexMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const placemarkRef = useRef<any>(null)

  useEffect(() => {
    const loadYandexMaps = () => {
      if (window.ymaps) {
        initMap()
        return
      }

      const script = document.createElement("script")
      script.src = "https://api-maps.yandex.ru/2.1/?apikey=&lang=ru_RU"
      script.onload = () => {
        window.ymaps.ready(initMap)
      }
      document.head.appendChild(script)
    }

    const initMap = () => {
      if (!mapRef.current || mapInstanceRef.current) return

      const lat = latitude ? Number.parseFloat(latitude) : 55.75393
      const lng = longitude ? Number.parseFloat(longitude) : 37.620795

      mapInstanceRef.current = new window.ymaps.Map(mapRef.current, {
        center: [lat, lng],
        zoom: 15,
        controls: ["zoomControl", "fullscreenControl"],
      })

      placemarkRef.current = new window.ymaps.Placemark(
        [lat, lng],
        {
          balloonContent: "Перетащите метку для изменения координат",
        },
        {
          preset: "islands#redDotIcon",
          draggable: true,
        },
      )

      placemarkRef.current.events.add("dragend", (e: any) => {
        const coords = e.get("target").geometry.getCoordinates()
        const newLat = coords[0].toFixed(6)
        const newLng = coords[1].toFixed(6)

        if (onCoordinatesChange) {
          onCoordinatesChange(newLat, newLng)
        }
      })

      mapInstanceRef.current.geoObjects.add(placemarkRef.current)
    }

    loadYandexMaps()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy()
        mapInstanceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (mapInstanceRef.current && placemarkRef.current && latitude && longitude) {
      const lat = Number.parseFloat(latitude)
      const lng = Number.parseFloat(longitude)

      if (!isNaN(lat) && !isNaN(lng)) {
        placemarkRef.current.geometry.setCoordinates([lat, lng])
        mapInstanceRef.current.setCenter([lat, lng])
      }
    }
  }, [latitude, longitude])

  return <div ref={mapRef} className={className} />
}
