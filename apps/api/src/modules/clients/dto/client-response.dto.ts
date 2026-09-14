export class ClientResponseDto {
  id!: string;
  fullName!: string;
  phone!: string | null;
  email!: string | null;
  createdById!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
