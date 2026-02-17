import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StorageService } from '../storage/storage.service';
import { ClientAccessService } from '../auth/client-access.service';
import PDFDocument from 'pdfkit';

@Controller('letters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LettersController {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private access: ClientAccessService,
  ) {}

  @Post(':disputeId/generate')
  @Roles('ADMIN','STAFF')
  async generate(@Param('disputeId') disputeId: string, @Req() req: any) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { items: true, client: true },
    });
    if (!dispute) throw new Error('Dispute not found');

    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, dispute.clientId);
    if (!ok) throw new Error('Forbidden');

    const pdfBuffer = await renderPdf(dispute);

    const key = `clients/${dispute.clientId}/letters/${dispute.id}-${Date.now()}.pdf`;
    await this.storage.putObject(key, pdfBuffer, 'application/pdf');

    const letter = await this.prisma.letter.create({
      data: {
        disputeId: dispute.id,
        templateId: `BUREAU_${dispute.bureau}_ROUND_${dispute.round}`,
        pdfKey: key,
      },
    });

    await this.prisma.activityLog.create({
      data: { actorId: req.user.sub, clientId: dispute.clientId, action: 'LETTER_GENERATED', detail: letter.id },
    });

    return { letterId: letter.id };
  }

  @Get(':letterId/download')
  @Roles('ADMIN','STAFF')
  async download(@Param('letterId') letterId: string) {
    const letter = await this.prisma.letter.findUnique({ where: { id: letterId } });
    if (!letter) throw new Error('Letter not found');
    const url = await this.storage.getSignedDownloadUrl(letter.pdfKey, 600);
    return { url };
  }

  @Get('dispute/:disputeId')
  @Roles('ADMIN','STAFF')
  listByDispute(@Param('disputeId') disputeId: string) {
    return this.prisma.letter.findMany({ where: { disputeId }, orderBy: { createdAt: 'desc' } });
  }
}

function renderPdf(dispute: any): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks: any[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const bureauName =
      dispute.bureau === 'EX' ? 'Experian' :
      dispute.bureau === 'EQ' ? 'Equifax' :
      dispute.bureau === 'TU' ? 'TransUnion' : dispute.bureau;

    doc.fontSize(16).text(`Dispute Letter – Round ${dispute.round}`, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`To: ${bureauName}`);
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    doc.text(`Re: Credit Report Dispute – ${dispute.client.firstName} ${dispute.client.lastName}`);
    doc.moveDown();
    doc.text(`I am disputing the accuracy of the items listed below. Please investigate and correct or delete any information that cannot be verified.`);
    doc.moveDown();

    doc.text('Disputed Items:');
    doc.moveDown(0.3);
    dispute.items.forEach((it: any, idx: number) => {
      doc.text(`${idx+1}. ${it.reason}`);
      doc.moveDown(0.2);
    });

    doc.moveDown();
    doc.text('Sincerely,');
    doc.text(`${dispute.client.firstName} ${dispute.client.lastName}`);
    doc.moveDown();
    doc.fontSize(10).fillColor('#444').text('Enclosures: ID, Proof of Address, Supporting documents');

    doc.end();
  });
}
