import { expect, type Page } from '@playwright/test';

export async function gotoLogin(page: Page): Promise<void> {
  await page.goto('/#/login');
  await expect(page.getByRole('button', { name: /Try Demo Account/i })).toBeVisible();
}

export async function expectDashboardLoaded(page: Page): Promise<void> {
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByText('Portfolio Value')).toBeVisible();
}

export async function loginWithDemo(page: Page): Promise<void> {
  await gotoLogin(page);
  await page.getByRole('button', { name: /Try Demo Account/i }).click();
  await expectDashboardLoaded(page);
}

export async function logoutFromMobileMenu(page: Page): Promise<void> {
  // First button in mobile header is the menu toggle.
  await page.locator('header button').first().click();
  await page.getByRole('button', { name: /Logout/i }).click();
  await expect(page).toHaveURL(/#\/login$/);
}

export async function registerViaForm(
  page: Page,
  creds: { username: string; email: string; password: string }
): Promise<void> {
  await gotoLogin(page);
  await page.getByRole('button', { name: /^Register$/ }).click();
  await page.getByLabel('Username').fill(creds.username);
  await page.getByLabel('Email').fill(creds.email);
  await page.getByLabel('Password').fill(creds.password);
  await page.getByRole('button', { name: /Create Account/i }).click();
  await expectDashboardLoaded(page);
}

export async function loginViaForm(
  page: Page,
  creds: { email: string; password: string }
): Promise<void> {
  await gotoLogin(page);
  await page.getByLabel('Email').fill(creds.email);
  await page.getByLabel('Password').fill(creds.password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await expectDashboardLoaded(page);
}
