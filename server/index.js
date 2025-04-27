const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const GameManager = require('./gameManager');

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.id = uuidv4();
  ws.send(JSON.stringify({ event: 'init', id: ws.id }));

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg.event === 'join_match') {
      GameManager.addPlayer(ws, msg.name);
    } else if (msg.event === 'join_cpu') {
      GameManager.addCpu(ws, msg.name);
    } else if (msg.event === 'play_tetrachord') {
      GameManager.playTetrachord(ws, msg.notes);
    }
  });

  ws.on('close', () => {
    GameManager.removePlayer(ws);
  });
});

const PORT = process.env.PORT || 3001; // Changed to 3001 to avoid conflicts
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
