import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ClientAccessService } from '../auth/client-access.service';

class AssignDto {
  @IsString() clientId!: string;
  @IsString() userId!: string;
  @IsString() role!: string;
}

@Controller('team')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamController {
  constructor(private prisma: PrismaService, private access: ClientAccessService) {}

  @Get('client/:clientId')
  @Roles('ADMIN','STAFF')
  async list(@Param('clientId') clientId: string, @Req() req: any) {
    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, clientId);
    if (!ok) throw new Error('Forbidden');

    return this.prisma.clientAssignment.findMany({ where: { clientId }, include: { user: true }, orderBy: { createdAt: 'desc' } });
  }

  @Post('assign')
  @Roles('ADMIN','STAFF')
  async assign(@Body() dto: AssignDto, @Req() req: any) {
    // Only ADMIN should assign others; keep simple: allow ADMIN only in practice
    if (req.user.role !== 'ADMIN') throw new Error('Forbidden');

    const a = await this.prisma.clientAssignment.upsert({
      where: { clientId_userId: { clientId: dto.clientId, userId: dto.userId } },
      update: { role: dto.role },
      create: { clientId: dto.clientId, userId: dto.userId, role: dto.role },
    });

    await this.prisma.activityLog.create({
      data: { actorId: req.user.sub, clientId: dto.clientId, action: 'CLIENT_ASSIGNED', detail: `user=${dto.userId} role=${dto.role}` },
    });

    return a;
  }
}
