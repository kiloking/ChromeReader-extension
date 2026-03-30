# 前言

這個工具是透過Cusror(Compose 2) Vibe coding 出來的 Chrome 瀏覽器插件，主要支援套用 Minimax api，將當前樓懶的網頁總結(主要是想針對文章)，可以本機產生插件後，自行載入插件後使用，沒有什麼特殊功能，隨插即用，用完即丟。

會不會再更新，不一定。

# MiniMax 文章側欄總結（Chrome 擴充）

在瀏覽文章時，用 Chrome **側邊面板**一鍵擷取網頁正文，呼叫 **MiniMax** 文字 API 產生 Markdown 重點與靈感片段，並可複製。API Key 只放在本機（`chrome.storage.local`），不經伺服器、也不上傳你的摘要歷史。

## 你需要準備

- **Google Chrome**（建議 **114+**，需支援 Side Panel API）
- **Node.js**（建議 18+）：**只**用來安裝依賴並打包正文擷取腳本（[@mozilla/readability](https://github.com/mozilla/readability)）
- **MiniMax API Key**：依你的帳戶在對應平台申請
  - 國際區：[platform.minimax.io](https://platform.minimax.io) → 接口密钥（預設 API 網域為 `https://api.minimax.io`）
  - 中國區：[platform.minimaxi.com](https://platform.minimaxi.com) → 接口密钥（`https://api.minimaxi.com`）  
    Key 與「API 區域」必須一致，否則可能出現錯誤碼 `2049`（invalid api key）。

## 本機安裝步驟

```bash
git clone https://github.com/kiloking/ChromeReader-extension.git
cd readme-app
npm install
npm run build:extract
npm run icons
```

- `build:extract`：將 `src/extract-entry.js` 打包成 `extension/extract.bundle.js`（供分頁內注入、擷取正文）。
- `icons`：產生 `extension/icons/*.png`（若你已把圖示一併提交到 repo，可略過）。

### 載入擴充

1. 開啟 `chrome://extensions`
2. 開啟右上角 **開發人員模式**
3. **載入未封裝項目**
4. 選取專案內的 **`extension`** 資料夾（不是 repo 根目錄）

### 使用方式

1. 點工具列上的擴充圖示，開啟**側邊面板**
2. 選對 **API 區域**，貼上 **API Key**（只需 token，不要加 `Bearer ` 前綴；程式會自動去掉誤貼的前綴）
3. 在要閱讀的分頁按 **總結此頁**，完成後可用 **複製全文**

側欄面板要顯示在左或右，由 Chrome 設定決定：**設定 → 外觀 → 側邊面板**（見 [Chrome 說明](https://support.google.com/chrome/answer/13156494?hl=zh-Hant)）。

## 開發備註

- 修改 `src/extract-entry.js` 後請再執行 `npm run build:extract`。
- 專案結構與模組說明見根目錄 [CLAUDE.md](CLAUDE.md)。

## 注意事項

- 請勿將 API Key 提交到公開 repo；Key 僅存於瀏覽器本機。
- 長文會在背景工作器內截斷後再送模型，以降低 token 上限錯誤；實際上限視 MiniMax 帳戶與模型而定。
