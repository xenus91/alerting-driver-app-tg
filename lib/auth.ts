import type { NextAuthOptions } from "next-auth"

export const authOptions: NextAuthOptions = {
  providers: [
    // Здесь будут провайдеры аутентификации
    // Пока оставляем пустым, так как используем кастомную аутентификацию через Telegram
  ],
  callbacks: {
    async session({ session, token }) {
      return session
    },
    async jwt({ token, user }) {
      return token
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
}
