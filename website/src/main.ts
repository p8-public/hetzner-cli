import "./style.css";
import readmeRaw from "../../README.md?raw";
import { executeCommand } from "./commands.ts";
import { renderMarkdown } from "./markdown.ts";
import { Terminal } from "./terminal.ts";
import { HCTL_VERSION } from "./version.ts";

// NOTE: Terminal output is produced by the command and formatter modules, which
// escape user input and public auction JSON fields before rendering.

const app = document.getElementById("app") as HTMLElement;

// ---- Window Title Bar (macOS-style chrome) ----
const titleBar = document.createElement("div");
titleBar.className = "title-bar";

const trafficLights = document.createElement("div");
trafficLights.className = "traffic-lights";
for (const cls of ["close", "minimize", "maximize"]) {
  const dot = document.createElement("span");
  dot.className = `tl-dot tl-${cls}`;
  trafficLights.appendChild(dot);
}

const titleText = document.createElement("div");
titleText.className = "title-bar-text";
titleText.textContent = "hctl";
const demoBadge = document.createElement("span");
demoBadge.className = "title-demo";
demoBadge.textContent = "DEMO";
titleText.appendChild(demoBadge);

const titleLinks = document.createElement("div");
titleLinks.className = "title-bar-links";
const ghLink = document.createElement("a");
ghLink.href = "https://github.com/ytspar/hetzner-cli";
ghLink.target = "_blank";
ghLink.rel = "noopener";
ghLink.textContent = "GitHub";
const npmLink = document.createElement("a");
npmLink.href = "https://www.npmjs.com/package/@ytspar/hctl";
npmLink.target = "_blank";
npmLink.rel = "noopener";
npmLink.textContent = "npm";
titleLinks.append(ghLink, npmLink);

titleBar.append(trafficLights, titleText, titleLinks);
app.appendChild(titleBar);

// ---- Terminal Container (tmux-style) ----
const tmuxContainer = document.createElement("div");
tmuxContainer.className = "tmux-container";

const tmuxPanels = document.createElement("div");
tmuxPanels.className = "tmux-panels";

// Left panel — terminal
const panelTerminal = document.createElement("div");
panelTerminal.className = "panel-terminal";

const terminalHeader = document.createElement("div");
terminalHeader.className = "panel-header";
const activeIndicator = document.createElement("span");
activeIndicator.className = "active-indicator";
const terminalHeaderTitle = document.createElement("span");
terminalHeaderTitle.className = "panel-title";
terminalHeaderTitle.textContent = "0:terminal";
terminalHeader.append(activeIndicator, terminalHeaderTitle);
panelTerminal.appendChild(terminalHeader);

// Right panel — README
const panelReadme = document.createElement("div");
panelReadme.className = "panel-readme";

const readmeHeader = document.createElement("div");
readmeHeader.className = "panel-header";
const readmeHeaderTitle = document.createElement("span");
readmeHeaderTitle.className = "panel-title";
readmeHeaderTitle.textContent = "1:readme";
readmeHeader.appendChild(readmeHeaderTitle);

const readmeContent = document.createElement("div");
readmeContent.className = "readme-content";
renderMarkdown(readmeRaw, readmeContent);

panelReadme.append(readmeHeader, readmeContent);
tmuxPanels.append(panelTerminal, panelReadme);

// tmux status bar
const tmuxBar = document.createElement("div");
tmuxBar.className = "tmux-bar";

const tmuxLeft = document.createElement("div");
tmuxLeft.className = "tmux-left";
const tmuxSession = document.createElement("span");
tmuxSession.className = "tmux-session";
tmuxSession.textContent = "demo";
const tmuxW0 = document.createElement("span");
tmuxW0.className = "tmux-window active";
tmuxW0.textContent = "0:terminal*";
const tmuxW1 = document.createElement("span");
tmuxW1.className = "tmux-window";
tmuxW1.textContent = "1:readme";
function tmuxBadge(label: string, value: string, href?: string): HTMLElement {
  const el = href
    ? document.createElement("a")
    : document.createElement("span");
  el.className = "tmux-badge";
  if (href) {
    (el as HTMLAnchorElement).href = href;
    (el as HTMLAnchorElement).target = "_blank";
    (el as HTMLAnchorElement).rel = "noopener";
  }
  const labelSpan = document.createElement("span");
  labelSpan.className = "tmux-badge-label";
  labelSpan.textContent = label;
  const valueSpan = document.createElement("span");
  valueSpan.className = "tmux-badge-value";
  valueSpan.textContent = value;
  el.append(labelSpan, valueSpan);
  return el;
}

