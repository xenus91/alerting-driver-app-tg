import { NotificationsManager } from "@/components/notifications-manager"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getActiveSubscriptions } from "@/lib/database"
import { Bell, Users, Clock } from "lucide-react"

export default async function NotificationsPage() {
  const subscriptions = await getActiveSubscriptions()

  const intervalCounts = subscriptions.reduce(
    (acc, sub) => {
      const interval = sub.interval_minutes
      acc[interval] = (acc[interval] || 0) + 1
      return acc
    },
    {} as Record<number, number>,
  )

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Управление уведомлениями</h1>
        <p className="text-muted-foreground">Отправка уведомлений о статусе рассылок подписчикам в Telegram</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активные подписки</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions.length}</div>
            <p className="text-xs text-muted-foreground">пользователей подписано</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Интервалы уведомлений</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {Object.entries(intervalCounts).map(([interval, count]) => (
                <div key={interval} className="flex justify-between text-sm">
                  <span>{interval} мин</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Статус системы</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Активна</div>
            <p className="text-xs text-muted-foreground">готова к отправке</p>
          </CardContent>
        </Card>
      </div>

      <NotificationsManager />

      {subscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Активные подписки</CardTitle>
            <CardDescription>Список пользователей, подписанных на уведомления</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {subscriptions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">
                      {sub.full_name || sub.first_name || `Пользователь ${sub.telegram_id}`}
                    </div>
                    <div className="text-sm text-muted-foreground">Рассылка #{sub.trip_id}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{sub.interval_minutes} мин</div>
                    <div className="text-xs text-muted-foreground">
                      {sub.last_notification_at
                        ? `Последнее: ${new Date(sub.last_notification_at).toLocaleString()}`
                        : "Еще не отправлялось"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
