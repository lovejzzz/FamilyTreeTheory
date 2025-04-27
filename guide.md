Below is a self-contained specification you can hand straight to an AI coding agent.
Everything is vanilla HTML + CSS + JavaScript (ES Modules) with a tiny Node/Express + WebSocket back-end—no React, no build tools.

⸻

0 .  Elevator Pitch

A live two-player “interval chess.”
Players take turns extending a chain of tetrachords (four different notes).
The first three notes of every new tetrachord are the last three notes of the previous one;
the 4th note must lie strictly between the first two notes of that previous tetrachord.
If the current gap is a minor 2nd (1 semitone), no legal 4th note exists—whoever created that trap wins the round.

⸻

1 .  File / Folder Layout

music-family-tree/
│
├─ public/
│   ├─ index.html          ← single page
│   ├─ style.css
│   ├─ main.js             ← UI + client logic
│   └─ audio.js            ← tiny MIDI synth helper (optional)
│
├─ server/
│   ├─ index.js            ← Node + Express + ws
│   └─ gameManager.js      ← keeps authoritative game state
│
├─ package.json
└─ README.md



⸻

2 .  Game Rules (authoritative version)

#	Rule
1	Distinct Pitches – Inside any tetrachord, no pitch class repeats (enharmonics count as same).
2	Carry-Over – New tetrachord notes are Q1 =P2, Q2 =P3, Q3 =P4.
3	Between-Note – Q4 must be strictly chromatic-between the lower and higher of P1 & P2 (exclusive).
4	Minor-Second Trap – If the interval P1↔P2 is 1 semitone, there is no valid Q4; prior player scores the win.
5	Round End – Declare winner, clear board, alternate who starts next round.
6	Match – First to three round wins takes the match.

“Chromatic-between” pool size = abs(semitoneDistance) − 1.

⸻

3 .  Data Model (shared by client & server)

// note values 0–11  (0 = C, 1 = C#, ..., 11 = B)
class Tetrachord {
  constructor(a,b,c,d){ this.p = [a,b,c,d]; }          // integers 0-11
}

class GameState {
  id: string;             // uuid per match
  players: ['socketIdA','socketIdB'];
  currentChain: Tetrachord[];   // chronological
  currentTurn: 0 | 1;     // index in players[]
  score: [roundWinsP0, roundWinsP1];
  phase: 'waiting' | 'playing' | 'round_end' | 'match_end';
}

Validation helper (pure):

function legalFourth(prevTet, fourth){
  const [p1,p2] = prevTet.p;
  if(p1 === p2) return false;                // impossible by rule 1
  const low = Math.min(p1,p2), high = Math.max(p1,p2);
  if(fourth <= low || fourth >= high) return false;
  // check duplicates
  return !prevTet.p.slice(1).includes(fourth);
}



⸻

4 .  Server (Node 18+, no database)

4.1 Dependencies

npm i express ws uuid

4.2 Key WebSocket Events

Event	Dir	Payload	Notes
join_match	⇢	{name}	server pairs first two joiners
state	⇠	GameState	sent after any change
play_tetrachord	⇢	{notes:[int,int,int,int]}	server validates, updates state
error	⇠	{msg}	rule violation messages

Server is authoritative—reject illegal moves, broadcast updated state.

⸻

5 .  Client (public/main.js)

5.1 UI Sketch  (single HTML page)

┌──────────── Music Family Tree ────────────┐
│ Round 2  |  You: 1   Opponent: 0          │
├────────────────────────────────────────────┤
│ Last Tetrachord:  C  E  G  Bb             │
│                                            │
│ Your Input:  _  _  _  _   [Submit]        │
│  (first 3 boxes are read-only placeholders)│
│                                            │
│ Move Log                                  │
│ • P0: C E G Bb                            │
│ • P1: E G Bb D                            │
└────────────────────────────────────────────┘

	•	Note pickers: simple <select> 0–11 or clickable piano.
	•	Disable form if not your turn.
	•	A thin message bar for server errors.

5.2 Flow
	1.	On load → prompt name → join_match.
	2.	Render lobby → “Waiting for opponent…”.
	3.	On state:
	•	Update scores / turn indicator.
	•	If phase==="round_end", flash winner & reset after 3 s.
	•	If phase==="match_end", show “Play Again?” button.

5.3 Sound (optional audio.js)

Very light Web Audio API: play the 4 notes of each submitted tetrachord arpeggiated for feedback.

⸻

6 .  Algorithm Details

Task	Approach
Gap calc	gap = (high - low + 12) % 12 (always 1-11).
Between pool	[low+1, …, high-1] mod 12, wrap if needed.
Win detect	If gap === 1 right after adding a tetrachord → flag round_end, award previous player.
Duplicate prevention	Ensure new fourth note ≠ any of carried notes.



⸻

7 .  Minimal Styling (public/style.css)

body{font-family:sans-serif;max-width:640px;margin:auto;line-height:1.5}
select,input,button{font-size:1rem;padding:4px}
.tetra-box{display:inline-block;width:40px;text-align:center}
.turn-you{background:#dff}
.turn-them{background:#fdd}



⸻

8 .  Running Locally

git clone <repo>
cd music-family-tree
npm install
node server/index.js
# visit http://localhost:3000 in two browser tabs

server/index.js spins Express (/public static) on :3000 and same-port WebSocket.

⸻

9 .  Extension Hooks
	•	Solo practice: add “vs CPU” that picks a random legal 4th.
	•	Ranked lobby: store Elo in a JSON file or Redis.
	•	Touch mode: responsive piano keys for mobile.

⸻

10 .  Hand-off Checklist for AI Coder
	•	Scaffold folder tree exactly as §1.
	•	Implement GameState, validation, and win logic per §§2–3.
	•	WebSocket server events per §4.
	•	Plain JS client per §5, autoconnecting to same host.
	•	Basic CSS from §7.
	•	README with run / deploy notes (§8).

