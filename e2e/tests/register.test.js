const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

// The browser runs in the "selenium" container, so BASE_URL must be reachable FROM that container
const SELENIUM_URL = process.env.SELENIUM_URL || 'http://localhost:4444/wd/hub';
const BASE_URL = (process.env.BASE_URL || 'http://host.docker.internal:4000').replace(/\/$/, '');

let driver;

beforeAll(async () => {
  const options = new chrome.Options().addArguments('--no-sandbox', '--disable-dev-shm-usage');
  driver = await new Builder().usingServer(SELENIUM_URL).forBrowser('chrome').setChromeOptions(options).build();
});

afterAll(async () => {
  if (driver) await driver.quit();
});

async function waitForText(css, text, timeout = 10000) {
  await driver.wait(async () => {
    try { return (await driver.findElement(By.css(css)).getText()).includes(text); }
    catch { return false; }
  }, timeout, `Timed out waiting for "${text}" in ${css}`);
}

async function fillAndSubmit(name, email) {
  await driver.wait(until.elementLocated(By.xpath("//label[contains(.,'Name')]//input")), 10000);
  await driver.findElement(By.xpath("//label[contains(.,'Name')]//input")).sendKeys(name);
  await driver.findElement(By.xpath("//label[contains(.,'Email')]//input")).sendKeys(email);
  await driver.findElement(By.xpath("//button[normalize-space()='Register']")).click();
}

test('home lists seeded events (React -> nginx -> Express -> MySQL)', async () => {
  await driver.get(`${BASE_URL}/`);
  await waitForText('h1', 'Upcoming events');
  await waitForText('ul', 'CI/CD with Jenkins');
});

test('user can register for an event', async () => {
  await driver.get(`${BASE_URL}/`);
  const link = await driver.wait(until.elementLocated(By.xpath("//a[normalize-space()='Register']")), 10000);
  await link.click();
  await fillAndSubmit('Test User', `user${Date.now()}@example.com`);
  await waitForText('[role=status]', "You're registered");
});

test('duplicate registration is rejected', async () => {
  const email = `dup${Date.now()}@example.com`;
  await driver.get(`${BASE_URL}/events/2`);
  await fillAndSubmit('Dup User', email);
  await waitForText('[role=status]', "You're registered");

  await driver.get(`${BASE_URL}/events/2`);
  await fillAndSubmit('Dup User', email);
  await waitForText('[role=alert]', 'already registered');
});

test('invalid email shows a validation message', async () => {
  await driver.get(`${BASE_URL}/events/1`);
  await fillAndSubmit('Test', 'not-an-email');
  await waitForText('[role=alert]', 'valid email');
});

test('deep links work (nginx SPA fallback) and unknown routes show the 404 page', async () => {
  await driver.get(`${BASE_URL}/events/3`);
  await waitForText('h1', 'Register for event #3');
  await driver.get(`${BASE_URL}/nope`);
  await waitForText('h1', 'Page not found');
});