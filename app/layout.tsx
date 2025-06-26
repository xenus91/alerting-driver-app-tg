import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/components/auth/auth-provider"
import MainLayout from "@/components/layout/main-layout"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Система управления рейсами",
  description: "Telegram бот для управления рейсами и водителями",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <AuthProvider>
          <MainLayout>{children}</MainLayout>
        </AuthProvider>
      </body>
    </html>
  )
}