const badgeVersion = tmuxBadge(
  "version",
  `v${HCTL_VERSION}`,
  "https://www.npmjs.com/package/@ytspar/hctl"
);
const badgeLicense = tmuxBadge(
  "license",
  "MIT",
  "https://github.com/ytspar/hetzner-cli/blob/main/LICENSE"
);
const badgeNode = tmuxBadge("node", ">=20.17");

tmuxLeft.append(
  tmuxSession,
  tmuxW0,
  tmuxW1,
  badgeVersion,
  badgeLicense,
  badgeNode
);

const tmuxRight = document.createElement("div");
tmuxRight.className = "tmux-right";

const installBtn = document.createElement("span");
installBtn.className = "tmux-install";
installBtn.textContent = "npm i -g @ytspar/hctl";
installBtn.title = "Click to copy";
installBtn.addEventListener("click", () => {
  navigator.clipboard.writeText("npm install -g @ytspar/hctl");
  installBtn.textContent = "copied!";
  setTimeout(() => {
    installBtn.textContent = "npm i -g @ytspar/hctl";
  }, 1500);
});

const tmuxHost = document.createElement("span");
tmuxHost.textContent = "demo@hctl";

const ns = "http://www.w3.org/2000/svg";
function pixelIcon(
  viewBox: string,
  shapes: Array<{ tag: string; attrs: Record<string, string> }>
): SVGSVGElement {
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  svg.style.verticalAlign = "middle";
  for (const shape of shapes) {
    const el = document.createElementNS(ns, shape.tag);
    for (const [k, v] of Object.entries(shape.attrs)) {
      el.setAttribute(k, v);
    }
    svg.appendChild(el);
  }
  return svg;
}

const twitterLink = document.createElement("a");
twitterLink.href = "https://twitter.com/ytspar";
twitterLink.target = "_blank";
twitterLink.rel = "noopener";
twitterLink.className = "tmux-social";
twitterLink.appendChild(
  pixelIcon("0 0 24 24", [
    { tag: "rect", attrs: { x: "22", y: "5", width: "1", height: "1" } },
    { tag: "rect", attrs: { x: "22", y: "3", width: "1", height: "1" } },
    {
      tag: "polygon",
      attrs: {
        points:
          "21 5 21 6 22 6 22 7 21 7 21 12 20 12 20 14 19 14 19 16 18 16 18 17 17 17 17 18 16 18 16 19 14 19 14 20 11 20 11 21 4 21 4 20 2 20 2 19 1 19 1 18 3 18 3 19 6 19 6 18 7 18 7 17 5 17 5 16 4 16 4 15 3 15 3 14 5 14 5 13 3 13 3 12 2 12 2 10 4 10 4 9 3 9 3 8 2 8 2 4 3 4 3 5 4 5 4 6 5 6 5 7 7 7 7 8 10 8 10 9 12 9 12 5 13 5 13 4 14 4 14 3 19 3 19 4 22 4 22 5 21 5",
      },
    },
  ])
);

const githubLink = document.createElement("a");
githubLink.href = "https://github.com/ytspar";
githubLink.target = "_blank";
githubLink.rel = "noopener";
githubLink.className = "tmux-social";
githubLink.appendChild(
  pixelIcon("0 0 24 24", [
    {
      tag: "polygon",
      attrs: {
        points:
          "23 9 23 15 22 15 22 17 21 17 21 19 20 19 20 20 19 20 19 21 18 21 18 22 16 22 16 23 15 23 15 18 14 18 14 17 15 17 15 16 17 16 17 15 18 15 18 14 19 14 19 9 18 9 18 6 16 6 16 7 15 7 15 8 14 8 14 7 10 7 10 8 9 8 9 7 8 7 8 6 6 6 6 9 5 9 5 14 6 14 6 15 7 15 7 16 9 16 9 18 7 18 7 17 6 17 6 16 4 16 4 17 5 17 5 19 6 19 6 20 9 20 9 23 8 23 8 22 6 22 6 21 5 21 5 20 4 20 4 19 3 19 3 17 2 17 2 15 1 15 1 9 2 9 2 7 3 7 3 5 4 5 4 4 5 4 5 3 7 3 7 2 9 2 9 1 15 1 15 2 17 2 17 3 19 3 19 4 20 4 20 5 21 5 21 7 22 7 22 9 23 9",
      },
    },
  ])
);

