import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSubtopicDto,
  UpdateSubtopicDto,
} from './dto/create-subtopic.dto';

@Injectable()
export class SubtopicsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSubtopicDto) {
    return this.prisma.subtopic.create({
      data: dto,
      include: { topic: true },
    });
  }

  async findByTopic(topicId: string) {
    return this.prisma.subtopic.findMany({
      where: { topicId, deletedAt: null },
      include: { _count: { select: { tasks: true } } },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const subtopic = await this.prisma.subtopic.findFirst({
      where: { id, deletedAt: null },
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

  async update(id: string, dto: UpdateSubtopicDto) {
    await this.findOne(id);
    return this.prisma.subtopic.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.subtopic.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
