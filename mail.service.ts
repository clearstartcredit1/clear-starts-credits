import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

  async sendClientInvite(params: { to: string; clientName: string; inviteLink: string }) {
    const brand = process.env.BRAND_NAME || 'Clear Start Credit';
    const from = process.env.MAIL_FROM || `${brand} <no-reply@localhost>`;
    const support = process.env.SUPPORT_EMAIL || 'support@localhost';

    const subject = `${brand} – Activate your Client Portal`;
    const html = `
      <div style="font-family:Arial;line-height:1.5">
        <h2>${escapeHtml(brand)} – Client Portal</h2>
        <p>Hi ${escapeHtml(params.clientName)},</p>
        <p>Click to activate your portal (expires in 24 hours):</p>
        <p><a href="${params.inviteLink}" style="background:#111;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700">Activate Portal</a></p>
        <p style="color:#555;font-size:12px">Questions? ${escapeHtml(support)}</p>
      </div>
    `;
    const text = `Hi ${params.clientName}\n\nActivate: ${params.inviteLink}\n\n— ${brand}`;

    await this.transporter.sendMail({ from, to: params.to, subject, html, text });
  }

  async sendDisputeReminder(params: { to: string; clientName: string; bureau: string; round: number; dueAt: Date; daysLeft: number }) {
    const brand = process.env.BRAND_NAME || 'Clear Start Credit';
    const from = process.env.MAIL_FROM || `${brand} <no-reply@localhost>`;
    const subject = `${brand} – Dispute follow-up reminder (${params.daysLeft} days)`;
    const html = `
      <div style="font-family:Arial;line-height:1.5">
        <h2>${escapeHtml(brand)} – Follow-up Reminder</h2>
        <p>Hi ${escapeHtml(params.clientName)},</p>
        <p>Reminder: ${escapeHtml(params.bureau)} Round ${params.round} follow-up is due in <b>${params.daysLeft}</b> day(s).</p>
        <p><b>Due:</b> ${escapeHtml(params.dueAt.toLocaleDateString())}</p>
      </div>
    `;
    const text = `Reminder: ${params.bureau} Round ${params.round} due in ${params.daysLeft} day(s). Due: ${params.dueAt.toLocaleDateString()}`;
    await this.transporter.sendMail({ from, to: params.to, subject, html, text });
  }
}

function escapeHtml(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
