import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { confirm, input, password } from "@inquirer/prompts";
import { Launcher, launch, type Options } from "chrome-launcher";
import type { Browser, Page } from "playwright-core";
import { createContext, validateCloudToken } from "./context.js";
import { HETZNER_CLOUD_CONSOLE_URL } from "./token-instructions.js";

export type CloudTokenPermission = "read" | "read-write";

export interface CloudTokenBootstrapOptions {
  contextName: string;
  createProject?: boolean;
  envFile?: string | boolean;
  permission: CloudTokenPermission;
  projectName: string;
  tokenName?: string;
  verify?: boolean;
}

const ENV_TOKEN_KEY = "HETZNER_CLOUD_TOKEN";
const TRAILING_NEWLINES_REGEX = /\n+$/;
const PROJECT_CARD_SELECTOR = '[data-test="project"]';
const SECURITY_LINK_SELECTOR = '[data-test="main-nav__link--security"]';
const API_TOKENS_LINK_SELECTOR = 'a[href$="/security/tokens"]';
const DIALOG_INPUT_SELECTOR = 'input[data-test="input"]';
const READ_PERMISSION_SELECTOR = '[data-test="radio-item--read"]';
const READ_WRITE_PERMISSION_SELECTOR = '[data-test="radio-item--read_write"]';
const SELECT_ALL_MODIFIER = process.platform === "darwin" ? "Meta" : "Control";
const DISABLE_FEATURES_FLAG = "--disable-features=";
const ELEMENT_TIMEOUT_MS = 15_000;

function sandboxedChromeFlags(): string[] {
  const flags = Launcher.defaultFlags()
    .filter((flag) => flag !== "--disable-component-update")
    .filter((flag) => !flag.includes("no-sandbox"));
  return flags.map((flag) =>
    flag.startsWith(DISABLE_FEATURES_FLAG)
      ? `${flag},AutomationControlled`
      : flag
  );
}

function resolveEnvFilePath(envFile: string | boolean | undefined): string {
  if (typeof envFile === "string") {
    return resolve(envFile);
  }
  return resolve(process.cwd(), ".env");
}

export function normalizePermission(value: string): CloudTokenPermission {
  if (value === "read" || value === "read-write") {
    return value;
  }
  throw new Error("Permission must be 'read' or 'read-write'.");
}

export function upsertEnvValue(
  content: string,
  key: string,
  value: string
): string {
  const normalizedContent = content.replace(TRAILING_NEWLINES_REGEX, "");
  const lines =
    normalizedContent.length > 0 ? normalizedContent.split("\n") : [];
  const nextLine = `${key}=${value}`;
  let found = false;

  const updatedLines = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return nextLine;
    }
    return line;
  });

  if (!found) {
    updatedLines.push(nextLine);
  }

  return `${updatedLines.join("\n").replace(TRAILING_NEWLINES_REGEX, "")}\n`;
}

export function writeEnvToken(envFile: string, token: string): void {
  const currentContent = existsSync(envFile)
    ? readFileSync(envFile, "utf-8")
    : "";
  const nextContent = upsertEnvValue(currentContent, ENV_TOKEN_KEY, token);
  mkdirSync(dirname(envFile), { recursive: true });
  writeFileSync(envFile, nextContent, { mode: 0o600 });
  chmodSync(envFile, 0o600);
}

export function chromeLaunchOptions(
  startingUrl: string,
  extraFlags: string[] = []
): Options {
  return {
    chromeFlags: [
      ...sandboxedChromeFlags(),
      "--start-maximized",
      "--disable-dev-shm-usage",
      ...extraFlags,
    ],
    // The defaults are already filtered into the flags above.
    ignoreDefaultFlags: true,
    startingUrl,
  };
}

export interface ConsoleBrowserSession {
  attach: () => Promise<Page>;
  close: () => Promise<void>;
}

function findConsolePage(browser: Browser, consoleUrl: string): Page {
  const { origin } = new URL(consoleUrl);
  const pages = browser.contexts().flatMap((context) => context.pages());
  const page =
    pages.filter((candidate) => candidate.url().startsWith(origin)).at(-1) ??
    pages.at(-1);
  if (!page) {
    throw new Error("No browser tab is open. Rerun the bootstrap to continue.");
  }
  return page;
}

/**
 * Open Chrome without any automation attached. The user logs in to an ordinary
 * browser session; `attach` connects only once they ask hctl to continue.
 */
