import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { useNotificationChecker } from "@/hooks/use-notification-checker"

export const metadata: Metadata = {
  title: "v0 App",
  description: "Created with v0",
  generator: "v0.dev",
}

function NotificationChecker() {
  useNotificationChecker()
  return null
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <NotificationChecker />
      </body>
    </html>
  )
}
