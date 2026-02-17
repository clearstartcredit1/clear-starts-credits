import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ClientAccessService } from '../auth/client-access.service';

class CreateTaskDto {
  @IsString() clientId!: string;
  @IsString() title!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() assignedTo?: string;
  @IsOptional() @IsString() dueAt?: string;
}

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private prisma: PrismaService, private access: ClientAccessService) {}

  @Get('open')
  @Roles('ADMIN','STAFF')
  listOpen() {
    return this.prisma.task.findMany({
      where: { status: 'OPEN' },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  @Get('client/:clientId')
  @Roles('ADMIN','STAFF')
  async listForClient(@Param('clientId') clientId: string, @Req() req: any) {
    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, clientId);
    if (!ok) throw new Error('Forbidden');

    return this.prisma.task.findMany({ where: { clientId }, orderBy: [{ status: 'asc' }, { dueAt: 'asc' }] });
  }

  @Post()
  @Roles('ADMIN','STAFF')
  async create(@Body() dto: CreateTaskDto, @Req() req: any) {
    const ok = await this.access.canAccessClient(req.user.sub, req.user.role, dto.clientId);
    if (!ok) throw new Error('Forbidden');

    const t = await this.prisma.task.create({
      data: {
        clientId: dto.clientId,
        title: dto.title,
        notes: dto.notes ?? null,
        type: (dto.type as any) ?? 'GENERAL',
        assignedTo: dto.assignedTo ?? null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      },
    });

    await this.prisma.activityLog.create({
      data: { actorId: req.user.sub, clientId: dto.clientId, action: 'TASK_CREATED', detail: t.title },
    });

    return t;
  }

  @Patch(':taskId/done')
  @Roles('ADMIN','STAFF')
  async done(@Param('taskId') taskId: string, @Req() req: any) {
    const t = await this.prisma.task.update({ where: { id: taskId }, data: { status: 'DONE' } });
    await this.prisma.activityLog.create({ data: { actorId: req.user.sub, clientId: t.clientId, action: 'TASK_DONE', detail: t.title } });
    return t;
  }
}
