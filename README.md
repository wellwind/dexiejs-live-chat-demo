# 🌟 Live DB Chat Demo (Dexie.js + Web Locks API)

這是一個展示 **「離線優先 (Offline-first)」** 與 **「多視窗即時同步 (Multi-tab Sync)」** 的即時聊天室 Demo。

本專案的核心挑戰在於：如何在不依賴後端即時推播給「所有」分頁的情況下，讓同一台電腦上的不同瀏覽器分頁能夠共享資料庫狀態，並自動選舉出唯一的 **Leader (連線代理人)** 與伺服器通訊。

---

## 🚀 核心特性

1.  **多視窗秒級同步 (Dexie.js)**：
    *   利用 IndexedDB 作為單一真理來源 (Single Source of Truth)。
    *   透過 `dexie-react-hooks` 的 `useLiveQuery`，任何分頁寫入訊息，其他所有分頁都會在不需後端參與的情況下立即更新 UI。

2.  **主導者選舉 (Web Locks API)**：
    *   使用原生的 `navigator.locks` 競爭機制。
    *   同一個網域下，只有一個分頁能獲得 `chat_leader_lock` 鎖並成為 **Leader**。
    *   **高可用性**：當 Leader 分頁被關閉或崩潰時，瀏覽器自動釋放鎖，下一個排隊的分頁會立即自動接手成為 Leader 並重連 WebSocket。

3.  **離線優先寫入 (Local First)**：
    *   所有訊息在發送時優先寫入本地資料庫，狀態標記為 `local`。
    *   Leader 負責掃描資料庫並將 `local` 訊息同步至遠端，同步後標記為 `synced`。

4.  **斷線補齊機制 (History Catch-up)**：
    *   當新的 Leader 產生並連線時，會主動向伺服器請求「離線期間 (Disconnection Gap)」所漏掉的所有訊息。
    *   伺服器會根據 Client 提供的小時戳 (Timestamp) 補發缺失的資料，確保跨分頁、跨瀏覽器的資料一致性。

---

## 🛠 技術棧

*   **Frontend**: React 19, TypeScript, Vite
*   **Database**: Dexie.js (IndexedDB wrapper)
*   **Real-time**: WebSocket API
*   **Election**: Web Locks API
*   **Mock Backend**: Node.js + `ws`

---

## 🏃 如何執行

### 1. 安裝相依套件
```bash
npm install
```

### 2. 啟動 Mock WebSocket 伺服器
```bash
npm run server
```

### 3. 啟動 React 前端開發伺服器
```bash
npm run dev
```

---

## 🧪 測試場景建議

1.  **基礎同步**：開啟分頁 A 與分頁 B，輸入相同的姓名。在 A 發送訊息，B 會立即看到。
2.  **Leader 轉移**：
    *   觀察分頁上方的狀態。只會有一個分頁顯示「🌟 我是連線代理人」。
    *   手動關閉這個 Leader 分頁。
    *   觀察剩餘的分頁，其中一個會立刻跳轉為新 Leader 並顯示「WebSocket 已連線」。
3.  **離線訊息補回**：
    *   關閉瀏覽器 A 的所有分頁。
    *   使用瀏覽器 B (或另一個無痕視窗) 發送數筆訊息。
    *   重新開啟瀏覽器 A 的分頁。
    *   **結果**：分頁 A 會在連線瞬間「補齊」剛才漏掉的所有對話。
4.  **清空資料**：點擊底部的「🗑 清空對話」，所有分頁的 IndexedDB 都會被清空並同步 UI。

---

## 📂 專案結構

```text
├── src/
│   ├── db.ts           # Dexie 資料庫定義與 Schema
│   ├── hooks/
│   │   └── useLeader.ts # Web Locks 選舉邏輯
│   ├── components/
│   │   └── ChatRoom.tsx # 聊天室主邏輯 (Sync, WS, UI)
│   └── App.tsx         # 使用者登入與進入點
├── server.js           # 具備歷史記憶與補發功能的 Mock Server
└── README.md
```

---

## 📝 授權

MIT
