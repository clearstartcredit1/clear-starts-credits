import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientAccessService {
  constructor(private prisma: PrismaService) {}

  async canAccessClient(userId: string, role: string, clientId: string): Promise<boolean> {
    if (role === 'ADMIN') return true;

    if (role === 'STAFF') {
      const a = await this.prisma.clientAssignment.findFirst({ where: { clientId, userId } });
      return !!a;
    }

    if (role === 'CLIENT') {
      const link = await this.prisma.clientPortalLink.findUnique({ where: { userId } });
      return link?.clientId === clientId;
    }

    return false;
  }
}
