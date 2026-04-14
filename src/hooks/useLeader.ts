import { useState, useEffect } from 'react';

/**
 * 使用 Web Locks API 進行主導者選舉 (Leader Election)
 * 確保同一個 Origin 之下，只有一個分頁是 Leader。
 */
export function useLeader() {
  const [isLeader, setIsLeader] = useState(false);

  useEffect(() => {
    let active = true;

    // 請求一個名為 'chat_leader_lock' 的鎖
    navigator.locks.request('chat_leader_lock', async () => {
      if (!active) return;
      
      console.log('🎉 我現在是 Leader 了！');
      setIsLeader(true);

      // 只要這個 Promise 一直處於 pending，鎖就不會被釋放
      // 直到分頁關閉或手動觸發
      await new Promise((resolve) => {
        const cleanup = () => {
          active = false;
          resolve(null);
        };
        window.addEventListener('unload', cleanup);
      });
    }).catch(err => {
      console.error('Leader Election 失敗:', err);
    });

    return () => {
      active = false;
    };
  }, []);

  return isLeader;
}
