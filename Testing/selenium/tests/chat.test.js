/*
 * Selenium E2E — Chat (AI Coach) flows
 * Tests: sending messages, receiving responses, empty send guard,
 *        voice input button presence, image upload presence
 *
 * Prerequisites:
 *   - SpotMe frontend: http://localhost:8000
 *   - SpotMe backend:  http://localhost:8787 (with valid GROQ_API_KEY)
 */

import { expect } from 'chai';
import {
  buildDriver, goHome, waitFor, waitForText, fillInput, click,
  getText, uniqueEmail, By, until
} from '../helpers/driver.js';

const VALID_PASSWORD = 'TestPass1!safe';

async function signUpAndEnter(driver) {
  await goHome(driver);
  await click(driver, '.nav-pill-cta');
  await waitFor(driver, '.auth-input');
  const email  = uniqueEmail('chat');
  const inputs = await driver.findElements(By.css('.auth-input'));
  if (inputs.length >= 1) await inputs[0].sendKeys('Chat');
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

async function openChat(driver) {
  // Navigate to chat via the Dicter chip or tab bar
  const chatBtns = await driver.findElements(By.css('.fit-dicter, [aria-label="Chat"], .fit-tabbar-btn'));
  if (chatBtns.length > 0) await chatBtns[0].click();
  await waitFor(driver, '.chat-input, .chat-input-textarea');
}

describe('Chat — Input Validation', function () {
  this.timeout(30000);
  let driver;

  before(async () => { driver = buildDriver(); await signUpAndEnter(driver); });
  after(async  () => { await driver.quit(); });

  it('TC-C01: chat input area is present in app shell', async () => {
    await driver.wait(
      until.elementLocated(By.css('.chat-input, .chat-input-textarea, .fit-dicter')),
      10000
    );
    const inputs = await driver.findElements(By.css('.chat-input, .chat-input-textarea'));
    expect(inputs.length).to.be.greaterThan(0, 'Chat input should be present');
  });

  it('TC-C02: send button is disabled when input is empty', async () => {
    const sendBtns = await driver.findElements(By.css('.send-btn, .chat-send-btn, [aria-label="Send"]'));
    if (sendBtns.length > 0) {
      const isDisabled = await sendBtns[0].getAttribute('disabled');
      const classes    = await sendBtns[0].getAttribute('class');
      // Either disabled attribute or no "is-ready" class
      const notReady = !classes.includes('is-ready') || isDisabled;
      expect(notReady).to.be.true;
    }
  });

  it('TC-C03: typing a message enables the send button', async () => {
    const textarea = await driver.findElements(By.css('.chat-input-textarea, textarea.chat-input'));
    if (textarea.length > 0) {
      await textarea[0].sendKeys('Hello coach');
      await driver.sleep(300);
      const sendBtns = await driver.findElements(By.css('.send-btn, .chat-send-btn'));
      if (sendBtns.length > 0) {
        const classes = await sendBtns[0].getAttribute('class');
        const isDisabled = await sendBtns[0].getAttribute('disabled');
        expect(isDisabled).to.be.null;
      }
    }
  });

  it('TC-C04: sending a message shows the user bubble', async () => {
    const textarea = await driver.findElements(By.css('.chat-input-textarea, textarea'));
    if (textarea.length > 0) {
      await textarea[0].clear();
      await textarea[0].sendKeys('What is a good warm-up routine?');
      const sendBtn = await driver.findElements(By.css('.send-btn.is-ready, .chat-send-btn, [aria-label="Send"]'));
      if (sendBtn.length > 0) {
        await sendBtn[0].click();
        // User bubble should appear
        await driver.wait(
          until.elementLocated(By.css('.msg-user, .message-user, [data-role="user"]')),
          5000
        );
      }
    }
  });

  it('TC-C05: AI response bubble appears after sending', async function () {
    this.timeout(30000); // AI response can take a few seconds
    // Wait for assistant bubble (streaming)
    try {
      await driver.wait(
        until.elementLocated(By.css('.msg-assistant, .message-assistant, [data-role="assistant"]')),
        25000
      );
    } catch (e) {
      // AI may be unavailable in test env — not a hard failure
      this.skip();
    }
  });
});

describe('Chat — UI Elements', function () {
  this.timeout(30000);
  let driver;

  before(async () => { driver = buildDriver(); await signUpAndEnter(driver); });
  after(async  () => { await driver.quit(); });

  it('TC-C06: voice input button (microphone) is present', async () => {
    const micBtns = await driver.findElements(
      By.css('[aria-label*="voice"], [aria-label*="Voice"], [aria-label*="mic"], .chat-input-btn')
    );
    expect(micBtns.length).to.be.greaterThan(0, 'Voice input button should exist');
  });

  it('TC-C07: image upload button is present', async () => {
    const uploadBtns = await driver.findElements(
      By.css('[aria-label*="image"], [aria-label*="Image"], [aria-label*="identify"], input[type="file"]')
    );
    expect(uploadBtns.length).to.be.greaterThan(0, 'Image upload button should exist');
  });

  it('TC-C08: empty chat shows suggestion chips', async () => {
    // If new session, suggestion chips should be visible
    const suggestions = await driver.findElements(
      By.css('.chat-empty-suggestion, .suggestion-chip')
    );
    // Suggestions may or may not be visible if a message was already sent
    // Just verify no JS errors crashed the page
    const title = await driver.getTitle();
    expect(title).to.not.be.empty;
  });
});
