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

  // --- Leader 專屬邏輯：WebSocket 同步 ---
  useEffect(() => {
    if (!isLeader) return;

    console.log('Leader 正在建立 WebSocket 連線...');
    const ws = new WebSocket('ws://localhost:8080');
    wsRef.current = ws;

    ws.onmessage = async (event) => {
      try {
        const receivedMsg: ChatMessage = JSON.parse(event.data);
        // 檢查訊息是否已存在，避免重複寫入
        const exists = await db.messages.get(receivedMsg.id);
        if (!exists) {
          await db.messages.put({ ...receivedMsg, status: 'synced' });
        }
      } catch (err) {
        console.error('解析 WebSocket 訊息失敗:', err);
      }
    };

    ws.onopen = () => console.log('WebSocket 已連線');
    ws.onclose = () => console.log('WebSocket 已斷開');

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [isLeader]);

  // --- Leader 專屬邏輯：監聽 Dexie 變動並補發給 WS ---
  useEffect(() => {
    if (!isLeader) return;

    // 這裡我們訂閱 Dexie，找出所有狀態為 'local' 的訊息並同步
    const interval = setInterval(async () => {
      const unsyncedMessages = await db.messages.where('status').equals('local').toArray();
      
      if (unsyncedMessages.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
        for (const msg of unsyncedMessages) {
          console.log('同步訊息到後端:', msg.content);
          wsRef.current.send(JSON.stringify(msg));
          // 更新狀態為已同步
          await db.messages.update(msg.id, { status: 'synced' });
        }
      }
    }, 1000); // 每一秒掃描一次

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
