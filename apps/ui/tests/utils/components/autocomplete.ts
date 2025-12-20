import { Page, Locator } from "@playwright/test";
import { waitForElement, waitForElementHidden } from "../core/waiting";

/**
 * Check if the category autocomplete dropdown is visible
 */
export async function isCategoryAutocompleteListVisible(
  page: Page
): Promise<boolean> {
  const list = page.locator('[data-testid="category-autocomplete-list"]');
  return await list.isVisible();
}

/**
 * Wait for the category autocomplete dropdown to be visible
 */
export async function waitForCategoryAutocompleteList(
  page: Page,
  options?: { timeout?: number }
): Promise<Locator> {
  return await waitForElement(page, "category-autocomplete-list", options);
}

/**
 * Wait for the category autocomplete dropdown to be hidden
 */
export async function waitForCategoryAutocompleteListHidden(
  page: Page,
  options?: { timeout?: number }
): Promise<void> {
  await waitForElementHidden(page, "category-autocomplete-list", options);
}

/**
 * Click a category option in the autocomplete dropdown
 */
export async function clickCategoryOption(
  page: Page,
  categoryName: string
): Promise<void> {
  const optionTestId = `category-option-${categoryName
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
  const option = page.locator(`[data-testid="${optionTestId}"]`);
  await option.click();
}

/**
 * Get a category option element by name
 */
export async function getCategoryOption(
  page: Page,
  categoryName: string
): Promise<Locator> {
  const optionTestId = `category-option-${categoryName
    .toLowerCase()
    .replace(/\s+/g, "-")}`;
  return page.locator(`[data-testid="${optionTestId}"]`);
}

/**
 * Click the "Create new" option for a category that doesn't exist
 */
export async function clickCreateNewCategoryOption(
  page: Page
): Promise<void> {
  const option = page.locator('[data-testid="category-option-create-new"]');
  await option.click();
}

/**
 * Get the "Create new" option element for categories
 */
export async function getCreateNewCategoryOption(
  page: Page
): Promise<Locator> {
  return page.locator('[data-testid="category-option-create-new"]');
}
