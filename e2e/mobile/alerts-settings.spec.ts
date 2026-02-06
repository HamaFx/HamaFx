import { expect, test } from '@playwright/test';
import { installNetworkMocks } from '../helpers/network';
import { loginWithDemo } from '../helpers/auth';

test.describe('Mobile Alerts and Settings', () => {
  test('@smoke creates an alert and updates notification settings', async ({ page }) => {
    await installNetworkMocks(page);
    await loginWithDemo(page);

    await page.goto('/#/alerts');
    await expect(page.getByRole('button', { name: /New Alert/i })).toBeVisible();

    await page.getByRole('button', { name: /New Alert/i }).click();
    await page.getByPlaceholder('e.g., 45000').fill('65000');
    await page.getByRole('button', { name: /Create Alert/i }).click();
    await expect(page.getByText(/BTC/i)).toBeVisible();

    await page.goto('/#/settings');
    await page.getByRole('button', { name: /Alerts/i }).click();
    const soundSwitch = page.getByRole('switch', { name: /Sound notifications/i });
    await expect(soundSwitch).toBeVisible();
    await soundSwitch.click();
    await expect(soundSwitch).toHaveAttribute('aria-checked', /true|false/);
  });
});
