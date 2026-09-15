export const LOGIN_SELECTORS = {
  heading: 'Sign In',
  emailInput: 'input[name="email"], input[type="email"], #email',
  passwordInput: 'input[name="password"], input[type="password"], #password',
  submitButton: 'button[type="submit"], button:has-text("Sign In")',
} as const;
