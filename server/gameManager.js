const { v4: uuidv4 } = require('uuid');

class Tetrachord {
  constructor(a, b, c, d) { this.p = [a, b, c, d]; }
}

function legalFourth(prevTet, fourth) {
  const [p1, p2] = prevTet.p;
  if (p1 === p2) return false;
  
  // Handle octave wrapping for the between rule
  let low = p1, high = p2;
  if (p1 > p2) {
    // If p1 > p2, we need to consider p2 as being in the next octave
    // For example: A# (10) and D# (3) should be treated as 10 and 15 (3+12)
    high = p2 + 12;
  } else {
    low = p1;
    high = p2;
  }
  
  // Check if fourth is between low and high (exclusive)
  // If fourth < low, consider it in the next octave
  let adjustedFourth = fourth;
  if (fourth < low) {
    adjustedFourth = fourth + 12;
  }
  
  if (adjustedFourth <= low || adjustedFourth >= high) return false;
  
  // Check for duplicates
  return !prevTet.p.slice(1).includes(fourth);
}

class GameState {
  constructor(id, players) {
    this.id = id;
    this.players = players;
    this.currentChain = [];
    this.currentTurn = 0;
    this.score = [0, 0];
    this.phase = 'playing';
    this.startingPlayer = 0;
  }
}

