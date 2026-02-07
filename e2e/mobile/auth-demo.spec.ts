import { expect, test } from '@playwright/test';
import { installNetworkMocks } from '../helpers/network';
import { loginViaForm, loginWithDemo, logoutFromMobileMenu, registerViaForm } from '../helpers/auth';

test.describe('Mobile Auth', () => {
  test('@smoke demo login and register/login flow', async ({ page }) => {
    await installNetworkMocks(page);

    await loginWithDemo(page);
    await expect(page.getByText('Dashboard')).toBeVisible();

    await logoutFromMobileMenu(page);

    const id = Date.now();
    const creds = {
      username: `mobile${id}`,
      email: `mobile-${id}@hamafx.test`,
      password: 'test1234',
    };

    await registerViaForm(page, creds);
    await expect(page.getByText('Dashboard')).toBeVisible();

    await logoutFromMobileMenu(page);
    await loginViaForm(page, { email: creds.email, password: creds.password });
    await expect(page.getByText('Dashboard')).toBeVisible();
  });
});
