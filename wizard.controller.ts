import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ClientAccessService } from '../auth/client-access.service';

@Controller('wizard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WizardController {
  constructor(private prisma: PrismaService, private access: ClientAccessService) {}

  @Get('snapshot/:snapshotId')
  @Roles('ADMIN','STAFF')
  async snapshotWizard(@Param('snapshotId') snapshotId: string, @Req() req: any) {
    const snapshot = await this.prisma.creditReportSnapshot.findUnique({
      where: { id: snapshotId },
      include: { client: true, tradelines: true },
    });
    if (!snapshot) throw new Error('Snapshot not found');

    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, snapshot.clientId);
    if (!ok) throw new Error('Forbidden');

    const latestAudit = await this.prisma.auditRun.findFirst({
      where: { snapshotId },
      orderBy: { createdAt: 'desc' },
      include: { findings: true },
    });

    const disputes = await this.prisma.dispute.findMany({
      where: { clientId: snapshot.clientId },
      orderBy: { createdAt: 'desc' },
      include: { items: true, letters: true },
      take: 10,
    });

    return { snapshot, latestAudit, disputes };
  }
}
