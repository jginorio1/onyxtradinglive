import { test, expect } from '@playwright/test';

// Pruebas de humo: recorren botones y páginas clave sin crear datos reales.
// Cada test = un "flujo" que aparece verde/rojo en la pestaña Auditoría.

test('Inicio carga', async ({ page }) => {
  const r = await page.goto('/');
  expect(r?.ok()).toBeTruthy();
});

test('Precios carga', async ({ page }) => {
  const r = await page.goto('/pricing');
  expect(r?.ok()).toBeTruthy();
});

test('Guía carga', async ({ page }) => {
  const r = await page.goto('/guia');
  expect(r?.ok()).toBeTruthy();
});

test('Registro pide nombre', async ({ page }) => {
  await page.goto('/login?mode=signup');
  await expect(page.getByPlaceholder('Jerry')).toBeVisible();
});

test('Inglés en /en', async ({ page }) => {
  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('Widget de soporte abre', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /ayuda|help/i }).first().click();
  await expect(page.getByText(/Onyx AI/i).first()).toBeVisible({ timeout: 8000 });
});
