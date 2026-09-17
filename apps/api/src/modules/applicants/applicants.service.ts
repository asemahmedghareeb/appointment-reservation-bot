import { Injectable } from '@nestjs/common';
import { ApplicantsRepository } from './applicants.repository.js';
import {
  normalizePassportNumber,
  createPassportLookupHash,
  encrypt,
  decrypt,
  maskPassportNumber,
} from '@visaflow/crypto';
import { ApplicantAlreadyExistsError } from './errors/applicant-already-exists.error.js';
import { ApplicantNotFoundError } from './errors/applicant-not-found.error.js';
import { ApplicantLinkedToCasesError } from './errors/applicant-linked-to-cases.error.js';
import { normalizePagination, createPaginatedResult } from '../../common/utils/pagination.js';
import type { CreateApplicantDto } from './dto/create-applicant.dto.js';
import type { UpdateApplicantDto } from './dto/update-applicant.dto.js';
import type { ListApplicantsQueryDto } from './dto/list-applicants-query.dto.js';
import type { FindApplicantByPassportDto } from './dto/find-applicant-by-passport.dto.js';
import type { ApplicantResponseDto } from './dto/applicant-response.dto.js';
import type { PaginatedResult, Gender } from '@visaflow/shared-types';
import type { Applicant, Prisma } from '@visaflow/database';

@Injectable()
export class ApplicantsService {
  constructor(private readonly applicantsRepo: ApplicantsRepository) {}

  async create(dto: CreateApplicantDto): Promise<ApplicantResponseDto> {
    // 1. Normalize raw passport input
    const normalizedPassport = normalizePassportNumber(dto.passportNumber);

    // 2. Deterministic HMAC lookup digest
    const passportHash = createPassportLookupHash(normalizedPassport);

    // 3. Duplicate detection by hash
    const existing = await this.applicantsRepo.findByPassportHash(passportHash);
    if (existing) {
      throw new ApplicantAlreadyExistsError(existing.id);
    }

    // 4. Encrypt normalized passport using AES-256-GCM
    const passportEncrypted = encrypt(normalizedPassport);

    // 5. Persist applicant
    const applicant = await this.applicantsRepo.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      gender: dto.gender,
      dateOfBirth: new Date(dto.dateOfBirth),
      nationality: dto.nationality,
      phone: dto.phone ?? (dto.phoneCountryCode && dto.phoneNumber ? `${dto.phoneCountryCode}${dto.phoneNumber}` : null),
      phoneCountryCode: dto.phoneCountryCode ?? null,
      phoneNumber: dto.phoneNumber ?? null,
      email: dto.email ?? null,
      passportNumberEncrypted: passportEncrypted,
      passportNumberHash: passportHash,
      passportExpiry: new Date(dto.passportExpiry),
      ...(dto.clientId
        ? { client: { connect: { id: dto.clientId } } }
        : {}),
    });

    return this.mapToResponse(applicant);
  }

  async findById(id: string): Promise<ApplicantResponseDto> {
    const applicant = await this.applicantsRepo.findById(id);
    if (!applicant) {
      throw new ApplicantNotFoundError(id);
    }
    return this.mapToResponse(applicant);
  }

  async findByPassport(dto: FindApplicantByPassportDto): Promise<ApplicantResponseDto> {
    const normalized = normalizePassportNumber(dto.passportNumber);
    const hash = createPassportLookupHash(normalized);

    const applicant = await this.applicantsRepo.findByPassportHash(hash);
    if (!applicant) {
      throw new ApplicantNotFoundError('lookup-by-passport');
    }

    return this.mapToResponse(applicant);
  }

  async list(query: ListApplicantsQueryDto): Promise<PaginatedResult<ApplicantResponseDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);

    const where: Prisma.ApplicantWhereInput = {};

    if (query.clientId) {
      where.clientId = query.clientId;
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { nationality: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.applicantsRepo.findMany({ skip, take: limit, where }),
      this.applicantsRepo.count(where),
    ]);

    return createPaginatedResult(
      items.map((a) => this.mapToResponse(a)),
      total,
      page,
      limit,
    );
  }

  async update(id: string, dto: UpdateApplicantDto): Promise<ApplicantResponseDto> {
    await this.findById(id);

    const data: Prisma.ApplicantUpdateInput = {};

    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.dateOfBirth !== undefined) data.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.nationality !== undefined) data.nationality = dto.nationality;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.phoneCountryCode !== undefined) data.phoneCountryCode = dto.phoneCountryCode;
    if (dto.phoneNumber !== undefined) data.phoneNumber = dto.phoneNumber;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.passportExpiry !== undefined) data.passportExpiry = new Date(dto.passportExpiry);
    if (dto.clientId !== undefined) {
      if (dto.clientId === null || dto.clientId === '') {
        data.client = { disconnect: true };
      } else {
        data.client = { connect: { id: dto.clientId } };
      }
    }

    if (dto.passportNumber) {
      const normalized = normalizePassportNumber(dto.passportNumber);
      const newHash = createPassportLookupHash(normalized);

      // Check if duplicate belongs to another applicant
      const existing = await this.applicantsRepo.findByPassportHash(newHash);
      if (existing && existing.id !== id) {
        throw new ApplicantAlreadyExistsError(existing.id);
      }

      data.passportNumberEncrypted = encrypt(normalized);
      data.passportNumberHash = newHash;
    }

    const updated = await this.applicantsRepo.update(id, data);
    return this.mapToResponse(updated);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    const linkedCasesCount = await this.applicantsRepo.countLinkedCases(id);
    if (linkedCasesCount > 0) {
      throw new ApplicantLinkedToCasesError(id, linkedCasesCount);
    }

    await this.applicantsRepo.delete(id);
  }

  mapToResponse(applicant: Applicant): ApplicantResponseDto {
    let plainPassport: string;
    try {
      plainPassport = decrypt(applicant.passportNumberEncrypted);
    } catch {
      plainPassport = 'UNKNOWN';
    }

    const passportMasked = maskPassportNumber(plainPassport);

    return {
      id: applicant.id,
      clientId: applicant.clientId,
      firstName: applicant.firstName,
      lastName: applicant.lastName,
      gender: applicant.gender as unknown as Gender,
      dateOfBirth: applicant.dateOfBirth,
      nationality: applicant.nationality,
      phone: applicant.phone,
      phoneCountryCode: (applicant as any).phoneCountryCode ?? null,
      phoneNumber: (applicant as any).phoneNumber ?? null,
      email: applicant.email,
      passportMasked,
      passportExpiry: applicant.passportExpiry,
      createdAt: applicant.createdAt,
      updatedAt: applicant.updatedAt,
    };
  }
}
