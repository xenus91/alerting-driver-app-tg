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
