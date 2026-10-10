import { describe, expect, it } from "vitest";
import { projectProfilePrompt, standards2026, type ProjectProfile } from "@/lib/prompts";

const full: ProjectProfile = {
  name: "Điện Thoại Giá Kho",
  domain: "giakho.vn",
  industry: "Bán lẻ điện thoại",
  locale: "vi-VN",
  brandVoice: "Thân thiện, chuyên gia",
  entityProfile: { organization: "Giá Kho Group", products: ["iPhone", "Samsung"], authors: ["Chuyên gia Giá Kho"], sameAs: ["https://facebook.com/giakho"] },
};

describe("projectProfilePrompt", () => {
  it("hồ sơ đầy đủ → in mọi dòng theo đúng thứ tự", () => {
    const p = projectProfilePrompt(full);
    expect(p.split("\n")).toEqual([
      "# Hồ sơ dự án",
      "- Tên: Điện Thoại Giá Kho",
      "- Domain: giakho.vn",
      "- Ngành: Bán lẻ điện thoại",
      "- Ngôn ngữ/thị trường: vi-VN",
      "- Giọng văn thương hiệu: Thân thiện, chuyên gia",
      "- Tổ chức: Giá Kho Group",
      "- Sản phẩm/dịch vụ: iPhone, Samsung",
      "- Tác giả/chuyên gia: Chuyên gia Giá Kho",
      "- sameAs: https://facebook.com/giakho",
    ]);
  });

  it("hồ sơ tối thiểu → chỉ tên và locale, không có dòng rỗng/'null'", () => {
    const p = projectProfilePrompt({ name: "A", locale: "en-US" });
    expect(p).toBe("# Hồ sơ dự án\n- Tên: A\n- Ngôn ngữ/thị trường: en-US");
    expect(p).not.toMatch(/null|undefined/);
  });

  it("entityProfile null hoặc mảng rỗng → bỏ qua các dòng thực thể", () => {
    const p = projectProfilePrompt({ name: "A", locale: "vi-VN", domain: null, entityProfile: { products: [], authors: [], sameAs: [] } });
    expect(p).not.toContain("Sản phẩm");
    expect(p).not.toContain("Tác giả");
    expect(p).not.toContain("sameAs");
    expect(projectProfilePrompt({ name: "A", locale: "vi-VN", entityProfile: null })).not.toContain("Tổ chức");
  });

  it("là prompt ổn định (deterministic) để cache", () => {
    expect(projectProfilePrompt(full)).toBe(projectProfilePrompt(full));
  });
});

describe("standards2026", () => {
  it("đọc prompts/standards-2026.md (theo cwd = web) và cache kết quả", () => {
    const s = standards2026();
    expect(s.length).toBeGreaterThan(500);
    expect(s).toMatch(/2026/);
    expect(standards2026()).toBe(s);
  });
});
