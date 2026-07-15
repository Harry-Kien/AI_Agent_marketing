const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "docs", "TAI_LIEU_THIET_KE_VA_TRINH_BAY_HE_THONG_AI_AGENT_MARKETING_2026.md");
const outputDir = path.join(root, "docs", "assets", "thesis-diagrams");
fs.mkdirSync(outputDir, { recursive: true });

function extractDiagrams(markdown) {
  const lines = markdown.split(/\r?\n/);
  const diagrams = [];
  let heading = "Sơ đồ hệ thống";
  for (let i = 0; i < lines.length; i += 1) {
    if (/^#{1,3}\s+/.test(lines[i])) heading = lines[i].replace(/^#{1,3}\s+/, "").trim();
    if (lines[i].trim() !== "```mermaid") continue;
    const code = [];
    i += 1;
    while (i < lines.length && lines[i].trim() !== "```") {
      code.push(lines[i]);
      i += 1;
    }
    diagrams.push({ heading, code: code.join("\n") });
  }
  return diagrams;
}

async function main() {
  const diagrams = extractDiagrams(fs.readFileSync(source, "utf8"));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 1.5 });
  await page.setContent("<!doctype html><html><head></head><body></body></html>");
  await page.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js" });
  await page.evaluate(() => {
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "base",
      themeVariables: {
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        primaryColor: "#E8F1F8",
        primaryTextColor: "#172A3A",
        primaryBorderColor: "#3276A8",
        lineColor: "#526979",
        secondaryColor: "#EAF5EF",
        tertiaryColor: "#FFF4D9",
        actorBkg: "#E8F1F8",
        actorBorder: "#3276A8",
        actorTextColor: "#172A3A",
        signalColor: "#29495F",
        signalTextColor: "#172A3A",
        noteBkgColor: "#FFF4D9",
        noteBorderColor: "#D59B2B"
      },
      flowchart: { htmlLabels: true, curve: "basis", useMaxWidth: false },
      sequence: { useMaxWidth: false, wrap: true, diagramMarginX: 40, actorMargin: 55 }
    });
  });

  const mapping = [];
  for (let index = 0; index < diagrams.length; index += 1) {
    const item = diagrams[index];
    const filename = `diagram-${String(index + 1).padStart(2, "0")}.png`;
    const target = path.join(outputDir, filename);
    const svg = await page.evaluate(async ({ id, code }) => {
      const result = await window.mermaid.render(id, code);
      return result.svg;
    }, { id: `thesis-diagram-${index + 1}`, code: item.code });
    await page.setContent(`<!doctype html><html><head><style>
      body{margin:0;padding:32px;background:#fff;font-family:Arial,sans-serif;}
      #frame{display:inline-block;padding:20px;border:1px solid #d7e1e8;background:#fff;}
      svg{max-width:none!important;height:auto!important;}
    </style></head><body><div id="frame">${svg}</div></body></html>`);
    await page.locator("#frame").screenshot({ path: target });
    mapping.push({ index: index + 1, heading: item.heading, file: filename });
  }
  fs.writeFileSync(path.join(outputDir, "mapping.json"), JSON.stringify(mapping, null, 2), "utf8");
  await browser.close();
  console.log(`Rendered ${mapping.length} diagrams to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
