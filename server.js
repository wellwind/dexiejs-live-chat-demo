import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
// 模擬資料庫：儲存歷史訊息
const messageHistory = [];

console.log('🚀 WebSocket Server (with History) started on ws://localhost:8080');

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());

    // 如果是同步請求
    if (message.type === 'SYNC_REQUEST') {
      console.log(`收到同步請求，最後時間戳: ${message.lastTimestamp}`);
      const missedMessages = messageHistory.filter(m => m.timestamp > message.lastTimestamp);
      ws.send(JSON.stringify({ type: 'SYNC_RESPONSE', messages: missedMessages }));
      return;
    }

    // 正常的聊天訊息
    messageHistory.push(message);
    // 保持歷史紀錄不要無限膨脹 (例如只留最後 1000 筆)
    if (messageHistory.length > 1000) messageHistory.shift();

    // 廣播給所有人
    const broadcastData = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(broadcastData);
      }
    });
    console.log('Broadcasted message:', message.content);
  });

  ws.on('close', () => console.log('Client disconnected'));
});
