"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  Menu,
  Home,
  Upload,
  MessageSquare,
  Users,
  Bot,
  FileSpreadsheet,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

const menuItems = [
  {
    title: "Главная",
    href: "/",
    icon: Home,
    roles: ["admin", "operator"], // доступно всем
  },
  {
    title: "Загрузка файлов",
    href: "/upload",
    icon: Upload,
    roles: ["admin", "operator"],
  },
  {
    title: "Рассылки",
    href: "/trips",
    icon: MessageSquare,
    roles: ["admin", "operator"],
  },
  {
    title: "Пользователи",
    href: "/users",
    icon: Users,
    roles: ["admin", "operator"],
  },
  {
    title: "Пункты",
    href: "/points",
    icon: MapPin,
    roles: ["admin", "operator"],
  },
  {
    title: "Настройки бота",
    href: "/bot-settings",
    icon: Bot,
    roles: ["admin"], // только для админов
  },
]

interface SidebarProps {
  className?: string
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ className, collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { user } = useAuth()

  // Фильтруем пункты меню по роли пользователя
  const filteredMenuItems = menuItems.filter((item) => !user?.role || item.roles.includes(user.role))

  return (
    <div className={cn("pb-12 transition-all duration-300", collapsed ? "w-16" : "w-64", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-4">
            <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
              <FileSpreadsheet className="h-6 w-6 text-blue-600" />
              {!collapsed && <h2 className="text-lg font-semibold">Telegram Bot</h2>}
            </div>
            {onToggle && (
              <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8">
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            )}
          </div>
          <div className="space-y-1">
            {filteredMenuItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={pathname === item.href ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    pathname === item.href && "bg-blue-100 text-blue-900 hover:bg-blue-100",
                    collapsed && "px-2",
                  )}
                  title={collapsed ? item.title : undefined}
                >
                  <item.icon className={cn("h-4 w-4", !collapsed && "mr-2")} />
                  {!collapsed && item.title}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0 md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Открыть меню</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col">
        <Sidebar />
      </SheetContent>
    </Sheet>
  )
}
