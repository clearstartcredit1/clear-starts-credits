import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) throw new Error('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new Error('Invalid credentials');

    const token = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { accessToken: token, role: user.role };
  }

  async createInviteTokenForUser(userId: string) {
    const raw = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(raw).digest('hex');

    await this.prisma.inviteToken.create({
      data: {
        userId,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return raw;
  }

  async setPasswordFromInvite(token: string, newPassword: string) {
    const hash = createHash('sha256').update(token).digest('hex');
    const invite = await this.prisma.inviteToken.findUnique({ where: { tokenHash: hash }, include: { user: true } });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) throw new Error('Invalid or expired token');

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: invite.userId },
      data: { passwordHash, isActive: true, mustChangePassword: false },
    });

    await this.prisma.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } });

    return { ok: true };
  }
}
