import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSubtopicDto,
  UpdateSubtopicDto,
} from './dto/create-subtopic.dto';

@Injectable()
export class SubtopicsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateSubtopicDto) {
    await this.verifyTopicOwnership(dto.topicId, userId);
    return this.prisma.subtopic.create({
      data: dto,
      include: { topic: true },
    });
  }

  async findByTopic(topicId: string, userId: string) {
    await this.verifyTopicOwnership(topicId, userId);
    return this.prisma.subtopic.findMany({
      where: { topicId, deletedAt: null },
      include: { _count: { select: { tasks: true } } },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const subtopic = await this.prisma.subtopic.findFirst({
      where: { id, deletedAt: null, topic: { subject: { userId } } },
      include: {
        topic: { include: { subject: true } },
        tasks: {
          where: { deletedAt: null },
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!subtopic) throw new NotFoundException('Subtopic not found');
    return subtopic;
  }

  async update(id: string, userId: string, dto: UpdateSubtopicDto) {
    await this.findOne(id, userId);
    return this.prisma.subtopic.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.subtopic.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async verifyTopicOwnership(topicId: string, userId: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, deletedAt: null, subject: { userId } },
    });
    if (!topic) throw new NotFoundException('Topic not found');
  }
}
