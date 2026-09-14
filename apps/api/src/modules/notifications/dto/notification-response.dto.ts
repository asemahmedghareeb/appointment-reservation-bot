import type { NotificationDto } from '@visaflow/shared-types';

export class NotificationResponseDto implements NotificationDto {
  id!: string;
  userId?: string | null;
  bookingCaseId?: string | null;
  type!: string;
  title!: string;
  message!: string;
  readAt?: string | null;
  createdAt!: string;
}
