import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ProviderJobsService } from './provider-jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientAccessService } from '../auth/client-access.service';

class ImportDto {
  @IsString() clientId!: string;
  @IsString() provider!: string;
  @IsString() json!: string;
}

@Controller('provider-import')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProviderImportController {
  constructor(
    private jobs: ProviderJobsService,
    private prisma: PrismaService,
    private access: ClientAccessService,
  ) {}

  @Post()
  @Roles('ADMIN','STAFF')
  async import(@Body() dto: ImportDto, @Req() req: any) {
    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, dto.clientId);
    if (!ok) throw new Error('Forbidden');

    let payload: any;
    try { payload = JSON.parse(dto.json); } catch { throw new Error('Invalid JSON'); }

    const { jobId } = await this.jobs.enqueue(dto.provider, 'IMPORT_REPORT', dto.clientId, payload);
    await this.prisma.activityLog.create({
      data: { actorId: req.user.sub, clientId: dto.clientId, action: 'PROVIDER_IMPORT_ENQUEUED', detail: `${dto.provider} job=${jobId}` },
    });
    return { ok: true, jobId };
  }
}
