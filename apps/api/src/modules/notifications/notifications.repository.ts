import { Injectable } from '@nestjs/common';
import { prisma, type Notification, type Prisma } from '@visaflow/database';

@Injectable()
export class NotificationsRepository {
  async create(data: {
    userId?: string | null;
    bookingCaseId?: string | null;
    type: string;
    title: string;
    message: string;
  }): Promise<Notification> {
    return prisma.notification.create({
      data: {
        userId: data.userId ?? null,
        bookingCaseId: data.bookingCaseId ?? null,
        type: data.type,
        title: data.title,
        message: data.message,
      },
    });
  }

  async findById(id: string): Promise<Notification | null> {
    return prisma.notification.findUnique({
      where: { id },
    });
  }

  async findMany(params: {
    skip: number;
    take: number;
    unreadOnly?: boolean | undefined;
    userId?: string | undefined;
    bookingCaseId?: string | undefined;
  }): Promise<Notification[]> {
    const where: Prisma.NotificationWhereInput = {};
    if (params.unreadOnly) {
      where.readAt = null;
    }
    if (params.userId) {
      where.userId = params.userId;
    }
    if (params.bookingCaseId) {
      where.bookingCaseId = params.bookingCaseId;
    }

    return prisma.notification.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async count(params: {
    unreadOnly?: boolean | undefined;
    userId?: string | undefined;
    bookingCaseId?: string | undefined;
  }): Promise<number> {

    const where: Prisma.NotificationWhereInput = {};
    if (params.unreadOnly) {
      where.readAt = null;
    }
    if (params.userId) {
      where.userId = params.userId;
    }
    if (params.bookingCaseId) {
      where.bookingCaseId = params.bookingCaseId;
    }

    return prisma.notification.count({ where });
  }

  async markAsRead(id: string): Promise<Notification> {
    return prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId?: string, bookingCaseId?: string): Promise<number> {
    const where: Prisma.NotificationWhereInput = {
      readAt: null,
    };
    if (userId) {
      where.userId = userId;
    }
    if (bookingCaseId) {
      where.bookingCaseId = bookingCaseId;
    }

    const res = await prisma.notification.updateMany({
      where,
      data: { readAt: new Date() },
    });

    return res.count;
  }
}
