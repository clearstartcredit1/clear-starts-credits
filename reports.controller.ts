import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ClientAccessService } from '../auth/client-access.service';

class CreateSnapshotDto {
  @IsString() clientId!: string;
  @IsOptional() @IsString() provider?: string;
  @IsOptional() @IsString() reportType?: string;
}

class AddTradelineDto {
  @IsString() furnisher!: string;
  @IsString() accountType!: string;
  @IsString() status!: string;
  @IsOptional() @IsString() bureau?: string;
  @IsOptional() @IsInt() balance?: number;
  @IsOptional() @IsInt() limit?: number;
  @IsOptional() @IsString() paymentStatus?: string;
  @IsOptional() @IsString() remarks?: string;
}

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private prisma: PrismaService, private access: ClientAccessService) {}

  @Get('client/:clientId')
  @Roles('ADMIN','STAFF')
  async listClientSnapshots(@Param('clientId') clientId: string, @Req() req: any) {
    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, clientId);
    if (!ok) throw new Error('Forbidden');

    return this.prisma.creditReportSnapshot.findMany({ where: { clientId }, orderBy: { pulledAt: 'desc' } });
  }

  @Get('snapshot/:snapshotId')
  @Roles('ADMIN','STAFF')
  getSnapshot(@Param('snapshotId') snapshotId: string) {
    return this.prisma.creditReportSnapshot.findUnique({ where: { id: snapshotId }, include: { client: true } });
  }

  @Post('snapshots')
  @Roles('ADMIN','STAFF')
  async createSnapshot(@Body() dto: CreateSnapshotDto, @Req() req: any) {
    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, dto.clientId);
    if (!ok) throw new Error('Forbidden');

    const snap = await this.prisma.creditReportSnapshot.create({
      data: { clientId: dto.clientId, provider: dto.provider ?? 'MANUAL', reportType: dto.reportType ?? 'TRIMERGE' },
    });
    await this.prisma.activityLog.create({
      data: { actorId: req.user.sub, clientId: dto.clientId, action: 'SNAPSHOT_CREATED', detail: snap.id },
    });
    return snap;
  }

  @Get(':snapshotId/tradelines')
  @Roles('ADMIN','STAFF')
  listTradelines(@Param('snapshotId') snapshotId: string) {
    return this.prisma.tradeline.findMany({ where: { snapshotId }, orderBy: { createdAt: 'asc' } });
  }

  @Post(':snapshotId/tradelines')
  @Roles('ADMIN','STAFF')
  async addTradeline(@Param('snapshotId') snapshotId: string, @Body() dto: AddTradelineDto, @Req() req: any) {
    const snap = await this.prisma.creditReportSnapshot.findUnique({ where: { id: snapshotId } });
    if (!snap) throw new Error('Snapshot not found');

    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, snap.clientId);
    if (!ok) throw new Error('Forbidden');

    return this.prisma.tradeline.create({
      data: {
        snapshotId,
        furnisher: dto.furnisher,
        accountType: dto.accountType,
        status: dto.status,
        bureau: dto.bureau ?? null,
        balance: dto.balance ?? null,
        limit: dto.limit ?? null,
        paymentStatus: dto.paymentStatus ?? null,
        remarks: dto.remarks ?? null,
      },
    });
  }

  @Get(':snapshotId/findings')
  @Roles('ADMIN','STAFF')
  async listFindings(@Param('snapshotId') snapshotId: string) {
    const run = await this.prisma.auditRun.findFirst({
      where: { snapshotId },
      orderBy: { createdAt: 'desc' },
      include: { findings: true },
    });
    return { auditRunId: run?.id ?? null, findings: run?.findings ?? [] };
  }
}
