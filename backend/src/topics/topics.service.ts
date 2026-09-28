import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTopicDto, UpdateTopicDto } from './dto/create-topic.dto';

@Injectable()
export class TopicsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTopicDto) {
    await this.verifySubjectOwnership(dto.subjectId, userId);
    return this.prisma.topic.create({
      data: dto,
      include: { subtopics: true },
    });
  }

  async findBySubject(subjectId: string, userId: string) {
    await this.verifySubjectOwnership(subjectId, userId);
    return this.prisma.topic.findMany({
      where: { subjectId, deletedAt: null },
      include: {
        subtopics: { where: { deletedAt: null } },
      },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id, deletedAt: null, subject: { userId } },
      include: {
        subtopics: {
          where: { deletedAt: null },
          include: { _count: { select: { tasks: true } } },
        },
        subject: true,
      },
    });
    if (!topic) throw new NotFoundException('Topic not found');
    return topic;
  }

  async update(id: string, userId: string, dto: UpdateTopicDto) {
    await this.findOne(id, userId);
    return this.prisma.topic.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.topic.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async verifySubjectOwnership(subjectId: string, userId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, userId, deletedAt: null },
    });
    if (!subject) throw new NotFoundException('Subject not found');
  }
}
