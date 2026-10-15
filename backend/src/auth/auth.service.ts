import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto';

interface GoogleUserData {
  email: string;
  name: string;
  avatar?: string;
  providerId: string;
}

export interface TokenPayload {
  accessToken: string;
  refreshToken: string;
}

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role: user.role,
    level: user.level,
    totalXp: user.totalXp,
  };
}

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private logger = new Logger('AuthService');

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD if it doesn't exist yet.
  async onApplicationBootstrap() {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) return;
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return;
    await this.createUser({
      email,
      password,
      username: process.env.ADMIN_USERNAME || 'admin',
      name: process.env.ADMIN_NAME || 'Administrator',
      role: 'ADMIN',
    });
    this.logger.log(`Created admin user ${email}`);
  }

  async createUser(data: {
    email: string;
    username: string;
    password: string;
    name: string;
    avatar?: string;
    role?: 'ADMIN' | 'USER';
  }) {
    const email = data.email.trim().toLowerCase();
    const username = data.username.trim().toLowerCase();
    const clash = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (clash) {
      throw new ConflictException(
        clash.email === email
          ? 'Email already registered'
          : 'Username already taken',
      );
    }
    return this.prisma.user.create({
      data: {
        email,
        username,
        passwordHash: await bcrypt.hash(data.password, 12),
        name: data.name,
        avatar: data.avatar,
        role: data.role ?? 'USER',
      },
    });
  }

  async register(dto: RegisterDto) {
    const user = await this.createUser(dto);
    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return { user: publicUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const identifier = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: identifier.includes('@')
        ? { email: identifier }
        : { username: identifier },
    });
    if (!user || !user.passwordHash || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return { user: publicUser(user), ...tokens };
  }

  async validateGoogleUser(data: GoogleUserData) {
    let user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: data.email,
          username: await this.uniqueUsername(data.email),
          name: data.name,
          avatar: data.avatar,
          provider: 'google',
          providerId: data.providerId,
          emailVerified: true,
        },
      });
    }

    return user;
  }

  async googleLogin(user: { id: string; email: string }) {
    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    const tokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!tokenMatches) {
      throw new UnauthorizedException('Access denied');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        avatar: true,
        level: true,
        totalXp: true,
        dailyTaskCount: true,
        dailyHours: true,
        difficulty: true,
        createdAt: true,
      },
    });
    return user;
  }

  private async uniqueUsername(email: string) {
    const base =
      email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9_.-]/g, '')
        .slice(0, 24) || 'user';
    let candidate = base.length >= 3 ? base : `${base}user`;
    for (
      let i = 1;
      await this.prisma.user.findUnique({ where: { username: candidate } });
      i++
    ) {
      candidate = `${base}${i}`;
    }
    return candidate;
  }

  private async generateTokens(
    userId: string,
    email: string,
  ): Promise<TokenPayload> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ sub: userId, email }, { expiresIn: '15m' }),
      this.jwtService.signAsync({ sub: userId, email }, { expiresIn: '7d' }),
    ]);
    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hash },
    });
  }
}
