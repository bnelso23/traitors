const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const defaultState = {
  roomCode: 'TRAITORS',
  gmPin: '9999', // GM PIN to login
  gameStatus: 'LOBBY', // LOBBY, ACTIVE, ENDED
  chatsEnabled: true,
  privateChatsEnabled: true,
  traitorsChatEnabled: false,
  votingActive: false,
  votingType: 'EXILE', // EXILE, MURDER
  votingOptions: [], // Array of playerIds
  votes: {}, // voterId -> votedId
  players: [
    { id: 'p1', name: 'Hayli', pin: '1001', role: 'UNKNOWN', status: 'ALIVE', shielded: false },
    { id: 'p2', name: 'Jen', pin: '1002', role: 'UNKNOWN', status: 'ALIVE', shielded: false },
    { id: 'p3', name: 'Alix', pin: '1003', role: 'UNKNOWN', status: 'ALIVE', shielded: false },
    { id: 'p4', name: 'Tanner', pin: '1004', role: 'UNKNOWN', status: 'ALIVE', shielded: false },
    { id: 'p5', name: 'Bryce', pin: '1005', role: 'UNKNOWN', status: 'ALIVE', shielded: false },
    { id: 'p6', name: 'Kelsie', pin: '1006', role: 'UNKNOWN', status: 'ALIVE', shielded: false },
    { id: 'p7', name: 'Alyssa', pin: '1007', role: 'UNKNOWN', status: 'ALIVE', shielded: false },
    { id: 'p8', name: 'Naeim', pin: '1008', role: 'UNKNOWN', status: 'ALIVE', shielded: false },
    { id: 'p9', name: 'Matt', pin: '1009', role: 'UNKNOWN', status: 'ALIVE', shielded: false },
    { id: 'p10', name: 'Allyson', pin: '1010', role: 'UNKNOWN', status: 'ALIVE', shielded: false },
    { id: 'p11', name: 'Sarah', pin: '1011', role: 'UNKNOWN', status: 'ALIVE', shielded: false },
    { id: 'p12', name: 'Derek', pin: '1012', role: 'UNKNOWN', status: 'ALIVE', shielded: false }
  ],
  messages: [], // Array of { id, senderId, senderName, channelId, text, timestamp }
  groups: [] // Array of { id, name, memberIds, creatorId }
};

let localState = { ...defaultState };
let dbClient = null;
const stateFilePath = path.join(__dirname, 'state.json');

async function initDb() {
  if (process.env.DATABASE_URL) {
    console.log("DATABASE_URL found, connecting to PostgreSQL...");
    try {
      dbClient = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      });
      await dbClient.connect();
      await dbClient.query(`
        CREATE TABLE IF NOT EXISTS game_state (
          id INT PRIMARY KEY,
          state JSONB
        )
      `);
      console.log("PostgreSQL setup completed successfully.");
    } catch (err) {
      console.error("Failed to connect to PostgreSQL, falling back to JSON file storage:", err);
      dbClient = null;
    }
  } else {
    console.log("No DATABASE_URL found. Using local JSON file storage.");
  }
}

async function loadState() {
  if (dbClient) {
    try {
      const res = await dbClient.query('SELECT state FROM game_state WHERE id = 1');
      if (res.rows.length > 0) {
        localState = res.rows[0].state;
        // Make sure all default fields are set (in case model evolved)
        localState = { ...defaultState, ...localState };
        return localState;
      } else {
        await dbClient.query('INSERT INTO game_state (id, state) VALUES (1, $1)', [JSON.stringify(defaultState)]);
        localState = JSON.parse(JSON.stringify(defaultState));
        return localState;
      }
    } catch (err) {
      console.error("Error loading state from PostgreSQL:", err);
    }
  }
  
  if (fs.existsSync(stateFilePath)) {
    try {
      const data = fs.readFileSync(stateFilePath, 'utf8');
      localState = { ...defaultState, ...JSON.parse(data) };
    } catch (err) {
      console.error("Error reading state from file:", err);
      localState = JSON.parse(JSON.stringify(defaultState));
    }
  } else {
    localState = JSON.parse(JSON.stringify(defaultState));
    await saveState();
  }
  return localState;
}

async function saveState() {
  if (dbClient) {
    try {
      await dbClient.query('UPDATE game_state SET state = $1 WHERE id = 1', [JSON.stringify(localState)]);
      return;
    } catch (err) {
      console.error("Error saving state to PostgreSQL:", err);
    }
  }
  
  try {
    fs.writeFileSync(stateFilePath, JSON.stringify(localState, null, 2));
  } catch (err) {
    console.error("Error writing state to file:", err);
  }
}

function getState() {
  return localState;
}

async function resetState() {
  localState = JSON.parse(JSON.stringify(defaultState));
  await saveState();
  return localState;
}

module.exports = {
  initDb,
  loadState,
  saveState,
  getState,
  resetState,
  defaultState
};
