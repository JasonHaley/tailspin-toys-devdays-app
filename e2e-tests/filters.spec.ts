import { test, expect } from '@playwright/test';

test.describe('Game Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('games-grid')).toBeVisible();
  });

  test('should filter the game list by a single category', async ({ page }) => {
    const totalCount = await page.getByTestId('game-card').count();
    let categoryName = '';
    let expectedCount = 0;

    await test.step('Select the first category checkbox', async () => {
      const firstCategoryCheckbox = page.locator('[data-filter-dimension="category"]').first();
      categoryName = (await firstCategoryCheckbox.locator('xpath=..').innerText()).trim();
      await firstCategoryCheckbox.check();
    });

    await test.step('Verify only games in that category remain visible', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      expectedCount = await visibleCards.count();
      expect(expectedCount).toBeGreaterThan(0);
      expect(expectedCount).toBeLessThan(totalCount);

      const count = await visibleCards.count();
      for (let i = 0; i < count; i++) {
        await expect(visibleCards.nth(i).getByTestId('game-category')).toHaveText(categoryName);
      }
    });

    await test.step('Verify the live status region reports the visible count', async () => {
      await expect(page.getByTestId('filter-status')).toHaveText(`Showing ${expectedCount} of ${totalCount} games.`);
    });
  });

  test('should filter the game list by a single publisher', async ({ page }) => {
    const totalCount = await page.getByTestId('game-card').count();
    let publisherName = '';

    await test.step('Select the first publisher checkbox', async () => {
      const firstPublisherCheckbox = page.locator('[data-filter-dimension="publisher"]').first();
      publisherName = (await firstPublisherCheckbox.locator('xpath=..').innerText()).trim();
      await firstPublisherCheckbox.check();
    });

    await test.step('Verify only games from that publisher remain visible', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      const count = await visibleCards.count();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(totalCount);

      for (let i = 0; i < count; i++) {
        await expect(visibleCards.nth(i).getByTestId('game-publisher')).toHaveText(publisherName);
      }
    });
  });

  test('should combine category and publisher filters', async ({ page }) => {
    let categoryName = '';
    let publisherName = '';

    await test.step('Select one category and one publisher', async () => {
      const firstCategoryCheckbox = page.locator('[data-filter-dimension="category"]').first();
      categoryName = (await firstCategoryCheckbox.locator('xpath=..').innerText()).trim();
      await firstCategoryCheckbox.check();

      const firstPublisherCheckbox = page.locator('[data-filter-dimension="publisher"]').first();
      publisherName = (await firstPublisherCheckbox.locator('xpath=..').innerText()).trim();
      await firstPublisherCheckbox.check();
    });

    await test.step('Verify visible games match both filters', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      const count = await visibleCards.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        await expect(visibleCards.nth(i).getByTestId('game-category')).toHaveText(categoryName);
        await expect(visibleCards.nth(i).getByTestId('game-publisher')).toHaveText(publisherName);
      }
    });
  });

  test('should restore the full game list when filters are cleared', async ({ page }) => {
    const totalCount = await page.getByTestId('game-card').count();

    await test.step('Apply a category filter', async () => {
      await page.locator('[data-filter-dimension="category"]').first().check();
      await expect(page.locator('[data-testid="game-card"]:visible')).not.toHaveCount(totalCount);
    });

    await test.step('Click clear filters', async () => {
      await page.getByTestId('clear-filters-button').click();
    });

    await test.step('Verify all games are visible again and checkboxes are unchecked', async () => {
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(totalCount);
      await expect(page.locator('.game-filter-checkbox:checked')).toHaveCount(0);
      await expect(page.getByTestId('filter-status')).toHaveText('');
    });
  });

  test('should be operable via the keyboard', async ({ page }) => {
    await test.step('Tab to the first category checkbox and toggle it with the keyboard', async () => {
      const firstCategoryCheckbox = page.locator('[data-filter-dimension="category"]').first();
      await firstCategoryCheckbox.focus();
      await expect(firstCategoryCheckbox).toBeFocused();
      await page.keyboard.press('Space');
      await expect(firstCategoryCheckbox).toBeChecked();
    });

    await test.step('Tab to the clear filters button and activate it with the keyboard', async () => {
      const clearButton = page.getByTestId('clear-filters-button');
      await clearButton.focus();
      await expect(clearButton).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-filter-dimension="category"]').first()).not.toBeChecked();
    });
  });

  test('should show an empty state when no games match the selected filters', async ({ page }) => {
    await test.step('Select a category filter that matches no currently visible games', async () => {
      const firstCategoryCheckbox = page.locator('[data-filter-dimension="category"]').first();
      // Simulate a category with no assigned games by pointing the checkbox at an id no card carries.
      await firstCategoryCheckbox.evaluate((el) => {
        (el as HTMLInputElement).dataset.filterId = 'no-such-category';
      });
      await firstCategoryCheckbox.check();
    });

    await test.step('Verify the empty state is shown and the grid is hidden', async () => {
      await expect(page.getByTestId('filters-empty-state')).toBeVisible();
      await expect(page.getByTestId('games-grid')).toBeHidden();
    });
  });
});
