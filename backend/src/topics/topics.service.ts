import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTopicDto, UpdateTopicDto } from './dto/create-topic.dto';

@Injectable()
export class TopicsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTopicDto) {
    return this.prisma.topic.create({
      data: dto,
      include: { subtopics: true },
    });
  }

  async findBySubject(subjectId: string) {
    return this.prisma.topic.findMany({
      where: { subjectId, deletedAt: null },
      include: {
        subtopics: { where: { deletedAt: null } },
      },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id, deletedAt: null },
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

  async update(id: string, dto: UpdateTopicDto) {
    await this.findOne(id);
    return this.prisma.topic.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.topic.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
