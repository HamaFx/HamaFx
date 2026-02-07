import { expect, test, type Page } from '@playwright/test';
import { installNetworkMocks } from '../helpers/network';
import { loginWithDemo } from '../helpers/auth';

async function createPosition(page: Page) {
  await page.goto('/#/asset/bitcoin');
  await expect(page.getByText(/Paper Trade — BTC/i)).toBeVisible();
  await page.locator('#order-amount').fill('120');
  await page.getByRole('button', { name: /Execute Buy Order/i }).click();
  await page.getByRole('button', { name: /Confirm Buy/i }).click();
}

test.describe('Mobile Portfolio Close', () => {
  test('@smoke closes an existing position and records history', async ({ page }) => {
    await installNetworkMocks(page);
    await loginWithDemo(page);

    await createPosition(page);
    await page.goto('/#/portfolio');
    await expect(page.getByRole('link', { name: /BTC\s+long/i }).first()).toBeVisible();

    await page.getByRole('button', { name: /^Close$/ }).first().click();
    await expect(page.getByText('No open positions')).toBeVisible();

    await page.getByRole('button', { name: /History/i }).click();
    await expect(page.getByText(/sell/i)).toBeVisible();
  });
});
