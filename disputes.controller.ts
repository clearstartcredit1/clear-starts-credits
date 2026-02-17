import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ClientAccessService } from '../auth/client-access.service';

class CreateDisputeDto {
  @IsString() clientId!: string;
  @IsString() bureau!: string;
  @IsInt() round!: number;
  @IsArray() findingIds!: string[];
}

class UpdateDisputeDto {
  @IsString() status!: string;
  @IsOptional() @IsString() sentAt?: string;
}

@Controller('disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DisputesController {
  constructor(private prisma: PrismaService, private access: ClientAccessService) {}

  @Post()
  @Roles('ADMIN','STAFF')
  async create(@Body() dto: CreateDisputeDto, @Req() req: any) {
    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, dto.clientId);
    if (!ok) throw new Error('Forbidden');

    const dispute = await this.prisma.dispute.create({
      data: { clientId: dto.clientId, bureau: dto.bureau, round: dto.round, status: 'DRAFT' },
    });

    const findings = await this.prisma.auditFinding.findMany({ where: { id: { in: dto.findingIds } } });
    if (findings.length) {
      await this.prisma.disputeItem.createMany({
        data: findings.map(f => ({
          disputeId: dispute.id,
          tradelineId: f.tradelineId ?? null,
          reason: `${f.title}: ${f.description}`,
        })),
      });
    }

    await this.prisma.activityLog.create({
      data: { actorId: req.user.sub, clientId: dto.clientId, action: 'DISPUTE_CREATED', detail: `${dto.bureau} R${dto.round} items=${findings.length}` },
    });

    return { disputeId: dispute.id, items: findings.length };
  }

  @Get('client/:clientId')
  @Roles('ADMIN','STAFF')
  async listForClient(@Param('clientId') clientId: string, @Req() req: any) {
    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, clientId);
    if (!ok) throw new Error('Forbidden');

    return this.prisma.dispute.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: { items: true, letters: true },
    });
  }

  @Get(':disputeId')
  @Roles('ADMIN','STAFF')
  getOne(@Param('disputeId') disputeId: string) {
    return this.prisma.dispute.findUnique({ where: { id: disputeId }, include: { items: true, letters: true, client: true } });
  }

  @Patch(':disputeId')
  @Roles('ADMIN','STAFF')
  async update(@Param('disputeId') disputeId: string, @Body() dto: UpdateDisputeDto, @Req() req: any) {
    const existing = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!existing) throw new Error('Not found');

    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, existing.clientId);
    if (!ok) throw new Error('Forbidden');

    const data: any = { status: dto.status };
    if (dto.status === 'SENT') {
      const dueDays = Number(process.env.DISPUTE_DUE_DAYS || 35);
      const dueAt = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);
      data.sentAt = dto.sentAt ? new Date(dto.sentAt) : new Date();
      data.dueAt = dueAt;
    }

    const updated = await this.prisma.dispute.update({ where: { id: disputeId }, data });

    if (dto.status === 'SENT' && updated.dueAt) {
      await this.prisma.task.create({
        data: {
          clientId: updated.clientId,
          type: 'DISPUTE_FOLLOWUP',
          title: `Follow up on ${updated.bureau} Round ${updated.round}`,
          dueAt: updated.dueAt,
        },
      });
      await this.prisma.activityLog.create({
        data: { actorId: req.user.sub, clientId: updated.clientId, action: 'DISPUTE_SENT', detail: `${updated.bureau} R${updated.round}` },
      });
    }

    return updated;
  }
}
