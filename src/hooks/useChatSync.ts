import { useEffect, useRef } from 'react';
import { db, type ChatMessage } from '../db';

/**
 * 封裝所有 WebSocket 同步與歷史補回邏輯
 */
export function useChatSync(isLeader: boolean) {
  const wsRef = useRef<WebSocket | null>(null);
  const isSyncingRef = useRef(false);
  const needsSyncAgainRef = useRef(false);

  // --- 同步核心邏輯 ---
  const syncLocalMessages = async () => {
    if (!isLeader || wsRef.current?.readyState !== WebSocket.OPEN) return;

    if (isSyncingRef.current) {
      needsSyncAgainRef.current = true;
      return;
    }

    isSyncingRef.current = true;
    try {
      do {
        needsSyncAgainRef.current = false;
        const unsyncedMessages = await db.messages.where('status').equals('local').toArray();
        
        if (unsyncedMessages.length > 0) {
          for (const msg of unsyncedMessages) {
            wsRef.current.send(JSON.stringify(msg));
            await db.messages.update(msg.id, { status: 'synced' });
          }
        }
      } while (needsSyncAgainRef.current);
    } catch (err) {
      console.error('同步失敗:', err);
    } finally {
      isSyncingRef.current = false;
    }
  };

  // --- WebSocket 生命週期 ---
  useEffect(() => {
    if (!isLeader) return;

    const ws = new WebSocket('ws://localhost:8080');
    wsRef.current = ws;

    ws.onopen = async () => {
      console.log('Leader 連線成功，開始補齊歷史...');
      const lastMsg = await db.messages.orderBy('timestamp').reverse().limit(1).toArray();
      const lastTimestamp = lastMsg.length > 0 ? lastMsg[0].timestamp : 0;
      
      ws.send(JSON.stringify({ type: 'SYNC_REQUEST', lastTimestamp }));
      syncLocalMessages();
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SYNC_RESPONSE') {
          for (const msg of data.messages) {
            const exists = await db.messages.get(msg.id);
            if (!exists) await db.messages.put({ ...msg, status: 'synced' });
          }
        } else {
          const exists = await db.messages.get(data.id);
          if (!exists) await db.messages.put({ ...data, status: 'synced' });
        }
      } catch (err) {
        console.error('WS 訊息解析錯誤:', err);
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [isLeader]);

  // --- 定期保險檢查 ---
  useEffect(() => {
    if (!isLeader) return;
    const interval = setInterval(syncLocalMessages, 2000);
    return () => clearInterval(interval);
  }, [isLeader]);

  return { syncLocalMessages };
}
