import { Bell } from "lucide-react"

interface NavItem {
  title: string
  href: string
  icon: any // Consider using a more specific type for icons
}

const Sidebar = () => {
  const navItems: NavItem[] = [
    {
      title: "Главная",
      href: "/",
      icon: null, // Replace with an actual icon if available
    },
    {
      title: "Профиль",
      href: "/profile",
      icon: null, // Replace with an actual icon if available
    },
    {
      title: "Уведомления",
      href: "/notifications",
      icon: Bell,
    },
  ]

  return (
    <div className="w-64 bg-gray-100 h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Меню</h1>
      <ul>
        {navItems.map((item) => (
          <li key={item.title} className="mb-2">
            <a href={item.href} className="block p-2 rounded hover:bg-gray-200">
              {item.icon && <item.icon className="inline-block mr-2" />}
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Sidebar
