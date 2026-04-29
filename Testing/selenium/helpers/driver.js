/*
 * Selenium WebDriver factory — SpotMe E2E tests
 * Creates a Chrome driver (headless by default, headed with HEADED=1 env var)
 */

import { Builder, By, until, Key } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';
const HEADED   = process.env.HEADED   === '1';
const TIMEOUT  = parseInt(process.env.TIMEOUT || '10000');

export { By, until, Key };
export { BASE_URL };

export function buildDriver() {
  const opts = new chrome.Options();
  if (!HEADED) {
    opts.addArguments('--headless=new');
  }
  opts.addArguments(
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1440,900',
    '--disable-gpu',
    '--disable-extensions'
  );

  return new Builder()
    .forBrowser('chrome')
    .setChromeOptions(opts)
    .build();
}

/**
 * Wait for an element matching `selector` to be visible.
 * @param {WebDriver} driver
 * @param {string} selector   CSS selector
 * @param {number} [ms]       Timeout in ms
 */
export async function waitFor(driver, selector, ms = TIMEOUT) {
  const el = await driver.wait(
    until.elementLocated(By.css(selector)),
    ms,
    `Timed out waiting for: ${selector}`
  );
  await driver.wait(until.elementIsVisible(el), ms);
  return el;
}

/**
 * Wait for text to appear anywhere on the page.
 */
export async function waitForText(driver, text, ms = TIMEOUT) {
  await driver.wait(
    until.elementLocated(By.xpath(`//*[contains(text(),'${text}')]`)),
    ms,
    `Timed out waiting for text: "${text}"`
  );
}

/**
 * Type text into an input, clearing it first.
 */
export async function fillInput(driver, selector, value) {
  const el = await waitFor(driver, selector);
  await el.clear();
  await el.sendKeys(value);
  return el;
}

/**
 * Click an element by CSS selector.
 */
export async function click(driver, selector) {
  const el = await waitFor(driver, selector);
  await el.click();
  return el;
}

/**
 * Get the text content of an element.
 */
export async function getText(driver, selector) {
  const el = await waitFor(driver, selector);
  return el.getText();
}

/**
 * Navigate to the app root.
 */
export async function goHome(driver) {
  await driver.get(BASE_URL);
  await driver.wait(until.elementLocated(By.css('body')), 5000);
}

/**
 * Generate a unique test email.
 */
export function uniqueEmail(prefix = 'e2e') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.spotme`;
}
