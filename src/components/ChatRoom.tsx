import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db, type ChatMessage } from '../db';
import { useLeader } from '../hooks/useLeader';

interface Props {
  currentUser: string;
}

const ChatRoom: React.FC<Props> = ({ currentUser }) => {
  const [inputText, setInputText] = useState('');
  const messages = useLiveQuery(() => db.messages.orderBy('timestamp').toArray());
  const isLeader = useLeader();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    console.log('收到 message 了', messages);
  }, [messages]);

  const isSyncingRef = useRef(false);

  // --- Leader 專屬邏輯：WebSocket 同步 (具備防重發機制) ---
  const syncLocalMessages = async () => {
    if (!isLeader || isSyncingRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
    
    isSyncingRef.current = true;
    try {
      // 1. 找出所有狀態為 'local' 的訊息
      const unsyncedMessages = await db.messages.where('status').equals('local').toArray();
      
      if (unsyncedMessages.length > 0) {
        console.log(`Leader 正在同步 ${unsyncedMessages.length} 筆訊息...`);
        
        for (const msg of unsyncedMessages) {
          // 2. 先將狀態改為 'synced' (這裡採樂觀同步，若失敗後端歷史補回會救回)
          // 或者更嚴謹可以用 'syncing'，但為了 Demo 簡潔我們直接 atomic 更新
          wsRef.current.send(JSON.stringify(msg));
          await db.messages.update(msg.id, { status: 'synced' });
        }
      }
    } catch (err) {
      console.error('同步過程發生錯誤:', err);
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    if (!isLeader) return;

    console.log('Leader 正在建立 WebSocket 連線...');
    const ws = new WebSocket('ws://localhost:8080');
    wsRef.current = ws;

    ws.onopen = async () => {
      console.log('WebSocket 已連線');
      
      // --- 歷史補回 (History Catch-up) ---
      // 找出本地最後一筆訊息的時間戳
      const lastMsg = await db.messages.orderBy('timestamp').reverse().limit(1).toArray();
      const lastTimestamp = lastMsg.length > 0 ? lastMsg[0].timestamp : 0;
      
      console.log(`向伺服器請求補回訊息，從 ${lastTimestamp} 開始...`);
      ws.send(JSON.stringify({ type: 'SYNC_REQUEST', lastTimestamp }));

      // 同時也補發本地 local 訊息
      syncLocalMessages();
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        // 如果是補回訊息的回應
        if (data.type === 'SYNC_RESPONSE') {
          console.log(`補回了 ${data.messages.length} 筆訊息`);
          for (const msg of data.messages) {
            const exists = await db.messages.get(msg.id);
            if (!exists) await db.messages.put({ ...msg, status: 'synced' });
          }
          return;
        }

        // 正常的聊天訊息
        const receivedMsg: ChatMessage = data;
        const exists = await db.messages.get(receivedMsg.id);
        if (!exists) {
          await db.messages.put({ ...receivedMsg, status: 'synced' });
        }
      } catch (err) {
        console.error('解析 WebSocket 訊息失敗:', err);
      }
    };

    ws.onclose = () => console.log('WebSocket 已斷開');

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [isLeader]);

  // --- Leader 專屬邏輯：定期檢查 (作為保險) ---
  useEffect(() => {
    if (!isLeader) return;

    const interval = setInterval(syncLocalMessages, 2000); // 降低頻率，主要靠連線時觸發
    return () => clearInterval(interval);
  }, [isLeader]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: ChatMessage = {
      id: uuidv4(),
      sender: currentUser,
      content: inputText.trim(),
      timestamp: Date.now(),
      status: 'local', // 初始設為 local
    };

    // 所有人都是直接寫入資料庫
    await db.messages.add(newMsg);
    setInputText('');
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '600px', margin: '20px auto' }}>
      <h3>聊天室 - 目前使用者: <span style={{ color: 'blue' }}>{currentUser}</span></h3>
      <p style={{ fontSize: '12px', color: isLeader ? 'green' : 'gray' }}>
        狀態: {isLeader ? '🌟 我是連線代理人 (Leader)' : '👤 我是普通分頁 (跟隨者)'}
      </p>

      <div style={{ height: '300px', overflowY: 'auto', border: '1px solid #eee', padding: '10px', marginBottom: '10px' }}>
        {messages?.map((msg) => (
          <div key={msg.id} style={{ marginBottom: '8px', textAlign: msg.sender === currentUser ? 'right' : 'left' }}>
            <div style={{ fontSize: '10px', color: '#888' }}>{msg.sender}</div>
            <div style={{
              display: 'inline-block',
              padding: '8px 12px',
              borderRadius: '12px',
              backgroundColor: msg.sender === currentUser ? '#007bff' : '#f1f0f0',
              color: msg.sender === currentUser ? 'white' : 'black',
            }}>
              {msg.content}
              {msg.sender === currentUser && (
                <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '5px' }}>
                  {msg.status === 'local' ? '⏳' : '✓'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={sendMessage} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="輸入訊息..."
          style={{ flex: 1, padding: '8px' }}
        />
        <button type="submit" style={{ padding: '8px 16px' }}>發送</button>
      </form>
      
      <button 
        onClick={() => db.messages.clear()} 
        style={{ marginTop: '20px', fontSize: '10px', background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}
      >
        🗑 清空對話 (所有分頁會同步清空)
      </button>
    </div>
  );
};

export default ChatRoom;
