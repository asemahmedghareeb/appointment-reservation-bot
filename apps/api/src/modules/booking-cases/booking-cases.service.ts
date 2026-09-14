import { Injectable } from '@nestjs/common';
import { BookingCasesRepository, type FullBookingCase } from './booking-cases.repository.js';
import { ProviderRoutesRepository } from '../provider-routes/provider-routes.repository.js';
import { ApplicantsRepository } from '../applicants/applicants.repository.js';
import { CaseNumberService } from './case-number.service.js';
import { CaseReadinessService } from './case-readiness.service.js';
import { CurrentUserService } from '../../common/context/current-user.service.js';
import { BookingCaseNotFoundError } from './errors/booking-case-not-found.error.js';
import { BookingCaseNotDraftError } from './errors/booking-case-not-draft.error.js';
import { ApplicantAlreadyLinkedError } from './errors/applicant-already-linked.error.js';
import { InvalidPrimaryApplicantError } from './errors/invalid-primary-applicant.error.js';
import { InvalidApplicantPositionError } from './errors/invalid-applicant-position.error.js';
import { ProviderRouteNotFoundError } from '../provider-routes/errors/provider-route-not-found.error.js';
import { ProviderRouteDisabledError } from '../provider-routes/errors/provider-route-disabled.error.js';
import { ApplicantNotFoundError } from '../applicants/errors/applicant-not-found.error.js';
import { normalizePagination, createPaginatedResult } from '../../common/utils/pagination.js';
import { decrypt, maskPassportNumber } from '@visaflow/crypto';
import {
  BookingCaseStatus,
  type BookingMode,
  type ProviderCode,
  type Gender,
  type ApplicantRelation,
  type PaginatedResult,
} from '@visaflow/shared-types';
import type { CreateBookingCaseDto } from './dto/create-booking-case.dto.js';
import type { UpdateBookingCaseDto } from './dto/update-booking-case.dto.js';
import type { ListBookingCasesQueryDto } from './dto/list-booking-cases-query.dto.js';
import type { AddBookingApplicantDto } from './dto/add-booking-applicant.dto.js';
import type { ReorderBookingApplicantsDto } from './dto/reorder-booking-applicants.dto.js';
import type { MarkCaseReadyDto } from './dto/mark-case-ready.dto.js';
import type { BookingCaseResponseDto, BookingApplicantDetailDto } from './dto/booking-case-response.dto.js';
import type { Prisma } from '@visaflow/database';

@Injectable()
export class BookingCasesService {
  constructor(
    private readonly bookingCasesRepo: BookingCasesRepository,
    private readonly providerRoutesRepo: ProviderRoutesRepository,
    private readonly applicantsRepo: ApplicantsRepository,
    private readonly caseNumberService: CaseNumberService,
    private readonly caseReadinessService: CaseReadinessService,
    private readonly currentUserService: CurrentUserService,
  ) {}

  async create(
    dto: CreateBookingCaseDto,
    creatorIdOverride?: string,
  ): Promise<BookingCaseResponseDto> {
    const route = await this.providerRoutesRepo.findById(dto.providerRouteId);
    if (!route) {
      throw new ProviderRouteNotFoundError(dto.providerRouteId);
    }
    if (!route.enabled) {
      throw new ProviderRouteDisabledError(dto.providerRouteId);
    }

    const actor = await this.currentUserService.getActor(creatorIdOverride);
    const caseNumber = this.caseNumberService.generate();

    const createdCase = await this.bookingCasesRepo.create({
      caseNumber,
      providerRoute: { connect: { id: route.id } },
      status: BookingCaseStatus.DRAFT,
      bookingMode: route.bookingMode,
      preferredDateFrom: dto.preferredDateFrom ? new Date(dto.preferredDateFrom) : null,
      preferredDateTo: dto.preferredDateTo ? new Date(dto.preferredDateTo) : null,
      preferredTime: dto.preferredTime ?? null,
      allowGroupSplit: dto.allowGroupSplit ?? false,
      createdBy: { connect: { id: actor.id } },
    });

    return this.mapToResponse(createdCase);
  }

  async findById(id: string): Promise<BookingCaseResponseDto> {
    const bookingCase = await this.bookingCasesRepo.findById(id);
    if (!bookingCase) {
      throw new BookingCaseNotFoundError(id);
    }
    return this.mapToResponse(bookingCase);
  }

