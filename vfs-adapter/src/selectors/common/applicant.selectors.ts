export const APPLICANT_SELECTORS = {
  applicantDetails: {
    heading: 'Applicant Details',
    firstName: 'input[name="firstName"]',
    lastName: 'input[name="lastName"]',
    genderSelect: 'select[name="gender"]',
    dateOfBirth: 'input[name="dateOfBirth"]',
    nationality: 'input[name="nationality"], select[name="nationality"]',
    passportNumber: 'input[name="passportNumber"]',
    passportExpiry: 'input[name="passportExpiry"]',
    contactNumber: 'input[name="contactNumber"], input[formcontrolname="contactNumber"]',
    phoneCountryCode: 'input[name="phoneCountryCode"], input[name="countryCode"], input[formcontrolname="phoneCode"], select[name="countryCode"]',
    email: 'input[name="email"], input[formcontrolname="email"]',
    saveApplicantButton: 'button:has-text("Save"), button:has-text("Add Applicant")',
    continueButton: 'button:has-text("Continue"), button:has-text("Review Details")',
  },
} as const;
