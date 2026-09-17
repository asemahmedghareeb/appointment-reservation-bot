export const LOGIN_SELECTORS = {
  heading: 'Sign In',
  emailInput: 'input[formcontrolname="username"], input[name="email"], input[type="email"], input[placeholder*="@"], input[id*="email"], input[id*="mat-input-0"]',
  passwordInput: 'input[formcontrolname="password"], input[name="password"], input[type="password"], input[id*="password"], input[id*="mat-input-1"]',
  submitButton: 'button[type="submit"], button:has-text("Sign In")',
} as const;
