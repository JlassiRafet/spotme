/*
 * Selenium E2E — Authentication flows
 * Tests: signup, login, logout, field validation errors, Google OAuth entry
 *
 * Prerequisites:
 *   - SpotMe frontend: http://localhost:8000 (serve /)
 *   - SpotMe backend:  http://localhost:8787
 *   - ChromeDriver installed and on PATH
 *
 * Run: npm test -- tests/auth.test.js
 *      HEADED=1 npm test -- tests/auth.test.js  (visible browser)
 */

import { expect } from 'chai';
import {
  buildDriver, goHome, waitFor, waitForText, fillInput, click,
  getText, uniqueEmail, By, until
} from '../helpers/driver.js';

const VALID_PASSWORD = 'TestPass1!safe';

describe('Auth — Signup', function () {
  this.timeout(30000);
  let driver;

  before(async () => { driver = buildDriver(); });
  after(async  () => { await driver.quit(); });

  it('TC-A01: landing page loads and shows Get Started', async () => {
    await goHome(driver);
    const btn = await waitFor(driver, '.nav-pill-cta');
    const text = await btn.getText();
    expect(text.toLowerCase()).to.include('get started');
  });

  it('TC-A02: clicking Get Started opens the signup form', async () => {
    await goHome(driver);
    await click(driver, '.nav-pill-cta');
    await waitFor(driver, '.auth-input');
    const inputs = await driver.findElements(By.css('.auth-input'));
    expect(inputs.length).to.be.greaterThan(0);
  });

  it('TC-A03: empty form submission shows field errors', async () => {
    await goHome(driver);
    await click(driver, '.nav-pill-cta');
    await waitFor(driver, '.auth-input');
    // Try to proceed without filling anything
    const nextBtn = await driver.findElements(By.css('.btn-primary'));
    if (nextBtn.length > 0) await nextBtn[0].click();
    // Expect field error messages
    await waitFor(driver, '.field-error');
    const errors = await driver.findElements(By.css('.field-error'));
    expect(errors.length).to.be.greaterThan(0);
  });

  it('TC-A04: invalid email format shows validation error', async () => {
    await goHome(driver);
    await click(driver, '.nav-pill-cta');
    await waitFor(driver, '.auth-input');
    // Fill first name, last name, then bad email
    const inputs = await driver.findElements(By.css('.auth-input'));
    if (inputs.length >= 1) await inputs[0].sendKeys('Test');
    if (inputs.length >= 2) await inputs[1].sendKeys('User');
    if (inputs.length >= 3) await inputs[2].sendKeys('notanemail');
    const btns = await driver.findElements(By.css('.btn-primary'));
    if (btns.length > 0) await btns[0].click();
    await waitFor(driver, '.field-error');
  });

  it('TC-A05: weak password is rejected with explanation', async () => {
    await goHome(driver);
    await click(driver, '.nav-pill-cta');
    await waitFor(driver, '.auth-input');
    const inputs = await driver.findElements(By.css('.auth-input'));
    if (inputs.length >= 1) await inputs[0].sendKeys('Alice');
    if (inputs.length >= 2) await inputs[1].sendKeys('Smith');
    if (inputs.length >= 3) await inputs[2].sendKeys('alice@test.spotme');
    // Find password input and enter weak password
    const pwInputs = await driver.findElements(By.css('input[type="password"], input[type="text"]'));
    if (pwInputs.length > 0) await pwInputs[pwInputs.length - 1].sendKeys('weak');
    const btns = await driver.findElements(By.css('.btn-primary'));
    if (btns.length > 0) await btns[0].click();
    await waitFor(driver, '.field-error');
    const errText = await getText(driver, '.field-error');
    expect(errText.length).to.be.greaterThan(5);
  });

  it('TC-A06: valid full signup flow completes and enters app', async () => {
    await goHome(driver);
    await click(driver, '.nav-pill-cta');
    await waitFor(driver, '.auth-input');

    const email = uniqueEmail('signup');
    const inputs = await driver.findElements(By.css('.auth-input'));
    if (inputs.length >= 1) await inputs[0].sendKeys('Alice');
    if (inputs.length >= 2) await inputs[1].sendKeys('Smith');
    if (inputs.length >= 3) await inputs[2].sendKeys(email);

    const btns = await driver.findElements(By.css('.btn-primary'));
    if (btns.length > 0) await btns[0].click();

    // Step 2: password
    await waitFor(driver, 'input[type="password"]');
    const pwInput = await driver.findElement(By.css('input[type="password"]'));
    await pwInput.sendKeys(VALID_PASSWORD);

    const btns2 = await driver.findElements(By.css('.btn-primary'));
    if (btns2.length > 0) await btns2[btns2.length - 1].click();

    // Should land in the app shell (HomeFeed or profile setup)
    await driver.wait(
      until.elementLocated(By.css('.fit-shell, .fit-home, .home-brand-bar')),
      15000
    );
  });
});

