import { ApiKeysManager } from "@/components/api-keys-manager"

export default function ApiKeysPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">API Ключи</h1>
        <p className="text-muted-foreground mt-2">
          Создавайте и управляйте API ключами для интеграции с внешними системами (Power BI, Excel, и др.)
        </p>
      </div>
      <ApiKeysManager />
    </div>
  )
}
