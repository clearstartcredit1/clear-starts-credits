import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthService } from '../auth/auth.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private auth: AuthService,
  ) {}

  async listForUser(userId: string, role: string) {
    if (role === 'ADMIN') {
      return this.prisma.client.findMany({ orderBy: { createdAt: 'desc' } });
    }
    // STAFF: only assigned
    return this.prisma.client.findMany({
      where: { assignments: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: any, createPortalUser: boolean) {
    const client = await this.prisma.client.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email?.toLowerCase() ?? null,
        phone: dto.phone ?? null,
      },
    });

    // Assign creator as OWNER if staff/admin
    if (dto.actorUserId) {
      await this.prisma.clientAssignment.create({
        data: { clientId: client.id, userId: dto.actorUserId, role: 'OWNER' },
      });
    }

    if (createPortalUser && client.email) {
      const user = await this.prisma.user.create({
        data: {
          email: client.email,
          passwordHash: await bcrypt.hash('TEMP_DISABLED', 10),
          role: 'CLIENT',
          isActive: false,
          mustChangePassword: true,
        },
      });

      await this.prisma.clientPortalLink.create({ data: { clientId: client.id, userId: user.id } });

      const rawToken = await this.auth.createInviteTokenForUser(user.id);
      const portalBase = process.env.CLIENT_PORTAL_URL || 'http://localhost:3002';
      const inviteLink = `${portalBase}/set-password?token=${rawToken}`;

      await this.mail.sendClientInvite({
        to: user.email,
        clientName: `${client.firstName} ${client.lastName}`,
        inviteLink,
      });

      await this.prisma.activityLog.create({
        data: { actorId: dto.actorUserId ?? null, clientId: client.id, action: 'CLIENT_INVITED', detail: user.email },
      });
    }

    return client;
  }
}
