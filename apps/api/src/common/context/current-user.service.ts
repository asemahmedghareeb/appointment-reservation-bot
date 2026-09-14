import { Injectable } from '@nestjs/common';
import { prisma, UserRole } from '@visaflow/database';

export interface RequestActor {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class CurrentUserService {
  private defaultActor: RequestActor | null = null;

  async getActor(actorIdOverride?: string): Promise<RequestActor> {
    if (actorIdOverride) {
      const user = await prisma.user.findUnique({
        where: { id: actorIdOverride },
      });
      if (user) {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      }
    }

    if (this.defaultActor) {
      return this.defaultActor;
    }

    // Find any existing active user or initialize the default system actor
    let user = await prisma.user.findFirst({
      where: { active: true },
    });

    if (!user) {
      user = await prisma.user.upsert({
        where: { email: 'system@visaflow.internal' },
        update: {},
        create: {
          name: 'System Operator',
          email: 'system@visaflow.internal',
          passwordHash: 'not_used_phase1',
          role: UserRole.ADMIN,
          active: true,
        },
      });
    }

    this.defaultActor = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    return this.defaultActor;
  }
}
