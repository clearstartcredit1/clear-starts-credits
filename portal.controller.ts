import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Controller('portal')
@UseGuards(JwtAuthGuard)
export class PortalController {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  private async clientIdFor(req: any): Promise<string> {
    if (req.user.role !== 'CLIENT') throw new Error('Forbidden');
    const link = await this.prisma.clientPortalLink.findUnique({ where: { userId: req.user.sub } });
    if (!link) throw new Error('No client link');
    return link.clientId;
  }

  @Get('dashboard')
  async dashboard(@Req() req: any) {
    const clientId = await this.clientIdFor(req);

    const latestSnapshot = await this.prisma.creditReportSnapshot.findFirst({
      where: { clientId },
      orderBy: { pulledAt: 'desc' },
      include: { auditRuns: { orderBy: { createdAt: 'desc' }, take: 1, include: { findings: true } } },
    });

    const disputes = await this.prisma.dispute.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: { items: true, letters: true },
      take: 20,
    });

    const docs = await this.prisma.document.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return { clientId, latestSnapshot, disputes, docs };
  }

  @Get('progress')
  async progress(@Req() req: any) {
    const clientId = await this.clientIdFor(req);

    const docs = await this.prisma.document.findMany({ where: { clientId } });
    const hasID = docs.some(d => d.type === 'ID');
    const hasPOA = docs.some(d => d.type === 'POA');

    const snapshot = await this.prisma.creditReportSnapshot.findFirst({ where: { clientId }, orderBy: { pulledAt: 'desc' } });
    const audit = snapshot ? await this.prisma.auditRun.findFirst({ where: { snapshotId: snapshot.id }, orderBy: { createdAt: 'desc' } }) : null;
    const dispute = await this.prisma.dispute.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' } });
    const letter = dispute ? await this.prisma.letter.findFirst({ where: { disputeId: dispute.id }, orderBy: { createdAt: 'desc' } }) : null;

    let pct = 0;
    if (hasID) pct += 20;
    if (hasPOA) pct += 20;
    if (snapshot) pct += 20;
    if (audit) pct += 20;
    if (letter) pct += 20;

    const nextSteps: string[] = [];
    if (!hasID) nextSteps.push('Upload your ID');
    if (!hasPOA) nextSteps.push('Upload your proof of address');
    if (!snapshot) nextSteps.push('We need your credit report added');
    if (snapshot && !audit) nextSteps.push('Audit is pending');
    if (audit && !letter) nextSteps.push('Dispute letter is being prepared');

    return { percent: pct, nextSteps };
  }

  @Get('letters/:letterId/download')
  async downloadLetter(@Req() req: any, @Param('letterId') letterId: string) {
    const clientId = await this.clientIdFor(req);
    const letter = await this.prisma.letter.findUnique({ where: { id: letterId }, include: { dispute: true } });
    if (!letter || letter.dispute.clientId !== clientId) throw new Error('Not found');
    const url = await this.storage.getSignedDownloadUrl(letter.pdfKey, 600);
    return { url };
  }

  @Get('documents/:docId/download')
  async downloadDoc(@Req() req: any, @Param('docId') docId: string) {
    const clientId = await this.clientIdFor(req);
    const doc = await this.prisma.document.findFirst({ where: { id: docId, clientId } });
    if (!doc) throw new Error('Not found');
    const url = await this.storage.getSignedDownloadUrl(doc.storageKey, 600);
    return { url };
  }
}
