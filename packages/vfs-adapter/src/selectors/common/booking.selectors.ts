export const BOOKING_SELECTORS = {
  bookingHome: {
    heading: 'Dashboard',
    startNewBookingButton:
      'button:has-text("Start New Booking"), a:has-text("Start New Booking"), button:has-text("New Booking")',
  },
  appointmentDetails: {
    heading: 'Appointment Details',
    centreSelect: 'select[name="centre"], #applicationCentre',
    categorySelect: 'select[name="category"], #visaCategory',
    subcategorySelect: 'select[name="subcategory"], #visaSubcategory',
    continueButton: 'button:has-text("Continue"), button:has-text("Next")',
  },
  payment: {
    heading: 'Payment Details',
    amount: '.payment-amount, [data-testid="payment-amount"]',
    currency: '.payment-currency, [data-testid="payment-currency"]',
    externalReference: '.payment-reference, [data-testid="payment-reference"]',
    payButton: 'button:has-text("Pay"), button:has-text("Complete Payment")',
  },
  confirmation: {
    heading: 'Appointment Confirmation',
    referenceNumber: '.confirmation-number, [data-testid="booking-reference"], .booking-ref',
  },
  humanVerification: {
    captchaContainer:
      '.g-recaptcha, .h-captcha, .cf-turnstile, [data-testid="captcha-container"], #captcha',
    otpContainer: '.otp-form, [data-testid="otp-container"], input[name="otp"]',
    manualVerification: '.manual-verification, [data-testid="manual-verification"]',
  },
} as const;
