export const APPLICANT_SELECTORS = {
  applicantDetails: {
    heading: 'Your Details',
    firstName: 'input[formcontrolname="firstName"], input[name="firstName"], input[placeholder*="first name" i], input[id*="first" i]',
    lastName: 'input[formcontrolname="lastName"], input[name="lastName"], input[placeholder*="last name" i], input[id*="last" i]',
    genderSelect: 'mat-select[formcontrolname*="gender" i], mat-select[id*="gender" i], select[name="gender"], [role="combobox"][aria-label*="gender" i]',
    dateOfBirth: 'input[formcontrolname*="dateOfBirth" i], input[formcontrolname*="dob" i], input[placeholder*="birth" i], input[placeholder*="DD/MM/YYYY" i], input[id*="dob" i]',
    nationality: 'mat-select[formcontrolname*="nationality" i], select[formcontrolname*="nationality" i], mat-select[id*="nationality" i], select[name="nationality"]',
    passportNumber: 'input[formcontrolname*="passportNumber" i], input[formcontrolname*="passport" i], input[name="passportNumber"], input[placeholder*="passport" i]',
    passportExpiry: 'input[formcontrolname*="passportExpiry" i], input[formcontrolname*="passportExpir" i], input[name="passportExpiry"], input[placeholder*="expiry" i]',
    contactNumber: 'input[formcontrolname*="contactNumber" i], input[formcontrolname*="phone" i], input[name="contactNumber"], input[placeholder*="contact" i], input[placeholder*="number" i]',
    phoneCountryCode: 'input[formcontrolname*="phoneCode" i], input[formcontrolname*="countryCode" i], input[name="phoneCountryCode"], input[placeholder*="code" i]',
    email: 'input[formcontrolname*="email" i], input[type="email"], input[name="email"], input[placeholder*="email" i]',
    saveApplicantButton: 'button:has-text("Save"), button:has-text("Add Applicant"), button:has-text("Continue"), button.mat-raised-button, button[type="submit"]',
    continueButton: 'button:has-text("Continue"), button:has-text("Review Details"), button:has-text("Save"), button.mat-raised-button, button[type="submit"]',
  },
} as const;
