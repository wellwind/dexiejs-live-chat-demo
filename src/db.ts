import Dexie, { type EntityTable } from 'dexie';

export interface ChatMessage {
  id: string;          // UUID
  sender: string;      // 發送者姓名
  content: string;     // 訊息內容
  timestamp: number;   // 時間戳
  status: 'local' | 'synced'; // 同步狀態
}

const db = new Dexie('ChatDemoDB') as Dexie & {
  messages: EntityTable<ChatMessage, 'id'>;
};

// Schema Definition
db.version(1).stores({
  messages: 'id, sender, timestamp, status' // 定義索引欄位
});

export { db };
