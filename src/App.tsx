import { useState } from 'react';
import ChatRoom from './components/ChatRoom';

function App() {
  const [userName, setUserName] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      setUserName(tempName.trim());
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      {!userName ? (
        <div style={{ textAlign: 'center', marginTop: '100px' }}>
          <h1>Live DB Chat Demo</h1>
          <form onSubmit={handleJoin}>
            <input 
              type="text" 
              value={tempName} 
              onChange={(e) => setTempName(e.target.value)} 
              placeholder="輸入你的暱稱..."
              style={{ padding: '10px', fontSize: '16px' }}
            />
            <button type="submit" style={{ padding: '10px 20px', fontSize: '16px', marginLeft: '10px' }}>
              進入
            </button>
          </form>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '20px' }}>
            提示: 開啟多個分頁，輸入相同的姓名即視為同一人。
          </p>
        </div>
      ) : (
        <ChatRoom currentUser={userName} />
      )}
    </div>
  );
}

export default App;
