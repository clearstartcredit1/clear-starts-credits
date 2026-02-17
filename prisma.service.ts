import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();

    // Bootstrap admin user (first run)
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@clearstartcredit.local').toLowerCase();
    const adminPass = process.env.ADMIN_PASSWORD || 'Admin123!';
    const existing = await this.user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      const hash = await bcrypt.hash(adminPass, 10);
      await this.user.create({
        data: {
          email: adminEmail,
          passwordHash: hash,
          role: 'ADMIN',
          isActive: true,
        },
      });
      // eslint-disable-next-line no-console
      console.log(`[BOOTSTRAP] Created admin user: ${adminEmail}`);
    }
  }
}
