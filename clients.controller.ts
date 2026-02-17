import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ClientsService } from './clients.service';

class CreateClientDto {
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() createPortalUser?: boolean;
}

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private clients: ClientsService) {}

  @Get()
  @Roles('ADMIN','STAFF')
  list(@Req() req: any) {
    return this.clients.listForUser(req.user.sub, req.user.role);
  }

  @Post()
  @Roles('ADMIN','STAFF')
  create(@Body() dto: CreateClientDto, @Req() req: any) {
    return this.clients.create(
      { ...dto, actorUserId: req.user.sub },
      dto.createPortalUser !== false,
    );
  }
}
