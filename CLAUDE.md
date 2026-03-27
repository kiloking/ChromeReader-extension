# readme-app - MiniMax 文章側欄總結擴充

Chrome MV3 擴充 + npm 僅用於 esbuild 打包 `@mozilla/readability` 注入腳本。

<directory>
extension/ — 可載入之擴充根目錄：manifest、service worker、側欄 UI、擷取 bundle、圖示  
src/ — `extract-entry.js`：Readability 打包輸入  
scripts/ — `gen-icons.js`：產生 manifest 用 PNG  
</directory>

<config>
package.json — `build:extract` 產生 `extension/extract.bundle.js`  
extension/manifest.json — 權限、side_panel、host_permissions（`https://*/*`、`http://*/*`：注入擷取正文 + 呼叫 MiniMax API）  
extension/background.js — 文字 API：預設 `https://api.minimax.io`（國際）；可改選 `https://api.minimaxi.com`（中國），須與 Key 來源站一致  
</config>

法則: 極簡·穩定·導航·版本精確

[PROTOCOL]: 變更時更新此頭部，然後視情況同步 extension/ 或 CLAUDE.md 子說明
