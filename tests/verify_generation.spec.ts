import { test, expect } from '@playwright/test';

test('Verify English Plan Generation', async ({ page }) => {
    test.setTimeout(120000); // Allow 2 mins for cold boot + generation
    // 1. Go to Home
    await page.goto('http://localhost:3000');

    // 2. Fill Form
    await page.fill('input[name="topic"]', 'Quantum Physics');
    await page.selectOption('select[name="urgency"]', 'ASAP');
    await page.selectOption('select[name="level"]', 'Beginner');
    await page.selectOption('select[name="language"]', 'English');

    // 3. Submit
    console.log('Submitting form...');
    await page.click('button[type="submit"]');

    // 4. Wait for Plan Page
    await expect(page).toHaveURL(/\/plan\/.+/);
    console.log('Plan page loaded. Waiting for chapters...');

    // 5. Check for "Writing this chapter..." or "Retry"
    // Wait up to 60s for the first chapter to be generated
    try {
        await expect(page.locator('text=Writing this chapter...').first()).toBeVisible({ timeout: 10000 });
        console.log('Generation started...');
    } catch (e) {
        console.log('Generation might have finished quickly or failed immediately.');
    }

    // Monitor for completion or failure
    // We expect "Key Takeaway" to appear when done
    // Or "Retry Generation" if failed

    const contentPromise = page.waitForSelector('text=Key Takeaway', { timeout: 60000, state: 'visible' });
    const errorPromise = page.waitForSelector('text=Retry Generation', { timeout: 60000, state: 'visible' });

    try {
        await Promise.race([contentPromise, errorPromise]);

        const isError = await page.isVisible('text=Retry Generation');
        if (isError) {
            console.error('Test Failed: Generation stuck/failed. Retry button visible.');
            await page.screenshot({ path: 'tests/failure_screenshot.png' });
            throw new Error('Generation Failed');
        } else {
            console.log('Test Passed: Chapter generated successfully.');
        }
    } catch (e) {
        console.error('Test Timed Out: Neither success nor explicit failure state reached.');
        await page.screenshot({ path: 'tests/timeout_screenshot.png' });
        throw e;
    }
});
