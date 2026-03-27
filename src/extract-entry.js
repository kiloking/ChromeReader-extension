/**
 * [INPUT]: 依賴 @mozilla/readability 的 Readability 與瀏覽器 document
 * [OUTPUT]: 掛載 globalThis.__miniMaxExtract，回傳 { title, text, excerpt }
 * [POS]: esbuild 打包進 extension/extract.bundle.js，供 executeScript 注入後呼叫
 * [PROTOCOL]: 變更時更新此頭部，然後檢查 CLAUDE.md
 */
import { Readability } from "@mozilla/readability";

function extractPageArticle() {
  const titleFallback = document.title || "";

  try {
    const clone = document.cloneNode(true);
    const reader = new Readability(clone);
    const article = reader.parse();
    if (article && (article.textContent || "").trim().length > 0) {
      return {
        title: (article.title || titleFallback).trim(),
        text: (article.textContent || "").trim(),
        excerpt: (article.excerpt || "").trim(),
      };
    }
  } catch {
    /* fall through */
  }

  const root =
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.querySelector('[role="main"]') ||
    document.body;
  const text = root ? (root.innerText || "").trim() : "";
  return {
    title: titleFallback.trim(),
    text,
    excerpt: "",
  };
}

globalThis.__miniMaxExtract = extractPageArticle;
