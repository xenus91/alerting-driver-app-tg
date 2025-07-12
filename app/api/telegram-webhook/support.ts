import { sql } from '@neondatabase/serverless';
import { sendMessage } from '@/lib/telegram';
import { TelegramMessage } from './route';

const SUPPORT_CHAT_ID = process.env.SUPPORT_OPERATOR_CHAT_ID!;

interface SupportTicket {
  id: number;
  user_id: number;
  question: string;
  status: string;
  operator_message_id?: number;
  user_message_id?: number;
}

// Отправка вопроса операторам
export async function forwardToSupport(
  userId: number,
  userMessage: TelegramMessage,
  question: string
): Promise<SupportTicket> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const messageText = 
    `❓ НОВЫЙ ВОПРОС\n\n` +
    `👤 От: ${user.full_name}\n` +
    `📱 Тел: +${user.phone}\n` +
    `🏢 Автопарк: ${user.carpark}\n` +
    `👔 Роль: ${user.role}\n\n` +
    `💬 Вопрос:\n${question}`;

  const operatorMessage = await sendMessage(
    SUPPORT_CHAT_ID,
    messageText
  );

  const [ticket] = await sql`
    INSERT INTO support_tickets (
      user_id, question, operator_message_id, user_message_id
    ) VALUES (
      ${user.id}, ${question}, ${operatorMessage.message_id}, ${userMessage.message_id}
    ) RETURNING *
  `;

  return ticket;
}

// Обработка ответа оператора
export async function handleOperatorReply(
  operatorMessage: TelegramMessage,
  replyToMessage: TelegramMessage
) {
  // Находим тикет по ID сообщения
  const [ticket] = await sql`
    SELECT t.*, u.telegram_id 
    FROM support_tickets t
    JOIN users u ON t.user_id = u.id
    WHERE operator_message_id = ${replyToMessage.message_id}
      AND status = 'open'
  `;

  if (!ticket) return null;

  // Отправляем ответ пользователю
  await sendMessage(
    ticket.telegram_id,
    `📨 Ответ диспетчера:\n\n${operatorMessage.text}`
  );

  // Обновляем статус тикета
  await sql`
    UPDATE support_tickets
    SET status = 'answered',
        answered_at = NOW()
    WHERE id = ${ticket.id}
  `;

  return ticket;
}

// Проверка прав оператора
export async function isOperator(userId: number): Promise<boolean> {
  const user = await getUserById(userId);
  return !!user && ['operator', 'admin'].includes(user.role) && user.verified;
}

// Получение пользователя по ID
async function getUserById(userId: number) {
  const [user] = await sql`
    SELECT * FROM users WHERE id = ${userId}
  `;
  return user;
}
