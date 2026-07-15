const fs = require("node:fs");
const path = require("node:path");
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} = require("docx");

const root = path.resolve(__dirname, "..");
const markdownPath = path.join(root, "docs", "TAI_LIEU_THIET_KE_VA_TRINH_BAY_HE_THONG_AI_AGENT_MARKETING_2026.md");
const diagramDir = path.join(root, "docs", "assets", "thesis-diagrams");
const outputPath = path.join(root, "docs", "AI_Agent_Marketing_Command_Center_Thesis_Design_2026.docx");
const contentWidth = 9026;
const blue = "1F5D7A";
const dark = "18313F";
const lightBlue = "E9F2F7";
const green = "E7F3EC";
const amber = "FFF3D6";
const gray = "F3F6F8";

const border = { style: BorderStyle.SINGLE, size: 4, color: "C8D5DD" };
const borders = { top: border, bottom: border, left: border, right: border };

function inlineRuns(text, options = {}) {
  const runs = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let cursor = 0;
  for (const match of text.matchAll(regex)) {
    if (match.index > cursor) runs.push(new TextRun({ text: text.slice(cursor, match.index), ...options }));
    const token = match[0];
    if (token.startsWith("**")) {
      runs.push(new TextRun({ text: token.slice(2, -2), bold: true, ...options }));
    } else {
      runs.push(new TextRun({ text: token.slice(1, -1), font: "Consolas", color: "24566E", ...options }));
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) runs.push(new TextRun({ text: text.slice(cursor), ...options }));
  return runs.length ? runs : [new TextRun({ text, ...options })];
}

function normalParagraph(text, options = {}) {
  return new Paragraph({
    alignment: options.alignment ?? AlignmentType.JUSTIFIED,
    spacing: { after: 130, line: 330 },
    keepNext: options.keepNext,
    children: inlineRuns(text)
  });
}

function heading(text, level) {
  const majorBreak = /^(8|11|16|19|24|27)\./.test(text) || /^Phụ lục/.test(text);
  return new Paragraph({
    heading: level,
    pageBreakBefore: level === HeadingLevel.HEADING_1 && majorBreak,
    keepNext: true,
    children: [new TextRun(text)]
  });
}

function listParagraph(text, reference, level = 0) {
  return new Paragraph({
    numbering: { reference, level },
    spacing: { after: 80, line: 300 },
    children: inlineRuns(text)
  });
}

function codeParagraph(text) {
  return new Paragraph({
    shading: { fill: "EEF3F6", type: ShadingType.CLEAR },
    border: {
      left: { style: BorderStyle.SINGLE, size: 12, color: "5C8BA5", space: 8 }
    },
    indent: { left: 240, right: 120 },
    spacing: { after: 0, line: 260 },
    children: [new TextRun({ text: text || " ", font: "Consolas", size: 18, color: "223C49" })]
  });
}

function tableFromLines(lines) {
  const rows = lines
    .map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()))
    .filter((cells, index) => !(index === 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))));
  const columnCount = Math.max(...rows.map((row) => row.length));
  const base = Math.floor(contentWidth / columnCount);
  const widths = Array(columnCount).fill(base);
  widths[widths.length - 1] += contentWidth - widths.reduce((sum, value) => sum + value, 0);
  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((row, rowIndex) => new TableRow({
      cantSplit: true,
      children: widths.map((width, columnIndex) => new TableCell({
        width: { size: width, type: WidthType.DXA },
        borders,
        verticalAlign: VerticalAlign.CENTER,
        shading: rowIndex === 0 ? { fill: blue, type: ShadingType.CLEAR } : undefined,
        margins: { top: 85, bottom: 85, left: 100, right: 100 },
        children: [new Paragraph({
          spacing: { after: 0, line: 250 },
          children: inlineRuns(row[columnIndex] ?? "", {
            size: columnCount >= 5 ? 16 : 18,
            color: rowIndex === 0 ? "FFFFFF" : dark,
            bold: rowIndex === 0
          })
        })]
      }))
    }))
  });
}

function pngDimensions(data) {
  if (data.length < 24 || data.toString("ascii", 1, 4) !== "PNG") {
    return { width: 1200, height: 700 };
  }
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

async function imageParagraph(file, title) {
  const data = fs.readFileSync(file);
  const metadata = pngDimensions(data);
  const sourceWidth = metadata.width || 1200;
  const sourceHeight = metadata.height || 700;
  let width = 650;
  let height = Math.round(width * sourceHeight / sourceWidth);
  if (height > 710) {
    height = 710;
    width = Math.round(height * sourceWidth / sourceHeight);
  }
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 80 },
      children: [new ImageRun({
        type: "png",
        data,
        transformation: { width, height },
        altText: { title, description: title, name: title }
      })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [new TextRun({ text: title, italics: true, color: "526979", size: 19 })]
    })
  ];
}

