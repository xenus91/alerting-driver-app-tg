"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogOut, User } from "lucide-react"

export function UserMenu() {
  const { user, logout } = useAuth()

  if (!user) return null

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-auto px-3">
          <Avatar className="h-8 w-8 mr-2">
            <AvatarFallback className="bg-blue-100 text-blue-900">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start text-sm">
            <span className="font-medium">{user.name}</span>
            <span className="text-xs text-muted-foreground">{user.carpark || "Не указан"}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">ID: {user.telegram_id}</p>
            <p className="text-xs leading-none text-muted-foreground">Роль: {user.role}</p>
            {user.carpark && <p className="text-xs leading-none text-muted-foreground">Автопарк: {user.carpark}</p>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          <span>Профиль</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Выйти</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
