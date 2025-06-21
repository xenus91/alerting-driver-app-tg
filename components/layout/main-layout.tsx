import type React from "react"
import { Sidebar, MobileSidebar } from "@/components/sidebar"

interface MainLayoutProps {
  children: React.ReactNode
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="h-full">
      <div className="hidden md:flex h-full w-64 flex-col fixed inset-y-0 z-50">
        <Sidebar />
      </div>
      <MobileSidebar />
      <main className="md:pl-64">{children}</main>
    </div>
  )
}

export default MainLayout
