import { Injectable } from '@nestjs/common';
import { prisma, type Applicant, type Prisma } from '@visaflow/database';

@Injectable()
export class ApplicantsRepository {
  async findByPassportHash(passportNumberHash: string): Promise<Applicant | null> {
    return prisma.applicant.findUnique({
      where: { passportNumberHash },
    });
  }

  async findById(id: string): Promise<Applicant | null> {
    return prisma.applicant.findUnique({
      where: { id },
    });
  }

  async findMany(params: {
    skip: number;
    take: number;
    where?: Prisma.ApplicantWhereInput;
    orderBy?: Prisma.ApplicantOrderByWithRelationInput;
  }): Promise<Applicant[]> {
    const args: Prisma.ApplicantFindManyArgs = {
      skip: params.skip,
      take: params.take,
      orderBy: params.orderBy ?? { createdAt: 'desc' },
    };
    if (params.where) {
      args.where = params.where;
    }
    return prisma.applicant.findMany(args);
  }

  async count(where?: Prisma.ApplicantWhereInput): Promise<number> {
    if (where) {
      return prisma.applicant.count({ where });
    }
    return prisma.applicant.count();
  }

  async create(data: Prisma.ApplicantCreateInput): Promise<Applicant> {
    return prisma.applicant.create({ data });
  }

  async update(id: string, data: Prisma.ApplicantUpdateInput): Promise<Applicant> {
    return prisma.applicant.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Applicant> {
    return prisma.applicant.delete({
      where: { id },
    });
  }

  async countLinkedCases(applicantId: string): Promise<number> {
    return prisma.bookingApplicant.count({
      where: { applicantId },
    });
  }
}
