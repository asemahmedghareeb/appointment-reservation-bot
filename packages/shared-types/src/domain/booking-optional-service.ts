export interface BookingOptionalService {
  providerServiceCode?: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  selected: boolean;
}
