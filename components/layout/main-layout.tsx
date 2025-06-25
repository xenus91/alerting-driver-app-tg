"use client"

import type React from "react"
import { useState } from "react"
import { Sidebar, MobileSidebar } from "@/components/sidebar"
import { UserMenu } from "@/components/user-menu"

interface MainLayoutProps {
  children: React.ReactNode
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  return (
    <div className="h-full">
      {/* Desktop Sidebar */}
      <div
        className={`hidden md:flex h-full ${sidebarCollapsed ? "w-16" : "w-64"} flex-col fixed inset-y-0 z-50 transition-all duration-300`}
      >
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebar />

      {/* Main Content */}
      <main className={`${sidebarCollapsed ? "md:pl-16" : "md:pl-64"} transition-all duration-300`}>
        {/* Top Bar */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-end">
            <UserMenu />
          </div>
        </div>

        {/* Page Content */}
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}

export default MainLayout
