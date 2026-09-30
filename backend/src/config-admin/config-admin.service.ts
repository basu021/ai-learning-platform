import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

const SENSITIVE_KEYS = [
  'SMTP_PASSWORD',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'CLAUDE_API_KEY',
  'GOOGLE_CLIENT_SECRET',
  'JWT_SECRET',
];

export interface SiteConfigRecord {
  id: string;
  key: string;
  value: string;
  encrypted: boolean;
  category: string;
  label: string | null;
}

@Injectable()
export class ConfigAdminService {
  private logger = new Logger('ConfigAdminService');

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async getAll(): Promise<SiteConfigRecord[]> {
    const configs = await this.prisma.siteConfig.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    return configs.map((c) => ({
      ...c,
      value: SENSITIVE_KEYS.includes(c.key) ? this.maskValue(c.value) : c.value,
    }));
  }

  async getByCategory(category: string): Promise<SiteConfigRecord[]> {
    const configs = await this.prisma.siteConfig.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    return configs.map((c) => ({
      ...c,
      value: SENSITIVE_KEYS.includes(c.key) ? this.maskValue(c.value) : c.value,
    }));
  }

  async upsert(
    key: string,
    value: string,
    category?: string,
    label?: string,
    encrypted?: boolean,
  ) {
    return this.prisma.siteConfig.upsert({
      where: { key },
      update: {
        value,
        ...(category && { category }),
        ...(label && { label }),
        ...(encrypted !== undefined && { encrypted }),
      },
      create: {
        key,
        value,
        category: category || 'general',
        label: label || key,
        encrypted: encrypted || false,
      },
    });
  }

  async bulkUpsert(
    configs: Array<{
      key: string;
      value: string;
      category?: string;
      label?: string;
      encrypted?: boolean;
    }>,
  ) {
    const results = await Promise.all(
      configs.map((c) =>
        this.upsert(c.key, c.value, c.category, c.label, c.encrypted),
      ),
    );

    const smtpChanged = configs.some(
      (c) => c.category === 'smtp' || c.key.startsWith('SMTP_'),
    );
    if (smtpChanged) {
      await this.mailService.refreshTransporter();
      this.logger.log('SMTP transporter refreshed after config update');
    }

    return results;
  }

  async delete(key: string) {
    return this.prisma.siteConfig.delete({ where: { key } });
  }

  async testSmtp(to: string) {
    await this.mailService.refreshTransporter();
    return this.mailService.sendTestEmail(to);
  }

  async getEmailLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.emailLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.emailLog.count(),
    ]);
    return { logs, total, page, limit };
  }

  async promoteToAdmin(userId: string, setupKey: string) {
    const configuredKey = this.configService.get<string>('ADMIN_SETUP_KEY', '');

    if (!configuredKey) {
      throw new ForbiddenException(
        'Admin setup key not configured in environment',
      );
    }

    if (setupKey !== configuredKey) {
      throw new ForbiddenException('Invalid setup key');
    }

    const existingAdmin = await this.prisma.user.findFirst({
      where: { role: 'admin' },
    });

    if (existingAdmin) {
      throw new ForbiddenException(
        'An admin already exists. Use admin panel to promote users.',
      );
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: 'admin' },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  async getResolvedConfig(key: string): Promise<string> {
    const dbConfig = await this.prisma.siteConfig.findUnique({
      where: { key },
    });
    if (dbConfig) return dbConfig.value;
    return this.configService.get<string>(key, '');
  }

  private maskValue(value: string): string {
    if (!value || value.length <= 6) return '••••••';
    return (
      value.substring(0, 3) +
      '•'.repeat(Math.min(value.length - 6, 20)) +
      value.substring(value.length - 3)
    );
  }
}
