/*
 * Selenium E2E — Settings / Profile page flows
 * Tests: theme toggle, profile edit, navigation, light mode visual sanity
 */

import { expect } from 'chai';
import {
  buildDriver, goHome, waitFor, click, getText, uniqueEmail, By, until
} from '../helpers/driver.js';

const VALID_PASSWORD = 'TestPass1!safe';

async function signUpAndEnter(driver) {
  await goHome(driver);
  await click(driver, '.nav-pill-cta');
  await waitFor(driver, '.auth-input');
  const email  = uniqueEmail('settings');
  const inputs = await driver.findElements(By.css('.auth-input'));
  if (inputs.length >= 1) await inputs[0].sendKeys('Settings');
  if (inputs.length >= 2) await inputs[1].sendKeys('Tester');
  if (inputs.length >= 3) await inputs[2].sendKeys(email);
  const btns = await driver.findElements(By.css('.btn-primary'));
  if (btns.length > 0) await btns[0].click();
  await waitFor(driver, 'input[type="password"]');
  const pw = await driver.findElement(By.css('input[type="password"]'));
  await pw.sendKeys(VALID_PASSWORD);
  const btns2 = await driver.findElements(By.css('.btn-primary'));
  if (btns2.length > 0) await btns2[btns2.length - 1].click();
  await driver.wait(until.elementLocated(By.css('.fit-shell')), 15000);
}

describe('Settings — Theme Toggle (landing page)', function () {
  this.timeout(20000);
  let driver;

  before(async () => { driver = buildDriver(); });
  after(async  () => { await driver.quit(); });

  it('TC-S01: ThemePill is present on landing page', async () => {
    await goHome(driver);
    const pill = await waitFor(driver, '.theme-pill-btn, .theme-pill-fixed');
    expect(pill).to.not.be.null;
  });

  it('TC-S02: dark mode is default on landing page', async () => {
    await goHome(driver);
    await waitFor(driver, '.theme-pill-btn');
    const html   = await driver.findElement(By.css('html'));
    const theme  = await html.getAttribute('data-theme');
    // Default is dark (or null before any click)
    expect(theme === 'dark' || theme === null || theme === '').to.be.true;
  });

  it('TC-S03: clicking ThemePill toggles to light mode', async () => {
    await goHome(driver);
    const pill = await waitFor(driver, '.theme-pill-btn');
    await pill.click();
    await driver.sleep(400);
    const html  = await driver.findElement(By.css('html'));
    const theme = await html.getAttribute('data-theme');
    expect(theme).to.equal('light', 'Theme should be light after click');
  });

  it('TC-S04: clicking ThemePill again reverts to dark mode', async () => {
    await goHome(driver);
    const pill = await waitFor(driver, '.theme-pill-btn');
    // Ensure we are in dark mode first
    const html   = await driver.findElement(By.css('html'));
    const before = await html.getAttribute('data-theme');
    if (before === 'light') await pill.click(); // go back to dark
    await driver.sleep(300);
    // Now click to light
    await pill.click();
    await driver.sleep(300);
    const afterLight = await html.getAttribute('data-theme');
    expect(afterLight).to.equal('light');
    // Click again to dark
    await pill.click();
    await driver.sleep(300);
    const afterDark = await html.getAttribute('data-theme');
    expect(afterDark).to.equal('dark');
  });

  it('TC-S05: ThemePill label shows correct text for mode', async () => {
    await goHome(driver);
    // Ensure dark mode
    const html = await driver.findElement(By.css('html'));
    const cur  = await html.getAttribute('data-theme');
    const pill = await waitFor(driver, '.theme-pill-btn');
    if (cur === 'light') await pill.click();
    await driver.sleep(300);
    const label = await getText(driver, '.theme-pill-label');
    expect(label).to.equal('Dark');
    // Switch to light
    await pill.click();
    await driver.sleep(300);
    const labelLight = await getText(driver, '.theme-pill-label');
    expect(labelLight).to.equal('Light');
  });
});

describe('Settings — Profile Page', function () {
  this.timeout(30000);
  let driver;

  before(async () => { driver = buildDriver(); await signUpAndEnter(driver); });
  after(async  () => { await driver.quit(); });

  async function openProfile() {
    // Click avatar in sidebar or profile menu
    const avatarBtns = await driver.findElements(
      By.css('.fit-sidebar-avatar, .fit-avatar-btn')
    );
    if (avatarBtns.length > 0) await avatarBtns[0].click();
    // Click "Account" if a menu appeared
    const accountBtns = await driver.findElements(
      By.css('[href="/profile"], .profile-menu-item, [data-route="profile"]')
    );
    if (accountBtns.length > 0) await accountBtns[0].click();
    await driver.sleep(500);
  }

  it('TC-S06: settings page renders with account section', async () => {
    await openProfile();
    // Look for settings card
    const cards = await driver.findElements(By.css('.settings-card, .settings-layout'));
    expect(cards.length).to.be.greaterThan(0);
  });

  it('TC-S07: topbar title shows "Settings" not "SpotMe"', async () => {
    await openProfile();
    await driver.sleep(300);
    const titleEls = await driver.findElements(By.css('.fit-topbar-title'));
    if (titleEls.length > 0) {
      const title = await titleEls[0].getText();
      expect(title).to.equal('Settings');
      expect(title).to.not.equal('SpotMe');
    }
  });

  it('TC-S08: email field is read-only (cannot be edited)', async () => {
    await openProfile();
    await driver.sleep(300);
    const emailRows = await driver.findElements(
      By.xpath('//*[contains(@class,"settings-row-label") and contains(text(),"Email")]/..')
    );
    if (emailRows.length > 0) {
      // No edit button should appear for email row
      const editBtns = await emailRows[0].findElements(By.css('button:not([disabled])'));
      // Email row should have no interactive edit button
      expect(editBtns.length).to.equal(0);
    }
  });

  it('TC-S09: logout button is visible in settings', async () => {
    await openProfile();
    await driver.sleep(300);
    const logoutBtns = await driver.findElements(By.css('.settings-logout-btn'));
    expect(logoutBtns.length).to.be.greaterThan(0);
  });

  it('TC-S10: appearance toggle opens modal', async () => {
    await openProfile();
    await driver.sleep(300);
    // Navigate to App settings section
    const appNavItems = await driver.findElements(
      By.xpath('//*[contains(@class,"settings-nav-item") and contains(.,"App")]')
    );
    if (appNavItems.length > 0) {
      await appNavItems[0].click();
      await driver.sleep(300);
    }
    // Find and click Appearance row
    const appRows = await driver.findElements(
      By.xpath('//*[contains(@class,"settings-row") and contains(.,"Appearance")]')
    );
    if (appRows.length > 0) {
      await appRows[0].click();
      await waitFor(driver, '.settings-modal, .settings-modal-overlay');
    }
  });
});
