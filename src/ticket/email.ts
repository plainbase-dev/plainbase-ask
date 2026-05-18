import nodemailer from 'nodemailer';
import type { Message } from '../db/schema.js';

export async function sendTicketEmail(opts: {
  to: string;
  userEmail: string;
  messages: Message[];
}): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  const body = opts.messages
    .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join('\n\n');

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: opts.to,
    replyTo: opts.userEmail,
    subject: `[Support Ticket] New request from ${opts.userEmail}`,
    text: `From: ${opts.userEmail}\n\n--- Conversation ---\n\n${body}`,
  });
}