export async function launchConsoleBrowser(
  consoleUrl: string,
  extraFlags: string[] = []
): Promise<ConsoleBrowserSession> {
  const chrome = await launch(chromeLaunchOptions(consoleUrl, extraFlags));
  let browser: Browser | null = null;

  return {
    attach: async () => {
      try {
        // Loaded here so other commands do not pay for it at startup.
        const { chromium } = await import("playwright-core");
        browser = await chromium.connectOverCDP(
          `http://127.0.0.1:${chrome.port}`
        );
      } catch (error) {
        throw new Error(
          "Could not connect to the browser. Keep the window open until setup finishes.",
          { cause: error }
        );
      }
      return findConsolePage(browser, consoleUrl);
    },
    close: async () => {
      try {
        // Only disconnects: a browser attached over CDP keeps running.
        await browser?.close();
      } finally {
        chrome.kill();
      }
    },
  };
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function clickVisibleText(
  page: Page,
  labels: string[]
): Promise<boolean> {
  const point = await page.evaluate((candidateLabels) => {
    const normalizedLabels = candidateLabels.map((label) =>
      label.toLowerCase().trim()
    );
    const isVisible = (element: Element): boolean => {
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const style = window.getComputedStyle(htmlElement);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    };
    const getTexts = (element: Element): string[] =>
      [
        element.textContent ?? "",
        element.getAttribute("aria-label") ?? "",
        element.getAttribute("title") ?? "",
        element.getAttribute("value") ?? "",
      ]
        .map((value) => value.toLowerCase().replace(/\s+/g, " ").trim())
        .filter((value) => value.length > 0);
    const elements = Array.from(
      document.querySelectorAll(
        "button,a,[role='button'],[role='radio'],input[type='button'],input[type='submit']"
      )
    );
    const matches = elements.filter((element) => {
      const elementTexts = getTexts(element);
      return (
        isVisible(element) &&
        normalizedLabels.some((label) => elementTexts.includes(label))
      );
    });
    const match = matches.at(-1);
    if (!match) {
      return null;
    }
    const rect = (match as HTMLElement).getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, labels);
  if (!point) {
    return false;
  }
  await page.mouse.click(point.x, point.y);
  return true;
}

async function clickVisibleSelector(
  page: Page,
  selector: string
): Promise<boolean> {
  try {
    const element = await page.waitForSelector(selector, {
      state: "visible",
      timeout: ELEMENT_TIMEOUT_MS,
    });
    if (!element) {
      return false;
    }
    // Styled controls can cover their own input, which fails actionability.
    await element.click({ force: true, timeout: ELEMENT_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

async function fillVisibleInput(
  page: Page,
  value: string,
  labels: string[] = []
): Promise<boolean> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const filled = await page.evaluate(
      ({ candidateLabels }) => {
        const normalizedLabels = candidateLabels.map((label) =>
          label.toLowerCase().trim()
        );
        const isVisible = (element: Element): boolean => {
          const htmlElement = element as HTMLElement;
          const rect = htmlElement.getBoundingClientRect();
          const style = window.getComputedStyle(htmlElement);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0"
          );
        };
        const getInputText = (inputElement: HTMLInputElement): string =>
          [
            inputElement.name,
            inputElement.id,
            inputElement.placeholder,
            inputElement.getAttribute("aria-label") ?? "",
            Array.from(inputElement.labels ?? [])
              .map((label) => label.textContent ?? "")
              .join(" "),
          ]
            .join(" ")
            .toLowerCase();
        const inputs = Array.from(
          document.querySelectorAll<HTMLInputElement>(
            "input:not([type='hidden']):not([disabled]),textarea:not([disabled])"
          )
        ).filter(isVisible);
        const matchedInput =
          [...inputs]
            .reverse()
            .find((inputElement) =>
              normalizedLabels.some((label) =>
                getInputText(inputElement).includes(label)
              )
            ) ?? inputs.at(-1);
        if (!matchedInput) {
          return null;
        }
        const rect = matchedInput.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      },
      { candidateLabels: labels }
    );
    if (filled) {
      await page.mouse.click(filled.x, filled.y);
      await page.keyboard.down(SELECT_ALL_MODIFIER);
      await page.keyboard.press("A");
      await page.keyboard.up(SELECT_ALL_MODIFIER);
      await page.keyboard.type(value);
      await page.keyboard.press("Tab");
      return true;
    }
    await delay(500);
  }
  return false;
}

async function clickTopRightOverlayControl(page: Page): Promise<boolean> {
  const point = await page.evaluate(() => {
    const isVisible = (element: Element): boolean => {
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const style = window.getComputedStyle(htmlElement);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    };
    const overlays = Array.from(
      document.querySelectorAll<HTMLElement>("[role='dialog'],.modal,.dialog")
    ).filter(isVisible);
    const overlay =
      overlays.find((element) =>
        (element.textContent ?? "").toLowerCase().includes("what's new")
      ) ?? overlays.at(-1);
    if (!overlay) {
      return null;
    }
    const overlayRect = overlay.getBoundingClientRect();
    const controls = Array.from(
      overlay.querySelectorAll<HTMLElement>(
        "button,[role='button'],a,svg,[aria-label]"
      )
    ).filter(isVisible);
    const candidates = controls
      .map((control) => {
        const rect = control.getBoundingClientRect();
        return {
          score: rect.left + (overlayRect.bottom - rect.top),
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      })
      .sort((left, right) => right.score - left.score);
    return candidates[0] ? { x: candidates[0].x, y: candidates[0].y } : null;
  });
  if (!point) {
    return false;
  }
  await page.mouse.click(point.x, point.y);
  return true;
}

async function closeConsoleOverlays(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await delay(500);
  if (!(await clickVisibleText(page, ["close", "dismiss", "×"]))) {
    await clickTopRightOverlayControl(page);
  }
  await delay(500);
}

async function clickProjectCard(
  page: Page,
  projectName: string
): Promise<boolean> {
  const point = await page.evaluate(
    ({ name, selector }) => {
      const normalizedName = name.toLowerCase().trim();
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>(selector)
      );
      const match = cards.find((card) => {
        const rect = card.getBoundingClientRect();
        const style = window.getComputedStyle(card);
        const text = (card.textContent ?? "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          text.includes(normalizedName)
        );
      });
      if (!match) {
        return null;
      }
      const rect = match.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    },
    { name: projectName, selector: PROJECT_CARD_SELECTOR }
  );
  if (!point) {
    return false;
  }
  await page.mouse.click(point.x, point.y);
  return true;
}

async function createProject(page: Page, projectName: string): Promise<void> {
  const clickedNewProject = await clickVisibleText(page, [
    "new project",
    "+ new project",
  ]);
  if (!clickedNewProject) {
    throw new Error("Could not find the New project control.");
  }
  await delay(1000);
  const filledName = await fillVisibleInput(page, projectName, [
    "project",
    "name",
  ]);
  if (!filledName) {
    throw new Error("Could not find the project name field.");
  }
  const clickedCreate = await clickVisibleText(page, ["add project"]);
  if (!clickedCreate) {
    throw new Error("Could not find the Create project button.");
  }
  await delay(3000);
}

async function ensureProjectOpen(
  page: Page,
  projectName: string,
  createIfMissing: boolean
): Promise<void> {
  await page.goto(`${HETZNER_CLOUD_CONSOLE_URL}/projects`, {
    waitUntil: "domcontentloaded",
  });
  await delay(2000);
  await closeConsoleOverlays(page);

  if (await clickProjectCard(page, projectName)) {
    await delay(2500);
    return;
  }

  if (!createIfMissing) {
    throw new Error(
      `Could not find project '${projectName}'. Rerun with --create-project to create it.`
    );
  }

  await createProject(page, projectName);
  await closeConsoleOverlays(page);
  if (await clickProjectCard(page, projectName)) {
    await delay(2500);
    return;
  }
  throw new Error(`Created project '${projectName}' but could not open it.`);
}

async function openApiTokenForm(
  page: Page,
  tokenName: string,
  permission: CloudTokenPermission
): Promise<void> {
  await closeConsoleOverlays(page);
  const clickedSecurity = await clickVisibleSelector(
    page,
    SECURITY_LINK_SELECTOR
  );
  if (!clickedSecurity) {
    throw new Error("Could not find the Security section.");
  }
  await delay(1500);

  const clickedApiTokens = await clickVisibleSelector(
    page,
    API_TOKENS_LINK_SELECTOR
  );
  if (!clickedApiTokens) {
    throw new Error("Could not find the API Tokens section.");
  }
  await delay(1500);

  const clickedGenerate = await clickVisibleText(page, [
    "generate api token",
    "generate",
  ]);
  if (!clickedGenerate) {
    throw new Error("Could not find the Generate API Token button.");
  }
  await delay(1000);

  const inputReady = await page
    .waitForSelector(DIALOG_INPUT_SELECTOR, {
      state: "visible",
      timeout: ELEMENT_TIMEOUT_MS,
    })
    .then(Boolean)
    .catch(() => false);
  const filledTokenName =
    inputReady &&
    (await fillVisibleInput(page, tokenName, ["description", "name"]));
  if (!filledTokenName) {
    throw new Error("Could not find the API token name field.");
  }

  const permissionClicked = await clickVisibleSelector(
    page,
    permission === "read-write"
      ? READ_WRITE_PERMISSION_SELECTOR
      : READ_PERMISSION_SELECTOR
  );
  if (!permissionClicked) {
    throw new Error(`Could not select ${permission} token permissions.`);
  }
}

export async function submitApiTokenForm(page: Page): Promise<void> {
  const clickedFinalGenerate = await clickVisibleText(page, [
    "generate api token",
  ]);
  if (!clickedFinalGenerate) {
    throw new Error("Could not find the final Generate token button.");
  }
  await delay(1500);
}

export async function automateTokenSetup(
  page: Page,
  options: CloudTokenBootstrapOptions,
  tokenName: string
): Promise<void> {
  await ensureProjectOpen(
    page,
    options.projectName,
    options.createProject === true
  );
  await openApiTokenForm(page, tokenName, options.permission);
}

async function openConsole(
  projectName: string
): Promise<ConsoleBrowserSession> {
  const session = await launchConsoleBrowser(HETZNER_CLOUD_CONSOLE_URL);

  console.log("");
  console.log("A local real-browser session is open.");
  console.log("Use the browser to log in to Hetzner Cloud, including 2FA.");
  console.log("hctl does not control the browser until you press Enter.");
  console.log(`After login, hctl will prepare project '${projectName}'.`);
  console.log("");
  console.log(
    "Leave the browser open until you have copied the generated token."
  );
  return session;
}

export async function runCloudTokenBootstrap(
  options: CloudTokenBootstrapOptions
): Promise<boolean> {
  const tokenName =
    options.tokenName ?? `hctl-${options.projectName.toLowerCase()}`;
  const permissionLabel =
    options.permission === "read-write" ? "Read & Write" : "Read";

  console.log("");
  console.log("Assisted Hetzner Cloud API Token Bootstrap");
  console.log("");
  console.log("This opens a visible local real-browser session.");
  console.log("hctl does not ask for or store your Hetzner console password.");
  console.log("hctl does not scrape the one-time token from the page.");
  console.log(
    "After Hetzner shows the token, copy it yourself and paste it into the hidden prompt."
  );
  console.log("");
  console.log(`Project: ${options.projectName}`);
  console.log(
    `Create project if missing: ${options.createProject ? "yes" : "no"}`
  );
  console.log(`Token name: ${tokenName}`);
  console.log(`Token permission: ${permissionLabel}`);
  console.log(`Context to save: ${options.contextName}`);
  if (options.envFile) {
    console.log(
      `Also write ${ENV_TOKEN_KEY} to: ${resolveEnvFilePath(options.envFile)}`
    );
  }
  console.log("");

  const proceed = await confirm({
    default: false,
    message:
      "Open the Hetzner Cloud Console in a local real-browser session and continue?",
  });
  if (!proceed) {
    console.log("Aborted.");
    return false;
  }

  const session = await openConsole(options.projectName);

  try {
    await input({
      message:
        "After logging in to Hetzner Cloud in the browser, press Enter to automate project/token setup.",
    });

    const page = await session.attach();
    console.log("Automating Hetzner Console setup...");
    await automateTokenSetup(page, options, tokenName);
    console.log("");
    console.log("The API token form should now be ready in the browser.");
    console.log(`  - Token name: ${tokenName}`);
    console.log(`  - Permission: ${permissionLabel}`);
    console.log("");

    const generateToken = await confirm({
      default: false,
      message: `Generate the '${tokenName}' ${permissionLabel} API token now?`,
    });
    if (!generateToken) {
      console.log("Aborted before token generation.");
      return false;
    }

    await submitApiTokenForm(page);
    console.log(
      "The token was generated. Copy it now; Hetzner shows it only once."
    );
    console.log("");

    const tokenCopied = await confirm({
      default: false,
      message: "Have you copied the generated Hetzner Cloud API token?",
    });
    if (!tokenCopied) {
      console.log("Aborted.");
      return false;
    }

    const token = await password({
      message: "Paste the generated Hetzner Cloud API token:",
      validate: (value) => value.trim().length > 0 || "Token is required",
    });

    if (options.verify !== false) {
      await validateCloudToken(token);
    }

    await createContext(options.contextName, token, { verify: false });

    if (options.envFile) {
      writeEnvToken(resolveEnvFilePath(options.envFile), token);
    }
    return true;
  } finally {
    await session.close();
  }
}