const byLine = document.createElement("span");
byLine.className = "tmux-by";
const copyrightSym = document.createElement("span");
copyrightSym.className = "copyright-sym";
copyrightSym.textContent = "\u00A9";
byLine.append(copyrightSym, ` ${new Date().getFullYear()} ytspar`);

tmuxRight.append(installBtn, tmuxHost, byLine, twitterLink, githubLink);
tmuxBar.append(tmuxLeft, tmuxRight);

tmuxContainer.append(tmuxPanels, tmuxBar);
app.appendChild(tmuxContainer);

// ---- Initialize Terminal ----
const terminal = new Terminal(panelTerminal);

terminal.setCommandHandler((input: string) => {
  if (input === "clear") {
    terminal.clear();
    return "";
  }
  return executeCommand(input);
});

// ---- Boot / Auth Sequence ----
showBootSequence(terminal);

async function showBootSequence(term: Terminal) {
  const output = term.getOutputEl();

  // Show boot logo with blinking cursor
  const bootDiv = document.createElement("div");
  bootDiv.className = "boot-screen";

  const bootLogo = document.createElement("div");
  bootLogo.className = "boot-logo";
  bootLogo.textContent = "hctl";
  const cursorBoot = document.createElement("span");
  cursorBoot.className = "cursor-boot";
  bootLogo.appendChild(cursorBoot);

  const bootHint = document.createElement("div");
  bootHint.className = "boot-hint";
  bootHint.textContent = "press Enter to start";

  bootDiv.append(bootLogo, bootHint);
  output.appendChild(bootDiv);

  // Wait for Enter keypress or click
  await new Promise<void>((resolve) => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        document.removeEventListener("keydown", onKey);
        bootDiv.removeEventListener("click", onClick);
        resolve();
      }
    }
    function onClick() {
      bootDiv.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      resolve();
    }
    document.addEventListener("keydown", onKey);
    bootDiv.addEventListener("click", onClick);
  });

  bootDiv.remove();

  // Auth animation
  const authDiv = document.createElement("div");
  authDiv.className = "auth-output";
  output.appendChild(authDiv);

  const lines = [
    {
      text: `Initializing hctl v${HCTL_VERSION}...`,
      cls: "auth-step",
      delay: 400,
    },
    { text: "  [\u2713] Loading configuration", cls: "auth-ok", delay: 300 },
    {
      text: "  [\u2713] Robot API credentials found",
      cls: "auth-ok",
      delay: 350,
    },
    {
      text: '  [\u2713] Cloud API token loaded (context: "production")',
      cls: "auth-ok",
      delay: 300,
    },
    { text: "", cls: "auth-step", delay: 200 },
    { text: "Authenticating...", cls: "auth-step", delay: 600 },
    { text: "  Robot API: demo@example.com", cls: "auth-user", delay: 350 },
    {
      text: '  Cloud: project "my-project" (5 servers, 2 networks)',
      cls: "auth-info",
      delay: 350,
    },
    { text: "  Auction: hosted cache connected", cls: "auth-info", delay: 300 },
    { text: "", cls: "auth-step", delay: 200 },
    {
      text: "  [\u2713] Authenticated successfully",
      cls: "auth-ok",
      delay: 400,
    },
    { text: "", cls: "auth-step", delay: 150 },
    {
      text: 'Ready. Type "help" for available commands.',
      cls: "auth-info",
      delay: 0,
    },
  ];

  for (const line of lines) {
    await sleep(line.delay);
    const lineEl = document.createElement("div");
    lineEl.className = `auth-line ${line.cls}`;
    lineEl.textContent = line.text;
    authDiv.appendChild(lineEl);
    output.scrollTop = output.scrollHeight;
  }

  await sleep(500);

  // Keep auth output visible as terminal history — just disable the fade-in animation
  for (const child of authDiv.children) {
    (child as HTMLElement).style.animation = "none";
    (child as HTMLElement).style.opacity = "1";
  }

  terminal.enable();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
