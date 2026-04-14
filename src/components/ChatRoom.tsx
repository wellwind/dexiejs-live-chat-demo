import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db, type ChatMessage } from '../db';
import { useLeader } from '../hooks/useLeader';
import { useChatSync } from '../hooks/useChatSync';

interface Props {
  currentUser: string;
}

// 跨視窗廣播频道，用來通知 Leader 立刻同步
const syncChannel = new BroadcastChannel('chat_sync_pokes');

const ChatRoom: React.FC<Props> = ({ currentUser }) => {
  const [inputText, setInputText] = useState('');
  const messages = useLiveQuery(() => db.messages.orderBy('timestamp').toArray());
  const isLeader = useLeader();
  
  // 注入同步邏輯 Hook
  const { syncLocalMessages } = useChatSync(isLeader);

  // 監聽來自其他視窗的同步請求
  useEffect(() => {
    if (!isLeader) return;
    syncChannel.onmessage = (event) => {
      if (event.data === 'POKE_LEADER') syncLocalMessages();
    };
  }, [isLeader, syncLocalMessages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: ChatMessage = {
      id: uuidv4(),
      sender: currentUser,
      content: inputText.trim(),
      timestamp: Date.now(),
      status: 'local',
    };

    await db.messages.add(newMsg);
    syncChannel.postMessage('POKE_LEADER'); // 戳一下 Leader (如果有)
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