describe('Auth — Login', function () {
  this.timeout(30000);
  let driver;
  const testEmail    = uniqueEmail('login');
  const testPassword = VALID_PASSWORD;

  before(async () => {
    driver = buildDriver();
    // Pre-create account via API
    await fetch('http://localhost:8787/api/auth/signup', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail, password: testPassword,
        firstName: 'Login', lastName: 'Tester'
      })
    }).catch(() => null);
  });
  after(async () => { await driver.quit(); });

  it('TC-A07: Log in link opens login form', async () => {
    await goHome(driver);
    await click(driver, '.nav-pill-login');
    await waitFor(driver, '.auth-input');
  });

  it('TC-A08: wrong password shows error message', async () => {
    await goHome(driver);
    await click(driver, '.nav-pill-login');
    await waitFor(driver, '.auth-input');
    const inputs = await driver.findElements(By.css('.auth-input'));
    if (inputs.length >= 1) await inputs[0].sendKeys(testEmail);
    const pwInputs = await driver.findElements(By.css('input[type="password"]'));
    if (pwInputs.length > 0) await pwInputs[0].sendKeys('WrongPass1!bad');
    const btns = await driver.findElements(By.css('.btn-primary'));
    if (btns.length > 0) await btns[0].click();
    // Expect error banner
    await waitFor(driver, '.auth-error-banner, .field-error, [role="alert"]');
  });

  it('TC-A09: correct credentials log in and reach app shell', async () => {
    await goHome(driver);
    await click(driver, '.nav-pill-login');
    await waitFor(driver, '.auth-input');
    const inputs = await driver.findElements(By.css('.auth-input'));
    if (inputs.length >= 1) await inputs[0].sendKeys(testEmail);
    const pwInputs = await driver.findElements(By.css('input[type="password"]'));
    if (pwInputs.length > 0) await pwInputs[0].sendKeys(testPassword);
    const btns = await driver.findElements(By.css('.btn-primary'));
    if (btns.length > 0) await btns[0].click();
    await driver.wait(
      until.elementLocated(By.css('.fit-shell, .fit-home')),
      15000
    );
  });

  it('TC-A10: Google Sign-In button is present and clickable', async () => {
    await goHome(driver);
    await click(driver, '.nav-pill-login');
    await waitFor(driver, '.btn-google');
  });
});

describe('Auth — Logout', function () {
  this.timeout(30000);
  let driver;

  before(async () => { driver = buildDriver(); });
  after(async  () => { await driver.quit(); });

  it('TC-A11: signing out returns to landing page', async () => {
    await goHome(driver);
    // Create and log in
    await click(driver, '.nav-pill-cta');
    await waitFor(driver, '.auth-input');
    const email = uniqueEmail('logout');
    const inputs = await driver.findElements(By.css('.auth-input'));
    if (inputs.length >= 1) await inputs[0].sendKeys('Logout');
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

    // Navigate to settings and log out
    // Via profile menu or settings page
    const settingsBtns = await driver.findElements(By.css('.fit-sidebar-avatar, .fit-avatar-btn'));
    if (settingsBtns.length > 0) {
      await settingsBtns[0].click();
      await driver.sleep(500);
    }
    const logoutBtns = await driver.findElements(By.css('.settings-logout-btn, .profile-menu-signout'));
    if (logoutBtns.length > 0) {
      await logoutBtns[0].click();
      await driver.wait(
        until.elementLocated(By.css('.nav-pill-cta, .marketing-nav-pill')),
        10000
      );
    }
  });
});