  async list(query: ListBookingCasesQueryDto): Promise<PaginatedResult<BookingCaseResponseDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);

    const where: Prisma.BookingCaseWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.createdBy) where.createdById = query.createdBy;
    if (query.search) {
      where.caseNumber = { contains: query.search.trim(), mode: 'insensitive' };
    }

    if (query.provider || query.sourceCountry || query.destinationCountry) {
      where.providerRoute = {
        ...(query.provider ? { provider: { code: query.provider } } : {}),
        ...(query.sourceCountry ? { sourceCountry: query.sourceCountry } : {}),
        ...(query.destinationCountry ? { destinationCountry: query.destinationCountry } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.bookingCasesRepo.findMany({ skip, take: limit, where }),
      this.bookingCasesRepo.count(where),
    ]);

    return createPaginatedResult(
      items.map((c) => this.mapToResponse(c)),
      total,
      page,
      limit,
    );
  }

  async update(id: string, dto: UpdateBookingCaseDto): Promise<BookingCaseResponseDto> {
    const existing = await this.getCaseOrThrow(id);
    this.assertIsDraft(existing);

    const data: Prisma.BookingCaseUpdateInput = {};

    if (dto.providerRouteId && dto.providerRouteId !== existing.providerRouteId) {
      const newRoute = await this.providerRoutesRepo.findById(dto.providerRouteId);
      if (!newRoute) {
        throw new ProviderRouteNotFoundError(dto.providerRouteId);
      }
      if (!newRoute.enabled) {
        throw new ProviderRouteDisabledError(dto.providerRouteId);
      }

      data.providerRoute = { connect: { id: newRoute.id } };
      data.bookingMode = newRoute.bookingMode;
    }

    if (dto.preferredDateFrom !== undefined) {
      data.preferredDateFrom = dto.preferredDateFrom ? new Date(dto.preferredDateFrom) : null;
    }
    if (dto.preferredDateTo !== undefined) {
      data.preferredDateTo = dto.preferredDateTo ? new Date(dto.preferredDateTo) : null;
    }
    if (dto.preferredTime !== undefined) {
      data.preferredTime = dto.preferredTime;
    }
    if (dto.allowGroupSplit !== undefined) {
      data.allowGroupSplit = dto.allowGroupSplit;
    }

    const updated = await this.bookingCasesRepo.update(id, data);
    return this.mapToResponse(updated);
  }

  async addApplicant(
    caseId: string,
    dto: AddBookingApplicantDto,
  ): Promise<BookingCaseResponseDto> {
    const bookingCase = await this.getCaseOrThrow(caseId);
    this.assertIsDraft(bookingCase);

    const applicant = await this.applicantsRepo.findById(dto.applicantId);
    if (!applicant) {
      throw new ApplicantNotFoundError(dto.applicantId);
    }

    const alreadyLinked = await this.bookingCasesRepo.findApplicantLink(caseId, dto.applicantId);
    if (alreadyLinked) {
      throw new ApplicantAlreadyLinkedError(caseId, dto.applicantId);
    }

    const existingPositions = bookingCase.bookingApplicants.map((a) => a.position);

    let position = dto.position;
    if (position !== undefined) {
      if (position <= 0) {
        throw new InvalidApplicantPositionError(caseId, 'Position must be a positive integer >= 1.');
      }
      if (existingPositions.includes(position)) {
        throw new InvalidApplicantPositionError(
          caseId,
          `Position ${position} is already assigned to another applicant in this case.`,
        );
      }
    } else {
      const maxPosition = existingPositions.length > 0 ? Math.max(...existingPositions) : 0;
      position = maxPosition + 1;
    }

    const isPrimary = dto.isPrimary ?? false;

    await this.bookingCasesRepo.addApplicant(
      {
        bookingCase: { connect: { id: caseId } },
        applicant: { connect: { id: dto.applicantId } },
        position,
        relation: dto.relation,
        isPrimary,
      },
      isPrimary, // if setting primary, atomically unset other primaries
    );

    const refreshed = await this.getCaseOrThrow(caseId);
    return this.mapToResponse(refreshed);
  }

  async setPrimaryApplicant(
    caseId: string,
    bookingApplicantId: string,
  ): Promise<BookingCaseResponseDto> {
    const bookingCase = await this.getCaseOrThrow(caseId);
    this.assertIsDraft(bookingCase);

    const targetApplicant = bookingCase.bookingApplicants.find((a) => a.id === bookingApplicantId);
    if (!targetApplicant) {
      throw new InvalidPrimaryApplicantError(
        caseId,
        `Booking applicant link '${bookingApplicantId}' does not exist in this case.`,
      );
    }

    await this.bookingCasesRepo.setPrimaryApplicant(caseId, bookingApplicantId);

    const refreshed = await this.getCaseOrThrow(caseId);
    return this.mapToResponse(refreshed);
  }

  async reorderApplicants(
    caseId: string,
    dto: ReorderBookingApplicantsDto,
  ): Promise<BookingCaseResponseDto> {
    const bookingCase = await this.getCaseOrThrow(caseId);
    this.assertIsDraft(bookingCase);

    const currentApplicants = bookingCase.bookingApplicants;
    const currentIds = new Set(currentApplicants.map((a) => a.id));

    if (dto.items.length !== currentApplicants.length) {
      throw new InvalidApplicantPositionError(
        caseId,
        `Reorder list length (${dto.items.length}) must match the total number of linked applicants (${currentApplicants.length}).`,
      );
    }

    const reorderedIds = new Set<string>();
    const reorderedPositions = new Set<number>();

    for (const item of dto.items) {
      if (!currentIds.has(item.bookingApplicantId)) {
        throw new InvalidApplicantPositionError(
          caseId,
          `Applicant '${item.bookingApplicantId}' does not belong to case '${caseId}'.`,
        );
      }
      if (reorderedIds.has(item.bookingApplicantId)) {
        throw new InvalidApplicantPositionError(
          caseId,
          `Duplicate applicant '${item.bookingApplicantId}' in reorder payload.`,
        );
      }
      if (item.position <= 0) {
        throw new InvalidApplicantPositionError(caseId, 'Position must be a positive integer >= 1.');
      }
      if (reorderedPositions.has(item.position)) {
        throw new InvalidApplicantPositionError(
          caseId,
          `Duplicate position ${item.position} in reorder payload.`,
        );
      }

      reorderedIds.add(item.bookingApplicantId);
      reorderedPositions.add(item.position);
    }

    await this.bookingCasesRepo.reorderApplicants(caseId, dto.items);

    const refreshed = await this.getCaseOrThrow(caseId);
    return this.mapToResponse(refreshed);
  }

  async removeApplicant(
    caseId: string,
    bookingApplicantId: string,
  ): Promise<BookingCaseResponseDto> {
    const bookingCase = await this.getCaseOrThrow(caseId);
    this.assertIsDraft(bookingCase);

    const targetApplicant = bookingCase.bookingApplicants.find((a) => a.id === bookingApplicantId);
    if (!targetApplicant) {
      throw new InvalidApplicantPositionError(
        caseId,
        `Booking applicant link '${bookingApplicantId}' does not exist in this case.`,
      );
    }

    await this.bookingCasesRepo.removeApplicant(bookingApplicantId);

    const refreshed = await this.getCaseOrThrow(caseId);
    return this.mapToResponse(refreshed);
  }

  async markReady(
    caseId: string,
    dto?: MarkCaseReadyDto,
    actorIdOverride?: string,
  ): Promise<BookingCaseResponseDto> {
    const bookingCase = await this.getCaseOrThrow(caseId);

    // Validate all 10 readiness rules before any state mutation
    this.caseReadinessService.validateCaseReadiness(bookingCase);

    const actor = await this.currentUserService.getActor(actorIdOverride);

    const transitionParams: { caseId: string; actorId?: string; reason?: string } = {
      caseId,
      actorId: actor.id,
    };
    if (dto?.reason) {
      transitionParams.reason = dto.reason;
    }

    const updatedCase = await this.bookingCasesRepo.transitionToReady(transitionParams);

    return this.mapToResponse(updatedCase);
  }

  private async getCaseOrThrow(id: string): Promise<FullBookingCase> {
    const bookingCase = await this.bookingCasesRepo.findById(id);
    if (!bookingCase) {
      throw new BookingCaseNotFoundError(id);
    }
    return bookingCase;
  }

  private assertIsDraft(bookingCase: FullBookingCase): void {
    if (bookingCase.status !== BookingCaseStatus.DRAFT) {
      throw new BookingCaseNotDraftError(bookingCase.id, bookingCase.status);
    }
  }

  private mapToResponse(bookingCase: FullBookingCase): BookingCaseResponseDto {
    const applicants: BookingApplicantDetailDto[] = bookingCase.bookingApplicants.map((ba) => {
      let plainPassport: string;
      try {
        plainPassport = decrypt(ba.applicant.passportNumberEncrypted);
      } catch {
        plainPassport = 'UNKNOWN';
      }

      return {
        id: ba.id,
        applicantId: ba.applicantId,
        firstName: ba.applicant.firstName,
        lastName: ba.applicant.lastName,
        gender: ba.applicant.gender as Gender,
        dateOfBirth: ba.applicant.dateOfBirth,
        nationality: ba.applicant.nationality,
        passportMasked: maskPassportNumber(plainPassport),
        passportExpiry: ba.applicant.passportExpiry,
        position: ba.position,
        relation: ba.relation as ApplicantRelation,
        isPrimary: ba.isPrimary,
      };
    });

    const primaryApplicant = applicants.find((a) => a.isPrimary);

    return {
      id: bookingCase.id,
      caseNumber: bookingCase.caseNumber,
      status: bookingCase.status as BookingCaseStatus,
      bookingMode: bookingCase.bookingMode as BookingMode,
      preferredDateFrom: bookingCase.preferredDateFrom,
      preferredDateTo: bookingCase.preferredDateTo,
      preferredTime: bookingCase.preferredTime,
      allowGroupSplit: bookingCase.allowGroupSplit,
      createdById: bookingCase.createdById,
      createdAt: bookingCase.createdAt,
      updatedAt: bookingCase.updatedAt,
      providerRoute: {
        id: bookingCase.providerRoute.id,
        providerCode: bookingCase.providerRoute.provider.code as ProviderCode,
        providerName: bookingCase.providerRoute.provider.name,
        sourceCountry: bookingCase.providerRoute.sourceCountry,
        destinationCountry: bookingCase.providerRoute.destinationCountry,
        applicationCentre: bookingCase.providerRoute.applicationCentre,
        visaCategory: bookingCase.providerRoute.visaCategory,
        visaSubcategory: bookingCase.providerRoute.visaSubcategory,
      },
      applicants,
      applicantCount: applicants.length,
      primaryApplicantId: primaryApplicant ? primaryApplicant.applicantId : null,
    };
  }
}
