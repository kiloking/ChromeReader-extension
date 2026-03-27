/**
 * [INPUT]: chrome.storage、chrome.tabs、chrome.runtime 與 sidepanel.html DOM
 * [OUTPUT]: 側欄 UI 行為：載入設定、總結按鈕、複製、分頁資訊同步
 * [POS]: extension 使用者介面層，僅透過 message 與 background 通訊
 * [PROTOCOL]: 變更時更新此頭部，然後檢查 CLAUDE.md
 */

const STORAGE_KEYS = {
  apiBase: "minimaxApiBase",
  apiKey: "minimaxApiKey",
  model: "minimaxModel",
};

const $ = (id) => document.getElementById(id);

const apiBaseEl = $("apiBase");
const apiKeyEl = $("apiKey");
const modelEl = $("model");
const outputLangEl = $("outputLang");
const summarizeBtn = $("summarizeBtn");
const copyBtn = $("copyBtn");
const resultEl = $("result");
const errorMsg = $("errorMsg");
const tabMeta = $("tabMeta");
const usageMeta = $("usageMeta");
const outputSection = $("outputSection");

function showError(text) {
  if (!text) {
    errorMsg.hidden = true;
    errorMsg.textContent = "";
    return;
  }
  errorMsg.hidden = false;
  errorMsg.textContent = text;
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return tabs[0]?.id ?? null;
}

async function refreshTabMeta() {
  const tabId = await getActiveTabId();
  if (tabId == null) {
    tabMeta.textContent = "找不到使用中分頁。";
    return null;
  }
  try {
    const res = await chrome.runtime.sendMessage({
      type: "GET_TAB_INFO",
      tabId,
    });
    if (res?.ok) {
      tabMeta.textContent = `${res.title || "(無標題)"}\n${res.url || ""}`;
    } else {
      tabMeta.textContent = res?.error || "無法讀取分頁。";
    }
  } catch (e) {
    tabMeta.textContent = e?.message || String(e);
  }
  return tabId;
}

async function loadSettings() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.apiBase,
    STORAGE_KEYS.apiKey,
    STORAGE_KEYS.model,
  ]);
  if (
    data[STORAGE_KEYS.apiBase] &&
    Array.from(apiBaseEl.options).some(
      (o) => o.value === data[STORAGE_KEYS.apiBase]
    )
  ) {
    apiBaseEl.value = data[STORAGE_KEYS.apiBase];
  }
  if (data[STORAGE_KEYS.apiKey]) {
    apiKeyEl.value = data[STORAGE_KEYS.apiKey];
  }
  modelEl.value = data[STORAGE_KEYS.model] || "M2-her";
}

async function persistSettings() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.apiBase]: apiBaseEl.value.trim(),
    [STORAGE_KEYS.apiKey]: apiKeyEl.value.trim(),
    [STORAGE_KEYS.model]: modelEl.value.trim() || "M2-her",
  });
}

async function onSummarize() {
  showError("");
  const tabId = await getActiveTabId();
  if (tabId == null) {
    showError("請先切到有網頁的分頁。");
    return;
  }

  await persistSettings();
  const apiKey = apiKeyEl.value.trim();
  if (!apiKey) {
    showError("請填寫 API Key。");
    return;
  }

  summarizeBtn.disabled = true;
  summarizeBtn.textContent = "總結中…";
  outputSection.hidden = true;
  usageMeta.textContent = "";

  try {
    const res = await chrome.runtime.sendMessage({
      type: "SUMMARIZE_TAB",
      tabId,
      apiKey,
      apiBase: apiBaseEl.value.trim(),
      model: modelEl.value.trim() || "M2-her",
      outputLang: outputLangEl.value,
    });

    if (!res?.ok) {
      showError(res?.error || "總結失敗。");
      return;
    }

    resultEl.value = res.summary || "";
    outputSection.hidden = false;
    const u = res.usage;
    if (u && typeof u.total_tokens === "number") {
      usageMeta.textContent = `上次消耗約 ${u.total_tokens} tokens`;
    } else if (res.excerptLen != null) {
      usageMeta.textContent = `送入模型約 ${res.excerptLen} 字`;
    }
  } catch (e) {
    showError(e?.message || String(e));
  } finally {
    summarizeBtn.disabled = false;
    summarizeBtn.textContent = "總結此頁";
  }
}

async function onCopy() {
  const t = resultEl.value;
  if (!t) return;
  try {
    await navigator.clipboard.writeText(t);
    const prev = copyBtn.textContent;
    copyBtn.textContent = "已複製";
    setTimeout(() => {
      copyBtn.textContent = prev;
    }, 1600);
  } catch {
    showError("複製失敗，請手動選取文字。");
  }
}

function wireEvents() {
  summarizeBtn.addEventListener("click", () => onSummarize());
  copyBtn.addEventListener("click", () => onCopy());
  apiBaseEl.addEventListener("change", () => persistSettings());
  apiKeyEl.addEventListener("change", () => persistSettings());
  modelEl.addEventListener("change", () => persistSettings());

  chrome.tabs.onActivated.addListener(() => {
    refreshTabMeta();
  });
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === "complete") {
      getActiveTabId().then((id) => {
        if (id === tabId) refreshTabMeta();
      });
    }
  });
}

async function init() {
  wireEvents();
  await loadSettings();
  await refreshTabMeta();
}

init();
