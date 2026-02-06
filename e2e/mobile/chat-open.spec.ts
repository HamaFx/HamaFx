import { expect, test } from '@playwright/test';
import { installNetworkMocks } from '../helpers/network';
import { loginWithDemo } from '../helpers/auth';

test.describe('Mobile Chat Drawer', () => {
  test('opens AI chat drawer', async ({ page }) => {
    await installNetworkMocks(page);
    await loginWithDemo(page);

    await page.getByLabel('Open AI Chat').click();
    await expect(page.getByText('NexusTrade AI')).toBeVisible();
    await expect(page.getByPlaceholder(/Ask about markets/i)).toBeVisible();
  });
});
