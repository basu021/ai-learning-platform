import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class MailService {
  private transporter: Transporter | null = null;
  private logger = new Logger('MailService');

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    void this.initTransporter();
  }

  private async initTransporter() {
    const config = await this.getSmtpConfig();
    if (config.host && config.user && config.password) {
      this.transporter = nodemailer.createTransport({
        host: config.host as string,
        port: config.port as number,
        secure: config.secure as boolean,
        auth: {
          user: config.user as string,
          pass: config.password as string,
        },
      } as nodemailer.TransportOptions);
      this.logger.log(
        `Mail transporter initialized: ${config.host}:${config.port}`,
      );
    } else {
      this.logger.warn('SMTP not configured — emails will be logged only');
    }
  }

  async refreshTransporter() {
    this.transporter = null;
    await this.initTransporter();
  }

  private async getSmtpConfig() {
    const dbConfigs = await this.prisma.siteConfig
      .findMany({ where: { category: 'smtp' } })
      .catch(() => []);

    const dbMap = new Map(dbConfigs.map((c) => [c.key, c.value]));

    return {
      host:
        dbMap.get('SMTP_HOST') ||
        this.configService.get<string>('SMTP_HOST', ''),
      port: Number(
        dbMap.get('SMTP_PORT') ||
          this.configService.get<number>('SMTP_PORT', 465),
      ),
      secure:
        (dbMap.get('SMTP_SECURE') ||
          this.configService.get<string>('SMTP_SECURE', 'true')) === 'true',
      user:
        dbMap.get('SMTP_USER') ||
        this.configService.get<string>('SMTP_USER', ''),
      password:
        dbMap.get('SMTP_PASSWORD') ||
        this.configService.get<string>('SMTP_PASSWORD', ''),
      fromName:
        dbMap.get('SMTP_FROM_NAME') ||
        this.configService.get<string>('SMTP_FROM_NAME', 'SkillForge'),
      fromEmail:
        dbMap.get('SMTP_FROM_EMAIL') ||
        this.configService.get<string>('SMTP_FROM_EMAIL', ''),
    };
  }

  async sendMail(
    options: SendMailOptions,
  ): Promise<{ success: boolean; messageId?: string }> {
    const config = await this.getSmtpConfig();

    const logEntry = await this.prisma.emailLog.create({
      data: {
        to: options.to,
        subject: options.subject,
        status: 'pending',
        templateId: options.templateId,
        metadata: options.metadata ? JSON.stringify(options.metadata) : null,
      },
    });

    if (!this.transporter) {
      await this.refreshTransporter();
    }

    if (!this.transporter) {
      this.logger.warn(
        `Email not sent (SMTP not configured): ${options.subject} → ${options.to}`,
      );
      await this.prisma.emailLog.update({
        where: { id: logEntry.id },
        data: { status: 'failed', error: 'SMTP not configured' },
      });
      return { success: false };
    }

    try {
      const result = await this.transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      await this.prisma.emailLog.update({
        where: { id: logEntry.id },
        data: { status: 'sent' },
      });

      this.logger.log(`Email sent: ${options.subject} → ${options.to}`);
      return { success: true, messageId: result.messageId as string };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Email failed: ${errMsg}`);
      await this.prisma.emailLog.update({
        where: { id: logEntry.id },
        data: { status: 'failed', error: errMsg },
      });
      return { success: false };
    }
  }

  async sendWelcomeEmail(to: string, name: string) {
    return this.sendMail({
      to,
      subject: 'Welcome to SkillForge!',
      templateId: 'welcome',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="background: linear-gradient(to right, #818cf8, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">SkillForge</h1>
            <p style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">AI Learning Platform</p>
          </div>
          <h2 style="color: #e2e8f0;">Welcome, ${name}!</h2>
          <p style="color: #94a3b8; line-height: 1.6;">Your account has been created successfully. Start your learning journey by exploring subjects and generating AI-powered practice tasks.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/dashboard" style="background: linear-gradient(to right, #6366f1, #8b5cf6); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Go to Dashboard</a>
          </div>
          <p style="color: #64748b; font-size: 12px; text-align: center;">SkillForge — AI-Powered Technical Training</p>
        </div>
      `,
    });
  }

  async sendTaskReminderEmail(to: string, name: string, pendingCount: number) {
    return this.sendMail({
      to,
      subject: `You have ${pendingCount} tasks waiting — SkillForge`,
      templateId: 'task-reminder',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="background: linear-gradient(to right, #818cf8, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">SkillForge</h1>
          </div>
          <h2 style="color: #e2e8f0;">Hey ${name}, time to practice!</h2>
          <p style="color: #94a3b8; line-height: 1.6;">You have <strong style="color: #818cf8;">${pendingCount}</strong> pending tasks in your daily queue. Keep your streak alive!</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/tasks" style="background: linear-gradient(to right, #6366f1, #8b5cf6); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Tasks</a>
          </div>
          <p style="color: #64748b; font-size: 12px; text-align: center;">SkillForge — AI-Powered Technical Training</p>
        </div>
      `,
    });
  }

  async sendStreakMilestoneEmail(
    to: string,
    name: string,
    streakCount: number,
  ) {
    return this.sendMail({
      to,
      subject: `${streakCount}-day streak! — SkillForge`,
      templateId: 'streak-milestone',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="background: linear-gradient(to right, #818cf8, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">SkillForge</h1>
          </div>
          <h2 style="color: #e2e8f0; text-align: center;">Congratulations, ${name}!</h2>
          <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 48px;">🔥</span>
            <p style="color: #fbbf24; font-size: 24px; font-weight: bold;">${streakCount}-Day Streak!</p>
          </div>
          <p style="color: #94a3b8; line-height: 1.6; text-align: center;">Your consistency is paying off. Keep up the momentum!</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/dashboard" style="background: linear-gradient(to right, #6366f1, #8b5cf6); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Continue Learning</a>
          </div>
          <p style="color: #64748b; font-size: 12px; text-align: center;">SkillForge — AI-Powered Technical Training</p>
        </div>
      `,
    });
  }

  async sendTestEmail(to: string) {
    return this.sendMail({
      to,
      subject: 'SkillForge — SMTP Test Email',
      templateId: 'test',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="background: linear-gradient(to right, #818cf8, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">SkillForge</h1>
          </div>
          <h2 style="color: #e2e8f0; text-align: center;">SMTP Configuration Test</h2>
          <p style="color: #22c55e; text-align: center; font-size: 18px;">If you receive this email, your SMTP settings are working correctly!</p>
          <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 30px;">Sent at ${new Date().toISOString()}</p>
        </div>
      `,
    });
  }
}