function cover() {
  const statusTable = new Table({
    width: { size: 7200, type: WidthType.DXA },
    columnWidths: [2400, 2400, 2400],
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({ children: [
        ["6/6", "Telegram Agent", lightBlue],
        ["80/80", "Automated Tests", green],
        ["READY", "Controlled Publish", amber]
      ].map(([value, label, fill]) => new TableCell({
        width: { size: 2400, type: WidthType.DXA },
        borders,
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 150, bottom: 150, left: 100, right: 100 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: value, bold: true, size: 28, color: blue })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: label, size: 18, color: dark })] })
        ]
      })) })
    ]
  });
  return [
    new Paragraph({ spacing: { before: 700, after: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "TÀI LIỆU THIẾT KẾ HỆ THỐNG", bold: true, size: 28, color: blue })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: "AI AGENT MARKETING", bold: true, size: 50, color: dark })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "COMMAND CENTER", bold: true, size: 44, color: blue })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 }, children: [new TextRun({ text: "Hệ thống đa tác nhân AI hỗ trợ vận hành phòng Marketing doanh nghiệp qua Telegram", size: 25, color: "526979" })] }),
    statusTable,
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 80 }, children: [new TextRun({ text: "Tài liệu phục vụ khóa luận và thuyết trình", bold: true, size: 23, color: dark })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "Nhóm thực hiện: 02 thành viên", size: 21, color: "526979" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "Phiên bản 1.0 · Tháng 07/2026", size: 21, color: "526979" })] }),
    new Paragraph({ children: [new PageBreak()] })
  ];
}

async function parseMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const children = [];
  let paragraphBuffer = [];
  let diagramIndex = 0;
  let skippedMainTitle = false;

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    children.push(normalParagraph(paragraphBuffer.join(" ").trim()));
    paragraphBuffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    if (line.trim() === "---") {
      flushParagraph();
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      if (!skippedMainTitle) { skippedMainTitle = true; continue; }
      children.push(heading(line.slice(2), HeadingLevel.TITLE));
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      children.push(heading(line.slice(3), HeadingLevel.HEADING_1));
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      children.push(heading(line.slice(4), HeadingLevel.HEADING_2));
      continue;
    }
    if (line.startsWith("#### ")) {
      flushParagraph();
      children.push(heading(line.slice(5), HeadingLevel.HEADING_3));
      continue;
    }
    if (line.trim().startsWith("```")) {
      flushParagraph();
      const language = line.trim().slice(3).trim();
      const block = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== "```") {
        block.push(lines[index]);
        index += 1;
      }
      if (language === "mermaid") {
        diagramIndex += 1;
        const file = path.join(diagramDir, `diagram-${String(diagramIndex).padStart(2, "0")}.png`);
        const title = `Hình ${diagramIndex}. Sơ đồ hệ thống`;
        children.push(...await imageParagraph(file, title));
      } else {
        block.forEach((codeLine) => children.push(codeParagraph(codeLine)));
        children.push(new Paragraph({ spacing: { after: 120 } }));
      }
      continue;
    }
    if (line.trim().startsWith("|") && lines[index + 1]?.trim().startsWith("|")) {
      flushParagraph();
      const tableLines = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }
      index -= 1;
      children.push(tableFromLines(tableLines));
      children.push(new Paragraph({ spacing: { after: 160 } }));
      continue;
    }
    const bullet = line.match(/^\s*-\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      children.push(listParagraph(bullet[1], "bullet-list"));
      continue;
    }
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      children.push(listParagraph(numbered[1], "number-list"));
      continue;
    }
    if (line.startsWith("> ")) {
      flushParagraph();
      children.push(new Paragraph({
        shading: { fill: amber, type: ShadingType.CLEAR },
        border: { left: { style: BorderStyle.SINGLE, size: 14, color: "D39A2C", space: 8 } },
        indent: { left: 260, right: 160 },
        spacing: { before: 80, after: 120, line: 310 },
        children: inlineRuns(line.slice(2), { italics: true })
      }));
      continue;
    }
    paragraphBuffer.push(line.trim().replace(/\s{2,}$/, ""));
  }
  flushParagraph();
  return children;
}

async function main() {
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const body = await parseMarkdown(markdown);
  const doc = new Document({
    creator: "AI Marketing Command Center Project Team",
    title: "AI Agent Marketing Command Center - Tài liệu thiết kế hệ thống",
    description: "Tài liệu thiết kế, diagram, kiểm thử và kịch bản trình bày khóa luận",
    styles: {
      default: { document: { run: { font: "Arial", size: 22, color: dark } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 42, bold: true, color: dark }, paragraph: { spacing: { before: 280, after: 240 }, outlineLevel: 0 } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 31, bold: true, color: blue }, paragraph: { spacing: { before: 260, after: 150 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "8DB3C7", space: 6 } } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 27, bold: true, color: dark }, paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 24, bold: true, color: "42677B" }, paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 2 } }
      ]
    },
    numbering: {
      config: [
        { reference: "bullet-list", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 260 } } } }] },
        { reference: "number-list", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 620, hanging: 300 } } } }] }
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1000, right: 1440, bottom: 1000, left: 1440, header: 500, footer: 500 }
        }
      },
      headers: {
        default: new Header({ children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "A9BDC8", space: 4 } },
          children: [new TextRun({ text: "AI AGENT MARKETING COMMAND CENTER", bold: true, size: 17, color: blue })]
        })] })
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Tài liệu thiết kế hệ thống  |  ", size: 17, color: "6B7E88" }), new TextRun({ children: [PageNumber.CURRENT], size: 17, color: "6B7E88" })]
        })] })
      },
      children: [
        ...cover(),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("MỤC LỤC")] }),
        new TableOfContents("", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({ spacing: { before: 180 }, children: [new TextRun({ text: "Lưu ý: Trong Microsoft Word, chọn mục lục và nhấn Update Field để cập nhật số trang.", italics: true, color: "6B7E88", size: 19 })] }),
        new Paragraph({ children: [new PageBreak()] }),
        ...body
      ]
    }]
  });
  fs.writeFileSync(outputPath, await Packer.toBuffer(doc));
  console.log(`Created ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
