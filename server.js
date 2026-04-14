import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

console.log('🚀 WebSocket Server started on ws://localhost:8080');

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (data) => {
    // 廣播收到的訊息給所有連線的 Client (除了發送者自己，但在本 Demo 中，Leader 是唯一連線者)
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // 1 = OPEN
        client.send(data.toString());
      }
    });
    console.log('Broadcasted:', data.toString());
  });

  ws.on('close', () => console.log('Client disconnected'));
});
