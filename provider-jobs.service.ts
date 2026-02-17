import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProviderJobsService {
  constructor(private prisma: PrismaService) {}

  async enqueue(provider: string, kind: string, clientId: string | null, payload: any) {
    const evt = await this.prisma.providerEvent.create({
      data: { provider, clientId, type: kind, providerRef: payload?.id ?? null, rawJson: JSON.stringify(payload) },
    });
    const job = await this.prisma.providerJob.create({
      data: { provider, kind, clientId, status: 'QUEUED' },
    });
    return { evtId: evt.id, jobId: job.id };
  }

  async runQueued(limit = 10) {
    const jobs = await this.prisma.providerJob.findMany({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    for (const job of jobs) {
      await this.prisma.providerJob.update({ where: { id: job.id }, data: { status: 'RUNNING' } });
      try {
        if (!job.clientId) throw new Error('clientId required');

        const evt = await this.prisma.providerEvent.findFirst({
          where: { provider: job.provider, clientId: job.clientId },
          orderBy: { receivedAt: 'desc' },
        });
        if (!evt) throw new Error('ProviderEvent missing');

        const payload = JSON.parse(evt.rawJson);

        // DEMO mapping: expects payload.tradelines array
        const snapshot = await this.prisma.creditReportSnapshot.create({
          data: { clientId: job.clientId, provider: job.provider, reportType: 'TRIMERGE', pulledAt: new Date() },
        });

        const tradelines = Array.isArray(payload.tradelines) ? payload.tradelines : [];
        if (tradelines.length) {
          await this.prisma.tradeline.createMany({
            data: tradelines.map((t: any) => ({
              snapshotId: snapshot.id,
              furnisher: t.furnisher || 'Unknown',
              accountType: t.type || t.accountType || 'Unknown',
              status: t.status || 'Unknown',
              bureau: t.bureau ?? null,
              balance: t.balance ?? null,
              limit: t.limit ?? null,
              paymentStatus: t.paymentStatus ?? null,
              remarks: t.remarks ?? null,
            })),
          });
        }

        await this.prisma.activityLog.create({
          data: { actorId: null, clientId: job.clientId, action: 'PROVIDER_IMPORT', detail: `${job.provider} snapshot=${snapshot.id}` },
        });

        await this.prisma.providerJob.update({ where: { id: job.id }, data: { status: 'DONE' } });
      } catch (e: any) {
        await this.prisma.providerJob.update({ where: { id: job.id }, data: { status: 'FAILED', error: e.message } });
      }
    }
  }
}
