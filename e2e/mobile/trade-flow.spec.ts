import { expect, test } from '@playwright/test';
import { installNetworkMocks } from '../helpers/network';
import { loginWithDemo } from '../helpers/auth';

test.describe('Mobile Trade Flow', () => {
  test('@smoke places a market buy order from asset page', async ({ page }) => {
    await installNetworkMocks(page);
    await loginWithDemo(page);

    await page.goto('/#/asset/bitcoin');
    await expect(page.getByText(/Paper Trade — BTC/i)).toBeVisible();

    await page.locator('#order-amount').fill('100');
    await page.getByRole('button', { name: /Execute Buy Order/i }).click();
    await page.getByRole('button', { name: /Confirm Buy/i }).click();

    await page.goto('/#/portfolio');
    await expect(page.getByRole('button', { name: /Positions/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /BTC\s+long/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Close$/ }).first()).toBeVisible();
  });
});
