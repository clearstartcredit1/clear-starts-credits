import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ClientAccessService } from '../auth/client-access.service';

@Controller('activity')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityController {
  constructor(private prisma: PrismaService, private access: ClientAccessService) {}

  @Get('recent')
  @Roles('ADMIN','STAFF')
  recent() {
    return this.prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }

  @Get('client/:clientId')
  @Roles('ADMIN','STAFF')
  async byClient(@Param('clientId') clientId: string, @Req() req: any) {
    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, clientId);
    if (!ok) throw new Error('Forbidden');

    return this.prisma.activityLog.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, take: 200 });
  }
}
