import { describe, expect, it } from "vitest";
import { extractHeadings, firstParagraph, parseFaq, renderMarkdown, slugify, splitSections, stripMarkdown, wordCount } from "@/lib/markdown";

const SAMPLE = `# Tiêu đề H1

Đoạn mở đầu có **đậm** và [link](/noi-bo).

## Mục A

Nội dung A.

\`\`\`
# không phải heading (trong code fence)
\`\`\`

### Mục A.1 ###

## Câu hỏi thường gặp

### Q: Câu hỏi 1?

Trả lời 1.

**Câu hỏi 2?**

Trả lời 2 có *nhấn*.
`;

describe("extractHeadings", () => {
  it("lấy đúng cấp, text và chỉ số dòng; bỏ qua heading trong code fence; cắt dấu # cuối", () => {
    const hs = extractHeadings(SAMPLE);
    expect(hs.map((h) => [h.level, h.text])).toEqual([
      [1, "Tiêu đề H1"],
      [2, "Mục A"],
      [3, "Mục A.1"],
      [2, "Câu hỏi thường gặp"],
      [3, "Q: Câu hỏi 1?"],
    ]);
    expect(hs[0].line).toBe(0);
    expect(hs[1].line).toBe(4);
  });

  it("chuỗi rỗng → []", () => {
    expect(extractHeadings("")).toEqual([]);
  });
});

describe("stripMarkdown", () => {
  it("bỏ ảnh, giữ text của link, bỏ html/emphasis/heading marker/bullet", () => {
    const md = "## Tiêu đề\n\n- Một ![alt](/a.png) **đậm** [liên kết](https://x.vn) <span>html</span> `code`\n\n| a | b |\n|---|---|\n| 1 | 2 |";
    const t = stripMarkdown(md);
    expect(t).not.toMatch(/[#*`|<>]/);
    expect(t).toContain("liên kết");
    expect(t).not.toContain("alt");
    expect(t).not.toContain("https://x.vn");
    expect(t).toContain("Tiêu đề");
  });

  it("bỏ toàn bộ code fence", () => {
    expect(stripMarkdown("Trước\n\n```js\nconst x = 1;\n```\n\nSau")).toBe("Trước Sau");
  });
});

describe("wordCount", () => {
  it("đếm từ sau khi bỏ Markdown", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("   ")).toBe(0);
    expect(wordCount("# Tiêu đề\n\nMột hai ba.")).toBe(5);
    expect(wordCount("**một** [hai](/x) ![ảnh](/i.png)")).toBe(2);
  });
});

describe("slugify", () => {
  it("bỏ dấu tiếng Việt, đổi đ→d, hạ chữ thường, nối bằng gạch ngang", () => {
    expect(slugify("Trả góp iPhone 17 Pro Max 0%")).toBe("tra-gop-iphone-17-pro-max-0");
    expect(slugify("Đà Nẵng – điện thoại")).toBe("da-nang-dien-thoai");
    expect(slugify("  --Hello World--  ")).toBe("hello-world");
  });
  it("cắt tối đa 80 ký tự", () => {
    expect(slugify("a ".repeat(100)).length).toBeLessThanOrEqual(80);
  });
});

describe("splitSections", () => {
  it("chia theo H1/H2; nội dung H3 nằm trong body của H2 cha", () => {
    const secs = splitSections(SAMPLE);
    expect(secs.map((s) => [s.level, s.heading])).toEqual([
      [1, "Tiêu đề H1"],
      [2, "Mục A"],
      [2, "Câu hỏi thường gặp"],
    ]);
    expect(secs[1].body).toContain("Nội dung A.");
    expect(secs[1].body).toContain("### Mục A.1");
    expect(secs[2].body).toContain("Trả lời 2");
  });
  it("không có heading → []", () => {
    expect(splitSections("chỉ có văn bản")).toEqual([]);
  });
});

describe("parseFaq", () => {
  it("nhận câu hỏi dạng H3 (bỏ tiền tố 'Q:') và dạng in đậm; câu trả lời đã strip Markdown", () => {
    const faq = parseFaq(SAMPLE);
    expect(faq).toEqual([
      { question: "Câu hỏi 1?", answer: "Trả lời 1." },
      { question: "Câu hỏi 2?", answer: "Trả lời 2 có nhấn." },
    ]);
  });
  it("nhận heading 'FAQ' tiếng Anh", () => {
    expect(parseFaq("## FAQ\n\n### Why?\n\nBecause.\n")).toEqual([{ question: "Why?", answer: "Because." }]);
  });
  it("không có mục FAQ → []", () => {
    expect(parseFaq("# A\n\n## B\n\n### C?\n\nD")).toEqual([]);
  });
  it("câu hỏi không có câu trả lời bị bỏ qua", () => {
    expect(parseFaq("## Câu hỏi thường gặp\n\n### Một?\n\n### Hai?\n\nTrả lời hai.")).toEqual([{ question: "Hai?", answer: "Trả lời hai." }]);
  });
});

describe("renderMarkdown", () => {
  it("render GFM: heading, bảng, danh sách", () => {
    const html = renderMarkdown("# H1\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- x\n- y");
    expect(html).toContain("<h1>H1</h1>");
    expect(html).toContain("<table>");
    expect(html).toContain("<li>x</li>");
  });
});

describe("firstParagraph", () => {
  it("bỏ qua dòng trống và heading, trả về đoạn đầu đã strip Markdown", () => {
    expect(firstParagraph(SAMPLE)).toBe("Đoạn mở đầu có đậm và link.");
  });
  it("đoạn nhiều dòng được nối lại", () => {
    expect(firstParagraph("\n\n## H\nDòng 1\nDòng 2\n\nĐoạn 2")).toBe("Dòng 1 Dòng 2");
  });
  it("chỉ có heading → chuỗi rỗng", () => {
    expect(firstParagraph("# Chỉ heading")).toBe("");
  });
});
