import type React from "react"

interface MainLayoutProps {
  children: React.ReactNode
  user?: {
    telegram_id?: string
    // Add other user properties as needed
  }
}

import { ActiveSubscriptionsIndicator } from "../active-subscriptions-indicator"

const MainLayout: React.FC<MainLayoutProps> = ({ children, user }) => {
  return (
    <div>
      <header>
        {/* Header content */}
        <h1>My App</h1>
      </header>

      <main>{children}</main>

      <footer>
        {/* Footer content */}
        <p>Copyright 2024</p>
        {user && (
          <div>
            <p>User Telegram ID: {user.telegram_id}</p>
            <ActiveSubscriptionsIndicator userTelegramId={user?.telegram_id} />
          </div>
        )}
      </footer>
    </div>
  )
}

export default MainLayout
