import { Controller, Get, Param, Post, UseGuards, UploadedFile, UseInterceptors, Body, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ClientAccessService } from '../auth/client-access.service';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private access: ClientAccessService,
  ) {}

  @Get(':clientId/documents')
  @Roles('ADMIN','STAFF')
  async list(@Param('clientId') clientId: string, @Req() req: any) {
    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, clientId);
    if (!ok) throw new Error('Forbidden');

    return this.prisma.document.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } });
  }

  @Post(':clientId/documents/upload')
  @Roles('ADMIN','STAFF','CLIENT')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('clientId') clientId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
    @Req() req: any,
  ) {
    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, clientId);
    if (!ok) throw new Error('Forbidden');
    if (!file) throw new Error('No file uploaded');

    const key = `clients/${clientId}/documents/${Date.now()}-${file.originalname}`;
    const saved = await this.storage.putObject(key, file.buffer, file.mimetype || 'application/octet-stream');

    const doc = await this.prisma.document.create({
      data: { clientId, type: type || 'OTHER', filename: file.originalname, storageKey: saved.storageKey },
    });

    await this.prisma.activityLog.create({
      data: { actorId: req.user.sub, clientId, action: 'DOC_UPLOADED', detail: `${doc.type}: ${doc.filename}` },
    });

    return doc;
  }

  @Get(':clientId/documents/:docId/download')
  @Roles('ADMIN','STAFF','CLIENT')
  async download(@Param('clientId') clientId: string, @Param('docId') docId: string, @Req() req: any) {
    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, clientId);
    if (!ok) throw new Error('Forbidden');

    const doc = await this.prisma.document.findFirst({ where: { id: docId, clientId } });
    if (!doc) throw new Error('Not found');

    const url = await this.storage.getSignedDownloadUrl(doc.storageKey, 600);
    return { url };
  }
}
