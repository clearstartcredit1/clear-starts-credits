import { Controller, Post, Param, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ClientAccessService } from '../auth/client-access.service';
import { runAudit } from './audit.rules';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private prisma: PrismaService, private access: ClientAccessService) {}

  @Post(':snapshotId/audit')
  @Roles('ADMIN','STAFF')
  async audit(@Param('snapshotId') snapshotId: string, @Req() req: any) {
    const snapshot = await this.prisma.creditReportSnapshot.findUnique({
      where: { id: snapshotId },
      include: { tradelines: true },
    });
    if (!snapshot) throw new Error('Snapshot not found');

    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, snapshot.clientId);
    if (!ok) throw new Error('Forbidden');

    const auditRun = await this.prisma.auditRun.create({ data: { snapshotId, engineVer: '1.0.0' } });
    const findings = runAudit(snapshot.tradelines);

    if (findings.length) {
      await this.prisma.auditFinding.createMany({
        data: findings.map(f => ({
          auditRunId: auditRun.id,
          ruleId: f.ruleId,
          severity: f.severity,
          title: f.title,
          description: f.description,
          tradelineId: f.tradelineId ?? null,
        })),
      });
    }

    await this.prisma.activityLog.create({
      data: { actorId: req.user.sub, clientId: snapshot.clientId, action: 'AUDIT_RAN', detail: `snapshot=${snapshotId} findings=${findings.length}` },
    });

    return { auditRunId: auditRun.id, findingsCount: findings.length };
  }
}
