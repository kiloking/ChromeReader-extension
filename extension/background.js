/**
 * [INPUT]: chrome.* APIs、extract.bundle.js、MiniMax HTTPS API
 * [OUTPUT]: 處理 SUMMARIZE_TAB／GET_TAB_INFO；注入擷取正文並呼叫 chatcompletion_v2
 * [POS]: MV3 service worker，side panel 與 API 的唯一中介
 * [PROTOCOL]: 變更時更新此頭部，然後檢查 CLAUDE.md
 */

const CHAT_PATH = "/v1/text/chatcompletion_v2";
const REQUEST_TIMEOUT_MS = 60_000;

/** 僅允許官方文件列出的兩區域名稱，避免任意 URL 被注入 fetch */
const ALLOWED_API_BASES = new Set([
  "https://api.minimaxi.com",
  "https://api.minimax.io",
]);
/** 粗略限制送出字元，降低 1039 Token 超限；超過則截斷並於 user 訊息註明 */
const MAX_ARTICLE_CHARS = 14_000;

/** MiniMax base_resp.status_code 對照可讀說明 */
const STATUS_HINTS = {
  1000: "未知錯誤，請稍後再試。",
  1001: "請求逾時，請重試。",
  1002: "觸發限流，請稍後再試。",
  1004: "API Key 無效或已過期，請檢查設定。",
  1008: "帳戶餘額不足。",
  1013: "服務內部錯誤，請稍後再試。",
  1027: "輸出內容未通過審核，可嘗試縮短原文或換頁。",
  1039: "Token 超出限制，已截斷原文後再試；若仍失敗請縮短頁面內容。",
  2013: "請求參數錯誤。",
  2049:
    "無效 API Key。請確認：① Key 正確且未過期；②「API 區域」與開戶站一致（platform.minimaxi.com→中國、platform.minimax.io→國際）；③ 金鑰欄勿重複貼上「Bearer 」前綴。",
};

function ensurePanelBehavior() {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
}

ensurePanelBehavior();
chrome.runtime.onInstalled.addListener(ensurePanelBehavior);

/**
 * 使用者常把「Bearer xxx」整串貼進欄位，改為只保留 token。
 * @param {string} raw
 */
function normalizeApiKey(raw) {
  let s = String(raw).trim();
  if (/^bearer\s+/i.test(s)) s = s.replace(/^bearer\s+/i, "").trim();
  return s;
}

/**
 * @param {string} [apiBaseRaw]
 */
function chatCompletionUrl(apiBaseRaw) {
  const base = (apiBaseRaw || "https://api.minimax.io").replace(/\/+$/, "");
  if (!ALLOWED_API_BASES.has(base)) {
    throw new Error("不支援的 API 區域網址。");
  }
  return `${base}${CHAT_PATH}`;
}

/**
 * @param {number} code
 * @param {string} msg
 */
function formatMinimaxError(code, msg) {
  const hint = STATUS_HINTS[code];
  const parts = [`MiniMax 錯誤${code != null ? ` (${code})` : ""}`];
  if (msg) parts.push(msg);
  if (hint) parts.push(hint);
  return parts.join(" — ");
}

/**
 * @param {string} apiKey
 * @param {string} model
 * @param {string} userContent
 * @param {string} [apiBase]
 */
async function callMinimax(apiKey, model, userContent, apiBase) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(chatCompletionUrl(apiBase), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        max_completion_tokens: 2048,
        temperature: 0.5,
        messages: [
          {
            role: "system",
            content: [
              "你是閱讀助理，根據使用者提供的網頁正文做摘要。",
              "請嚴格使用 Markdown 輸出，結構如下：",
              "1) 一行「## 一句話主題」",
              "2) 「## 重點」底下 3–7 條項目符號",
              "3) 「## 可延伸靈感與選題」底下 2–4 條項目符號（具體、可當創作靈感）",
              "4) 若正文標示為截斷版，需在文末簡短註明「摘要僅涵蓋頁面前段，完整度可能不足」。",
              "語言與正文主要語言一致，除非使用者另有指定。",
              "不要虛構正文未出現的專有名詞或數據。",
            ].join("\n"),
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.base_resp?.status_msg || data?.message || res.statusText || "";
      const code = data?.base_resp?.status_code;
      throw new Error(formatMinimaxError(code, msg) || `HTTP ${res.status}`);
    }

    const code = data?.base_resp?.status_code;
    if (code != null && code !== 0) {
      throw new Error(
        formatMinimaxError(code, data?.base_resp?.status_msg || "") ||
          `API status ${code}`
      );
    }

    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("模型未回傳有效內容，請稍後再試。");
    }

    const usage = data?.usage;
    return { summary: text.trim(), usage };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {number} tabId
 */
async function extractFromTab(tabId) {
  // Chrome 要求同一筆 executeScript 只能擇一：files 或 func；先注入再呼叫。
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["extract.bundle.js"],
  });
  const [injected] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const fn = globalThis.__miniMaxExtract;
      if (typeof fn !== "function") return null;
      return fn();
    },
  });
  return injected?.result ?? null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_TAB_INFO") {
    (async () => {
      try {
        const tabId = message.tabId;
        if (tabId == null) {
          sendResponse({ ok: false, error: "缺少分頁 ID。" });
          return;
        }
        const tab = await chrome.tabs.get(tabId);
        sendResponse({
          ok: true,
          title: tab.title || "",
          url: tab.url || "",
        });
      } catch (e) {
        sendResponse({
          ok: false,
          error: e?.message || String(e),
        });
      }
    })();
    return true;
  }

  if (message?.type === "SUMMARIZE_TAB") {
    (async () => {
      try {
        const { tabId, apiKey, model, outputLang, apiBase } = message;
        const token = normalizeApiKey(apiKey || "");
        if (!token) {
          sendResponse({ ok: false, error: "請先填寫 API Key。" });
          return;
        }
        const modelId = (model || "M2-her").trim();

        const extracted = await extractFromTab(tabId);
        if (!extracted || (!extracted.text && !extracted.title)) {
          sendResponse({
            ok: false,
            error: "無法從此頁擷取正文（可能為受限頁面如 chrome:// 或商店頁）。",
          });
          return;
        }

        let bodyText = extracted.text || "";
        let truncatedNote = "";
        if (bodyText.length > MAX_ARTICLE_CHARS) {
          bodyText = bodyText.slice(0, MAX_ARTICLE_CHARS);
          truncatedNote = `\n\n[系統註：正文已截斷為前 ${MAX_ARTICLE_CHARS} 字，原文更長。]\n`;
        }

        const langLine =
          outputLang && outputLang !== "auto"
            ? `輸出語言請使用：${outputLang}。\n`
            : "";

        const userContent = [
          langLine,
          `頁面標題：${extracted.title || "(無標題)"}`,
          "",
          "正文如下：",
          bodyText,
          truncatedNote,
        ].join("\n");

        const { summary, usage } = await callMinimax(
          token,
          modelId,
          userContent,
          apiBase
        );
        sendResponse({ ok: true, summary, usage, excerptLen: bodyText.length });
      } catch (e) {
        const errMsg =
          e?.name === "AbortError"
            ? "請求逾時，請重試。"
            : e?.message || String(e);
        sendResponse({ ok: false, error: errMsg });
      }
    })();
    return true;
  }

  return false;
});
