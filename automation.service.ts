import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ProviderJobsService } from '../provider-jobs/provider-jobs.service';

@Injectable()
export class AutomationService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private providerJobs: ProviderJobsService,
  ) {}

  @Cron('0 * * * *') // hourly
  async run() {
    const now = new Date();

    // 1) Round suggestion tasks + optional auto-create
    const overdue = await this.prisma.dispute.findMany({
      where: { status: 'SENT', dueAt: { lte: now } },
      include: { items: true },
    });

    for (const d of overdue) {
      const nextRound = Math.min(d.round + 1, 3);
      if (nextRound === d.round) continue;

      const type = nextRound === 2 ? 'ROUND_2_PREP' : 'ROUND_3_PREP';
      const existing = await this.prisma.task.findFirst({
        where: { clientId: d.clientId, status: 'OPEN', type: type as any, title: { contains: `${d.bureau} Round ${nextRound}` } },
      });

      if (!existing) {
        await this.prisma.task.create({
          data: { clientId: d.clientId, type: type as any, title: `Prepare ${d.bureau} Round ${nextRound} (follow-up)`, dueAt: new Date(Date.now() + 2*24*60*60*1000) },
        });
        await this.prisma.activityLog.create({
          data: { actorId: null, clientId: d.clientId, action: 'ROUND_SUGGESTED', detail: `${d.bureau} R${nextRound}` },
        });
      }

      const auto = String(process.env.AUTO_CREATE_NEXT_ROUNDS || 'false') === 'true';
      if (auto) {
        const already = await this.prisma.dispute.findFirst({ where: { clientId: d.clientId, bureau: d.bureau, round: nextRound } });
        if (!already) {
          const created = await this.prisma.dispute.create({ data: { clientId: d.clientId, bureau: d.bureau, round: nextRound, status: 'DRAFT' } });
          if (d.items.length) {
            await this.prisma.disputeItem.createMany({
              data: d.items.map(it => ({ disputeId: created.id, tradelineId: it.tradelineId ?? null, reason: it.reason })),
            });
          }
          await this.prisma.activityLog.create({ data: { actorId: null, clientId: d.clientId, action: 'ROUND_CREATED', detail: `${d.bureau} R${nextRound}` } });
        }
      }
    }

    // 2) Reminder emails (7/3/1 days before due)
    const remindersOn = String(process.env.ENABLE_REMINDERS || 'false') === 'true';
    const reminderDays = (process.env.REMINDER_DAYS || '7,3,1')
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => Number.isFinite(n) && n > 0);

    if (remindersOn) {
      const sentDisputes = await this.prisma.dispute.findMany({
        where: { status: 'SENT', dueAt: { not: null } },
        include: { client: true },
      });

      for (const d of sentDisputes) {
        if (!d.dueAt || !d.client?.email) continue;

        const msLeft = d.dueAt.getTime() - Date.now();
        const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
        if (!reminderDays.includes(daysLeft)) continue;

        const already = await this.prisma.reminderLog.findUnique({
          where: { disputeId_dayMark: { disputeId: d.id, dayMark: daysLeft } },
        });
        if (already) continue;

        await this.mail.sendDisputeReminder({
          to: d.client.email,
          clientName: `${d.client.firstName} ${d.client.lastName}`,
          bureau: d.bureau,
          round: d.round,
          dueAt: d.dueAt,
          daysLeft,
        });

        await this.prisma.reminderLog.create({ data: { disputeId: d.id, dayMark: daysLeft } });
        await this.prisma.activityLog.create({ data: { actorId: null, clientId: d.clientId, action: 'REMINDER_SENT', detail: `${d.bureau} R${d.round} ${daysLeft}d` } });
      }
    }

    // 3) Provider jobs
    await this.providerJobs.runQueued(10);
  }
}