const GameManager = {
  waiting: [],
  games: {},

  addPlayer(ws, name) {
    ws.name = name;
    if (this.waiting.length > 0) {
      const opponent = this.waiting.shift();
      const gameId = uuidv4();
      const state = new GameState(gameId, [opponent.id, ws.id]);
      this.games[gameId] = { state, sockets: [opponent, ws] };
      this.sendState(state);
    } else {
      this.waiting.push(ws);
      ws.send(JSON.stringify({ event: 'state', state: { phase: 'waiting' } }));
    }
  },

  addCpu(ws, name) {
    console.log('Adding CPU opponent for player:', name);
    ws.name = name;
    const cpuId = 'cpu-' + uuidv4();
    const cpuWs = { id: cpuId, send: () => {} };
    const gameId = uuidv4();
    // Force CPU to always go first by setting it as player 0
    const state = new GameState(gameId, [cpuId, ws.id]);
    state.currentTurn = 0; // CPU always goes first
    this.games[gameId] = { state, sockets: [cpuWs, ws], cpu: cpuWs };
    this.sendState(state);
    console.log('CPU game created, ID:', gameId, 'Current turn:', state.currentTurn);
    // CPU always goes first
    console.log('CPU goes first, scheduling move');
    setTimeout(() => this.cpuMove(gameId), 1000);
  },

  playTetrachord(ws, notes) {
    console.log('Play tetrachord received:', notes);
    let gameEntry;
    if (ws.id && ws.id.startsWith('cpu-')) {
      // CPU is playing
      gameEntry = Object.values(this.games).find(g => g.cpu && g.cpu.id === ws.id);
      console.log('CPU is playing, found game:', gameEntry ? gameEntry.state.id : 'none');
    } else {
      // Human is playing
      gameEntry = this.getGameByWs(ws);
      console.log('Human is playing, found game:', gameEntry ? gameEntry.state.id : 'none');
    }
    if (!gameEntry) {
      if (ws.send) ws.send(JSON.stringify({ event: 'error', msg: 'Not in a game' }));
      console.log('No game found for player');
      return;
    }
    const { state } = gameEntry;
    if (state.phase !== 'playing') {
      ws.send(JSON.stringify({ event: 'error', msg: 'Game not active' }));
      return;
    }
    const playerIdx = state.players.indexOf(ws.id);
    if (playerIdx !== state.currentTurn) {
      ws.send(JSON.stringify({ event: 'error', msg: 'Not your turn' }));
      return;
    }
    if (!Array.isArray(notes) || notes.length !== 4) {
      ws.send(JSON.stringify({ event: 'error', msg: 'Invalid notes array' }));
      return;
    }
    if (state.currentChain.length === 0) {
      if (new Set(notes).size !== 4) {
        ws.send(JSON.stringify({ event: 'error', msg: 'Pitches must be distinct' }));
        return;
      }
    } else {
      const prev = state.currentChain[state.currentChain.length - 1];
      if (
        notes[0] !== prev.p[1] ||
        notes[1] !== prev.p[2] ||
        notes[2] !== prev.p[3]
      ) {
        ws.send(JSON.stringify({ event: 'error', msg: 'Carry-over violation' }));
        return;
      }
      if (!legalFourth(prev, notes[3])) {
        ws.send(JSON.stringify({ event: 'error', msg: 'Illegal fourth note' }));
        return;
      }
    }
    const tet = new Tetrachord(notes[0], notes[1], notes[2], notes[3]);
    state.currentChain.push(tet);
    const gap = (Math.abs(tet.p[1] - tet.p[0]) + 12) % 12;
    if (gap === 1) {
      state.score[playerIdx]++;
      state.phase = 'round_end';
      this.sendState(state);
      if (state.score[playerIdx] >= 3) {
        state.phase = 'match_end';
        this.sendState(state);
      } else {
        setTimeout(() => {
          state.startingPlayer = 1 - state.startingPlayer;
          state.currentTurn = state.startingPlayer;
          state.currentChain = [];
          state.phase = 'playing';
          this.sendState(state);
        }, 3000);
      }
      return;
    }
    state.currentTurn = 1 - state.currentTurn;
    this.sendState(state);
    // if CPU opponent and it's CPU's turn, schedule CPU move
    if (gameEntry.cpu) {
      const cpuIndex = state.players.indexOf(gameEntry.cpu.id);
      if (state.currentTurn === cpuIndex) {
        console.log('Scheduling CPU move for game:', state.id, 'CPU index:', cpuIndex);
        // Use direct function call instead of setTimeout to ensure it runs
        this.cpuMove(state.id);
      }
    }
  },

  cpuMove(gameId) {
    console.log('CPU move triggered for game:', gameId);
    const gameEntry = this.games[gameId];
    if (!gameEntry) {
      console.log('Game not found');
      return;
    }
    const { state, cpu } = gameEntry;
    if (state.phase !== 'playing') {
      console.log('Game not in playing phase');
      return;
    }
    const cpuIndex = state.players.indexOf(cpu.id);
    if (state.currentTurn !== cpuIndex) {
      console.log('Not CPU turn');
      return;
    }
    console.log('CPU making move...');
    let notes;
    if (state.currentChain.length === 0) {
      // Always start with G7 chord (G B D F) when CPU goes first
      notes = [7, 11, 2, 5]; // G B D F
    } else {
      const prev = state.currentChain[state.currentChain.length - 1];
      const options = [];
      for (let n = 0; n < 12; n++) {
        if (legalFourth(prev, n)) options.push(n);
      }
      if (options.length === 0) {
        // trap: previous player wins
        const prevIndex = 1 - cpuIndex;
        state.score[prevIndex]++;
        state.phase = 'round_end';
        this.sendState(state);
        if (state.score[prevIndex] >= 3) {
          state.phase = 'match_end';
          this.sendState(state);
        } else {
          setTimeout(() => {
            state.startingPlayer = 1 - state.startingPlayer;
            state.currentTurn = state.startingPlayer;
            state.currentChain = [];
            state.phase = 'playing';
            this.sendState(state);
            if (state.currentTurn === cpuIndex) this.cpuMove(gameId);
          }, 3000);
        }
        return;
      }
      notes = [prev.p[1], prev.p[2], prev.p[3], options[Math.floor(Math.random() * options.length)]];
    }
    this.playTetrachord(gameEntry.cpu, notes);
    setTimeout(() => this.cpuMove(gameId), 1000);
  },

  getGameByWs(ws) {
    return Object.values(this.games).find(g =>
      g.sockets.some(s => s.id === ws.id)
    );
  },

  removePlayer(ws) {
    this.waiting = this.waiting.filter(w => w !== ws);
    const gameEntry = this.getGameByWs(ws);
    if (gameEntry) {
      const other = gameEntry.sockets.find(s => s !== ws);
      if (other) {
        other.send(JSON.stringify({ event: 'error', msg: 'Opponent disconnected' }));
      }
      delete this.games[gameEntry.state.id];
    }
  },

  sendState(state) {
    const gameEntry = this.games[state.id];
    if (!gameEntry) return;
    const msg = JSON.stringify({ event: 'state', state });
    gameEntry.sockets.forEach(s => s.send(msg));
  }
};

module.exports = GameManager;
