const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const crypto = require('crypto');
const fs = require('fs');
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const { initDb, loadState, saveState, getState, resetState } = require('./gameStore');
const notifier = require('./notifier');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// Load initial game state
let gameLoaded = false;
async function initializeGame() {
  await initDb();
  await loadState();
  gameLoaded = true;
  console.log('Game state initialized.');
}
initializeGame();

// Middleware to ensure game is loaded before handling API requests
app.use((req, res, next) => {
  if (!gameLoaded) {
    return res.status(503).json({ error: 'Server is starting up...' });
  }
  next();
});

// Serve sw.js with no-cache headers to ensure immediate PWA updates
app.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.sendFile(path.join(__dirname, '../client/dist/sw.js'));
});

// Setup S3-compatible client for Railway Buckets
const bucketName = process.env.AWS_BUCKET_NAME || process.env.AWS_BUCKET || process.env.BUCKET_NAME;
const s3Enabled = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_ENDPOINT && bucketName);
let s3Client = null;
if (s3Enabled) {
  s3Client = new S3Client({
    endpoint: process.env.AWS_ENDPOINT,
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    forcePathStyle: true
  });
  console.log(`Railway Buckets (S3 Storage) client initialized successfully. Bucket: ${bucketName}, Endpoint: ${process.env.AWS_ENDPOINT}`);
} else {
  console.log('S3 environment variables not set. Using local file storage for uploads.');
}

// Proxy route to serve uploads from S3 (if enabled)
app.get('/uploads/:filename', async (req, res, next) => {
  if (s3Enabled && s3Client) {
    const { filename } = req.params;
    try {
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: filename
      }));
      res.setHeader('Content-Type', response.ContentType || 'image/jpeg');
      if (response.ContentLength) {
        res.setHeader('Content-Length', response.ContentLength);
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      response.Body.pipe(res);
    } catch (err) {
      console.warn(`S3 file get error for ${filename}, falling back to local files:`, err.message);
      next();
    }
  } else {
    next();
  }
});

// Proxy route to serve defaults from S3 (if enabled)
app.get('/defaults/:filename', async (req, res, next) => {
  if (s3Enabled && s3Client) {
    const { filename } = req.params;
    try {
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: `defaults/${filename}`
      }));
      res.setHeader('Content-Type', response.ContentType || 'image/jpeg');
      if (response.ContentLength) {
        res.setHeader('Content-Length', response.ContentLength);
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      response.Body.pipe(res);
    } catch (err) {
      console.warn(`S3 defaults get error for ${filename}, falling back to local defaults:`, err.message);
      next();
    }
  } else {
    next();
  }
});

// Proxy route to serve paintings from S3 (if enabled)
app.get('/paintings/:filename', async (req, res, next) => {
  if (s3Enabled && s3Client) {
    const { filename } = req.params;
    try {
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: `paintings/${filename}`
      }));
      res.setHeader('Content-Type', response.ContentType || 'image/jpeg');
      if (response.ContentLength) {
        res.setHeader('Content-Length', response.ContentLength);
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      response.Body.pipe(res);
    } catch (err) {
      console.warn(`S3 painting get error for ${filename}, falling back to local files:`, err.message);
      next();
    }
  } else {
    next();
  }
});

// Configure uploads directory (using Railway volume if attached, else local uploads folder)
const uploadDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));
app.use('/paintings', express.static(path.join(__dirname, 'public/paintings')));

// Serve static client build files in production
app.use(express.static(path.join(__dirname, '../client/dist')));

// --- HTTP REST ENDPOINTS ---

// VAPID Public Key endpoint for web push client
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: notifier.vapidPublicKey });
});

// Fetch list of current player slots for login name selection
app.get('/api/players', (req, res) => {
  const state = getState();
  res.json({
    players: state.players.map(p => ({ id: p.id, name: p.name }))
  });
});

// Fetch list of paintings for the gallery
app.get('/api/paintings', (req, res) => {
  const metadataPath = path.join(__dirname, 'data/paintings.json');
  if (fs.existsSync(metadataPath)) {
    try {
      const data = fs.readFileSync(metadataPath, 'utf8');
      return res.json(JSON.parse(data));
    } catch (err) {
      console.error('Failed to read paintings metadata:', err);
      return res.status(500).json({ error: 'Failed to load paintings metadata' });
    }
  }
  res.json([]);
});

// Login endpoint checking PIN and user status
app.post('/api/login', async (req, res) => {
  const { name, pin, isGm } = req.body;
  const state = getState();
  const sessionToken = crypto.randomBytes(16).toString('hex');

  if (isGm) {
    if (pin === state.gmPin) {
      state.gmSessionToken = sessionToken;
      await saveState();
      return res.json({
        success: true,
        user: { id: 'gm', name: 'Game Master', role: 'GM', status: 'ALIVE', sessionToken }
      });
    } else {
      return res.status(401).json({ error: 'Invalid Game Master PIN' });
    }
  }

  // Find player slot by name
  const player = state.players.find(p => p.name === name);
  if (!player) {
    return res.status(404).json({ error: 'Player slot not found' });
  }

  if (player.pin !== pin) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  player.sessionToken = sessionToken;
  await saveState();

  return res.json({
    success: true,
    user: { id: player.id, name: player.name, role: player.role, status: player.status, sessionToken }
  });
});

// Web Push subscription endpoint
app.post('/api/subscribe', (req, res) => {
  const { playerId, subscription } = req.body;
  if (!playerId || !subscription) {
    return res.status(400).json({ error: 'Missing playerId or subscription data' });
  }
  notifier.addSubscription(playerId, subscription);
  res.status(201).json({ success: true });
});

// Web Push unsubscribe endpoint
app.post('/api/unsubscribe', (req, res) => {
  const { playerId, endpoint } = req.body;
  if (!playerId || !endpoint) {
    return res.status(400).json({ error: 'Missing playerId or endpoint data' });
  }
  notifier.removeSubscription(playerId, endpoint);
  res.status(200).json({ success: true });
});

// Player avatar image upload endpoint (Base64 decodes and stores locally or in railway volume bucket)
app.post('/api/upload-avatar', async (req, res) => {
  const { playerId, image } = req.body;
  if (!playerId || !image) {
    return res.status(400).json({ error: 'Missing playerId or image data' });
  }

  const state = getState();
  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }

  try {
    // Parse base64 data URL (e.g. data:image/png;base64,iVBORw0KGgo...)
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid image format. Must be base64 Data URL' });
    }

    const imageType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Extract file extension, default to png
    const extension = imageType.split('/')[1] || 'png';
    const filename = `avatar_${playerId}_${Date.now()}.${extension}`;
    let newAvatarUrl = '';

    if (s3Client) {
      // --- S3 BUCKET UPLOAD ---
      // Delete old S3 object if it exists to conserve space
      if (player.avatarUrl && player.avatarUrl.startsWith('/uploads/')) {
        try {
          const oldFilename = player.avatarUrl.replace('/uploads/', '');
          await s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: oldFilename
          }));
          console.log(`Deleted old avatar object from S3: ${oldFilename}`);
        } catch (err) {
          console.error('Failed to delete old S3 avatar object:', err);
        }
      }

      // Upload new S3 object
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: filename,
        Body: buffer,
        ContentType: imageType,
        ACL: 'public-read'
      }));

      // Construct public URL using the proxy endpoint
      newAvatarUrl = `/uploads/${filename}`;
      console.log(`Uploaded new avatar to S3: ${newAvatarUrl}`);
    } else {
      // --- LOCAL FILESYSTEM UPLOAD ---
      const filepath = path.join(uploadDir, filename);

      // If there is an existing local avatar file, try to clean it up to save space
      if (player.avatarUrl && player.avatarUrl.startsWith('/uploads/')) {
        const oldFilename = player.avatarUrl.replace('/uploads/', '');
        const oldFilepath = path.join(uploadDir, oldFilename);
        if (fs.existsSync(oldFilepath)) {
          try {
            fs.unlinkSync(oldFilepath);
          } catch (err) {
            console.error(`Failed to delete old avatar ${oldFilepath}:`, err);
          }
        }
      }

      // Write file
      fs.writeFileSync(filepath, buffer);
      newAvatarUrl = `/uploads/${filename}`;
    }

    // Update state
    player.avatarUrl = newAvatarUrl;
    await saveState();
    broadcastState();

    res.json({ success: true, avatarUrl: newAvatarUrl });
  } catch (err) {
    console.error('Error processing avatar upload:', err);
    res.status(500).json({ error: 'Failed to process and save avatar image' });
  }
});

// Fallback to React client routing in production
app.get('*', (req, res, next) => {
  // If requesting api, let it handle naturally or 404
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});


// --- REALTIME WEB SOCKETS (SOCKET.IO) ---

// Filter state sent to a specific client to prevent cheating
function getFilteredState(userId) {
  const state = getState();
  
  if (userId === 'gm') {
    return state; // GM sees everything
  }

  const clientPlayer = state.players.find(p => p.id === userId);
  if (!clientPlayer) {
    return {
      gameStatus: state.gameStatus,
      chatsEnabled: false,
      privateChatsEnabled: false,
      players: state.players.map(p => ({ id: p.id, name: p.name, status: p.status })),
      messages: []
    };
  }

  // Filter player details: hide roles of others unless the client is a Traitor AND the other player is a Traitor
  const isClientTraitor = clientPlayer.role === 'TRAITOR';
  const filteredPlayers = state.players.map(p => {
    let role = 'UNKNOWN';
    if (p.id === userId) {
      role = p.role;
    } else if (isClientTraitor && p.role === 'TRAITOR') {
      role = 'TRAITOR'; // Traitors know each other
    } else if (p.status === 'DEAD' || state.gameStatus === 'ENDED') {
      role = p.role; // Reveal roles of dead players and all roles once game finishes
    }
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      role: role,
      shielded: (userId === 'gm' || p.id === userId) ? !!p.shielded : false,
      avatarUrl: p.avatarUrl || null
    };
  });

  // Filter messages:
  // GM alerts, Global chat, and Private chats where client is sender or receiver.
  // Traitor-only chat is restricted to Traitors.
  // Graveyard chat is restricted to Dead players and GM.
  const filteredMessages = state.messages.filter(msg => {
    if (msg.channelId === 'global') {
      return clientPlayer.status === 'ALIVE'; // Dead players can't read alive global chat
    }
    if (msg.channelId === 'traitors') {
      return isClientTraitor && clientPlayer.status === 'ALIVE';
    }
    if (msg.channelId === 'graveyard') {
      return clientPlayer.status === 'DEAD'; // Only dead players see graveyard
    }
    if (msg.channelId === 'gm-alerts') {
      // GM alerts can be targeted
      const target = msg.targetId;
      return !target 
        || target === 'all'
        || target === userId
        || (target === 'traitors' && isClientTraitor)
        || (target === 'faithfuls' && clientPlayer.role === 'FAITHFUL');
    }
    if (msg.channelId.startsWith('private-')) {
      const parts = msg.channelId.split('-');
      return parts.includes(userId);
    }
    if (msg.channelId.startsWith('group_')) {
      const gp = (state.groups || []).find(g => g.id === msg.channelId);
      return gp && gp.memberIds.includes(userId);
    }
    return false;
  });

  // Filter votes: players can see IF they voted, but not who others voted for, until voting is finalized
  const clientVoted = state.votes[userId] ? true : false;
  const votesCount = Object.keys(state.votes).length;

  const filteredGroups = userId === 'gm' 
    ? (state.groups || []) 
    : (state.groups || []).filter(g => g.memberIds.includes(userId));

  return {
    roomCode: state.roomCode,
    gameStatus: state.gameStatus,
    chatsEnabled: state.chatsEnabled,
    privateChatsEnabled: state.privateChatsEnabled,
    traitorsChatEnabled: state.traitorsChatEnabled,
    votingActive: state.votingActive,
    votingType: state.votingType,
    votingOptions: state.votingOptions,
    votesCount: votesCount,
    clientVoted: clientVoted,
    players: filteredPlayers,
    messages: filteredMessages,
    groups: filteredGroups,
    galleryShield: state.galleryShield ? {
      claimed: !!state.galleryShield.claimed,
      claimedBy: state.galleryShield.claimed ? state.galleryShield.claimedBy : null
    } : null,
    clientPlayer: {
      id: clientPlayer.id,
      name: clientPlayer.name,
      role: clientPlayer.role,
      status: clientPlayer.status,
      shielded: !!clientPlayer.shielded,
      avatarUrl: clientPlayer.avatarUrl || null
    }
  };
}

// Helper to broadcast state to everyone based on their access filters
function broadcastState() {
  const state = getState();
  io.sockets.sockets.forEach((socket) => {
    if (socket.userId) {
      socket.emit('gameState', getFilteredState(socket.userId));
    }
  });
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Authenticate socket and associate with player ID
  socket.on('authenticate', async ({ userId, sessionToken }) => {
    const state = getState();
    let isAuthenticated = false;

    if (userId === 'gm') {
      isAuthenticated = sessionToken && state.gmSessionToken && sessionToken === state.gmSessionToken;
    } else {
      const player = state.players.find(p => p.id === userId);
      isAuthenticated = player && sessionToken && player.sessionToken && sessionToken === player.sessionToken;
    }

    if (!isAuthenticated) {
      console.warn(`Socket authentication failed for userId: ${userId}`);
      socket.emit('authFailed');
      return;
    }

    socket.userId = userId;
    
    // Join appropriate socket rooms
    if (userId === 'gm') {
      socket.join('gm');
      console.log(`Socket ${socket.id} authenticated as GM`);
    } else {
      socket.join(`player-${userId}`);
      
      const player = state.players.find(p => p.id === userId);
      if (player) {
        if (player.status === 'ALIVE') {
          socket.join('alive');
          if (player.role === 'TRAITOR') {
            socket.join('traitors');
          }
        } else {
          socket.join('dead');
        }
        console.log(`Socket ${socket.id} authenticated as player ${player.name} (${userId})`);
      }
    }
    
    // Send initial filtered state
    socket.emit('gameState', getFilteredState(userId));
  });

  // --- CHAT MESSAGING ---
  socket.on('sendMessage', async ({ channelId, text }) => {
    if (!socket.userId) return;

    const state = getState();
    
    // Check if player is alive and chats are enabled (GM always allowed)
    if (socket.userId !== 'gm') {
      const player = state.players.find(p => p.id === socket.userId);
      if (!player || player.status === 'DEAD') {
        // Dead players can only message in graveyard channel
        if (channelId !== 'graveyard') return;
      } else {
        // Player is alive, verify chats are enabled
        if (!state.chatsEnabled) return;
        if (channelId === 'traitors' && (!state.traitorsChatEnabled || player.role !== 'TRAITOR')) return;
        if (channelId.startsWith('private-') && !state.privateChatsEnabled) return;
        if (channelId.startsWith('group_')) {
          const gp = (state.groups || []).find(g => g.id === channelId);
          if (!gp || !gp.memberIds.includes(socket.userId)) return;
        }
      }
    }

    const senderName = socket.userId === 'gm' ? 'Game Master' : state.players.find(p => p.id === socket.userId).name;

    const newMessage = {
      id: 'm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      senderId: socket.userId,
      senderName,
      channelId,
      text,
      timestamp: new Date().toISOString()
    };

    state.messages.push(newMessage);
    await saveState();

    // Broadcast state update to everyone (which filters messages appropriately)
    broadcastState();

    // Trigger Web Push Notifications for offline/background targets
    if (channelId.startsWith('private-')) {
      const parts = channelId.split('-');
      const recipientId = parts.find(id => id !== 'private' && id !== socket.userId);
      if (recipientId) {
        notifier.sendPushNotification(recipientId, {
          title: `Secret Letter from ${senderName}`,
          body: text,
          tag: 'chat-private',
          data: { channelId }
        });
      }
    } else if (channelId === 'traitors') {
      // Send to all other traitors
      state.players.forEach(p => {
        if (p.role === 'TRAITOR' && p.id !== socket.userId && p.status === 'ALIVE') {
          notifier.sendPushNotification(p.id, {
            title: `Traitors' Den - ${senderName}`,
            body: text,
            tag: 'chat-traitors',
            data: { channelId }
          });
        }
      });
    } else if (channelId === 'global') {
      // Send to all alive players (except sender)
      state.players.forEach(p => {
        if (p.id !== socket.userId && p.status === 'ALIVE') {
          notifier.sendPushNotification(p.id, {
            title: `Castle Lounge - ${senderName}`,
            body: text,
            tag: 'chat-global',
            data: { channelId }
          });
        }
      });
    } else if (channelId.startsWith('group_')) {
      const gp = (state.groups || []).find(g => g.id === channelId);
      if (gp) {
        gp.memberIds.forEach(memberId => {
          if (memberId !== socket.userId) {
            notifier.sendPushNotification(memberId, {
              title: `${gp.name} - ${senderName}`,
              body: text,
              tag: `chat-group-${channelId}`,
              data: { channelId }
            });
          }
        });
      }
    }
  });

  // --- GAME MASTER ACTIONS ---

  // Update player roster (add/remove/update names/PINs)
  socket.on('gmUpdatePlayers', async ({ players }) => {
    if (socket.userId !== 'gm') return;
    const state = getState();
    
    // Reconstruct player list supporting additions and removals
    state.players = players.map(p => {
      const existing = state.players.find(ep => ep.id === p.id);
      return {
        id: p.id,
        name: p.name.trim(),
        pin: p.pin.trim(),
        role: existing ? existing.role : 'UNKNOWN',
        status: existing ? existing.status : 'ALIVE',
        shielded: existing ? !!existing.shielded : false,
        sessionToken: existing ? existing.sessionToken : null,
        avatarUrl: existing ? existing.avatarUrl : null
      };
    });
    
    await saveState();
    broadcastState();
  });

  // Start the game
  socket.on('gmStartGame', async () => {
    if (socket.userId !== 'gm') return;
    const state = getState();
    state.gameStatus = 'ACTIVE';
    state.messages.push({
      id: 'alert_' + Date.now(),
      senderId: 'gm',
      senderName: 'Game Master',
      channelId: 'gm-alerts',
      text: 'The game has officially begun! Guard your secrets...',
      timestamp: new Date().toISOString()
    });
    await saveState();
    broadcastState();
  });

  // Assign roles
  socket.on('gmAssignRoles', async ({ traitorIds }) => {
    if (socket.userId !== 'gm') return;
    const state = getState();
    state.players.forEach(p => {
      p.role = traitorIds.includes(p.id) ? 'TRAITOR' : 'FAITHFUL';
    });
    await saveState();
    broadcastState();
    
    // Send silent background notification or wake up push
    traitorIds.forEach(id => {
      notifier.sendPushNotification(id, {
        title: 'Your Identity Has Been Decided',
        body: 'You are a TRAITOR. Meet in the Den when night falls.',
        tag: 'role-assignment'
      });
    });
    state.players.forEach(p => {
      if (!traitorIds.includes(p.id)) {
        notifier.sendPushNotification(p.id, {
          title: 'Your Identity Has Been Decided',
          body: 'You are a FAITHFUL. Hunt down the Traitors.',
          tag: 'role-assignment'
        });
      }
    });
  });

  // Update a single player's role at any point
  socket.on('gmUpdatePlayerRole', async ({ playerId, role }) => {
    if (socket.userId !== 'gm') return;
    const state = getState();
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    player.role = role;
    await saveState();
    broadcastState();

    // Send push notification to target player
    notifier.sendPushNotification(playerId, {
      title: 'Your Identity Has Shifted',
      body: `You are now ${role === 'TRAITOR' ? 'a TRAITOR' : 'a FAITHFUL'}.`,
      tag: 'role-assignment'
    });
  });

  // Toggle chat permissions
  socket.on('gmToggleChats', async ({ chatsEnabled, privateChatsEnabled, traitorsChatEnabled }) => {
    if (socket.userId !== 'gm') return;
    const state = getState();
    state.chatsEnabled = chatsEnabled;
    state.privateChatsEnabled = privateChatsEnabled;
    state.traitorsChatEnabled = traitorsChatEnabled;
    
    let alertText = 'Communication settings updated by the Game Master.';
    if (!chatsEnabled) {
      alertText = '🔊 NIGHT FALLS. All lounges are locked. Silent hours have commenced.';
    } else {
      alertText = '🔊 SUNRISE. Castle lounges are now open. You may speak.';
    }
    
    state.messages.push({
      id: 'alert_' + Date.now(),
      senderId: 'gm',
      senderName: 'Game Master',
      channelId: 'gm-alerts',
      text: alertText,
      timestamp: new Date().toISOString()
    });

    await saveState();
    broadcastState();

    // Trigger push notification to wake up phones
    state.players.forEach(p => {
      if (p.status === 'ALIVE') {
        notifier.sendPushNotification(p.id, {
          title: chatsEnabled ? 'Sunrise: Chats Unlocked' : 'Nightfall: Chats Locked',
          body: alertText,
          tag: 'chat-status'
        });
      }
    });
  });

  // Open/Close Voting
  socket.on('gmToggleVoting', async ({ active, votingType }) => {
    if (socket.userId !== 'gm') return;
    const state = getState();
    state.votingActive = active;
    state.votingType = votingType;
    state.votes = {}; // Clear previous votes

    if (active) {
      // Define who can be voted for: all alive players
      state.votingOptions = state.players.filter(p => p.status === 'ALIVE').map(p => p.id);
      
      const text = votingType === 'EXILE' 
        ? '🔊 ROUNDTABLE ACTIVE. Cast your vote in the app to Exile a player.' 
        : '🔊 TRAITORS MURDER PORTAL OPEN. Traitors, cast your vote to murder a Faithful.';
      
      state.messages.push({
        id: 'alert_' + Date.now(),
        senderId: 'gm',
        senderName: 'Game Master',
        channelId: 'gm-alerts',
        text,
        timestamp: new Date().toISOString()
      });

      await saveState();
      broadcastState();

      // Notify targets
      state.players.forEach(p => {
        if (p.status === 'ALIVE') {
          if (votingType === 'EXILE' || (votingType === 'MURDER' && p.role === 'TRAITOR')) {
            notifier.sendPushNotification(p.id, {
              title: votingType === 'EXILE' ? 'Roundtable: Time to Vote' : 'Time to Murder',
              body: text,
              tag: 'voting-status'
            });
          }
        }
      });
    } else {
      state.votingOptions = [];
      await saveState();
      broadcastState();
    }
  });

  // Send generic dramatic broadcast alert
  socket.on('gmAlert', async ({ target, text }) => {
    if (socket.userId !== 'gm') return;
    const state = getState();
    
    // Add custom GM alert message
    state.messages.push({
      id: 'alert_' + Date.now(),
      senderId: 'gm',
      senderName: 'Game Master',
      channelId: 'gm-alerts',
      text: `🚨 ALERT: ${text}`,
      targetId: target,
      timestamp: new Date().toISOString()
    });

    await saveState();
    broadcastState();

    // Trigger target notifications
    state.players.forEach(p => {
      if (p.status === 'ALIVE') {
        const isTarget = target === 'all' 
          || (target === 'traitors' && p.role === 'TRAITOR')
          || (target === 'faithfuls' && p.role === 'FAITHFUL')
          || target === p.id;
          
        if (isTarget) {
          notifier.sendPushNotification(p.id, {
            title: 'Message from the Game Master',
            body: text,
            tag: 'gm-alert'
          });
        }
      }
    });
  });

  // Update individual player status (Alive vs Dead, Exile/Murder result)
  socket.on('gmUpdatePlayerStatus', async ({ playerId, status }) => {
    if (socket.userId !== 'gm') return;
    const state = getState();
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    player.status = status;
    
    // Adjust socket room memberships if active sockets exist
    io.sockets.sockets.forEach((s) => {
      if (s.userId === playerId) {
        if (status === 'DEAD') {
          s.leave('alive');
          s.leave('traitors');
          s.join('dead');
        } else {
          s.leave('dead');
          s.join('alive');
          if (player.role === 'TRAITOR') {
            s.join('traitors');
          }
        }
      }
    });

    const alertText = status === 'DEAD' 
      ? `💀 ${player.name} is no longer with us. They were ${player.role === 'TRAITOR' ? 'a TRAITOR' : 'a FAITHFUL'}.`
      : `❤️ ${player.name} has risen back to the realm of the living.`;

    state.messages.push({
      id: 'alert_' + Date.now(),
      senderId: 'gm',
      senderName: 'Game Master',
      channelId: 'gm-alerts',
      text: alertText,
      timestamp: new Date().toISOString()
    });

    await saveState();
    broadcastState();

    // Push notification to the player themselves and everyone else
    notifier.sendPushNotification(playerId, {
      title: status === 'DEAD' ? 'You Have Been Eliminated' : 'You Have Been Revived',
      body: status === 'DEAD' ? 'You may now only speak in the Graveyard.' : 'You have returned to the game.',
      tag: 'player-status'
    });
    
    state.players.forEach(p => {
      if (p.id !== playerId && p.status === 'ALIVE') {
        notifier.sendPushNotification(p.id, {
          title: status === 'DEAD' ? 'A Player Has Fallen' : 'A Player Has Returned',
          body: alertText,
          tag: 'player-status'
        });
      }
    });
  });

  // Toggle player shield status
  socket.on('gmToggleShield', async ({ playerId }) => {
    if (socket.userId !== 'gm') return;
    const state = getState();
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    player.shielded = !player.shielded;
    
    // Add dramatic alert message
    state.messages.push({
      id: 'alert_' + Date.now(),
      senderId: 'gm',
      senderName: 'Game Master',
      channelId: 'gm-alerts',
      text: player.shielded
        ? `🛡️ A Sacred Shield has been bestowed upon a player from the Tower. They are protected from murder.`
        : `🛡️ The Sacred Shield has faded from a player.`,
      timestamp: new Date().toISOString()
    });

    await saveState();
    broadcastState();

    // Trigger push notification to targeted player
    notifier.sendPushNotification(playerId, {
      title: player.shielded ? 'You are Shielded' : 'Shield Faded',
      body: player.shielded ? 'You are protected from Traitor murder tonight.' : 'Your protective shield has faded.',
      tag: 'shield-status'
    });
  });

  // Finalize voting (tabulates votes, GM can review results before applying)
  socket.on('gmFinalizeVoting', async () => {
    if (socket.userId !== 'gm') return;
    const state = getState();
    if (!state.votingActive) return;

    // Tally votes
    const tallies = {}; // votedId -> count
    Object.values(state.votes).forEach(votedId => {
      tallies[votedId] = (tallies[votedId] || 0) + 1;
    });

    // Generate readable vote summary
    const voteDetails = [];
    Object.entries(state.votes).forEach(([voterId, votedId]) => {
      const voter = state.players.find(p => p.id === voterId);
      const voted = state.players.find(p => p.id === votedId);
      if (voter && voted) {
        voteDetails.push(`${voter.name} voted for ${voted.name}`);
      }
    });

    const action = state.votingType === 'EXILE' ? 'Exiled' : 'Murdered';
    
    // Find winner(s)
    let maxVotes = 0;
    let candidates = [];
    Object.entries(tallies).forEach(([id, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        candidates = [id];
      } else if (count === maxVotes) {
        candidates.push(id);
      }
    });

    let resultText = '';
    if (candidates.length === 0) {
      resultText = `Voting closed. No votes were cast.`;
    } else if (candidates.length === 1) {
      const victim = state.players.find(p => p.id === candidates[0]);
      if (state.votingType === 'MURDER' && victim.shielded) {
        resultText = `🔊 NIGHTFALL MURDER ATTEMPTED! The Traitors targeted ${victim.name}, but their blade shattered against the Sacred Shield! ${victim.name} survives the night.`;
        victim.shielded = false; // consume shield
      } else {
        resultText = `Voting finalized. ${victim.name} received the most votes (${maxVotes}) and has been ${action}!`;
      }
    } else {
      const names = candidates.map(id => state.players.find(p => p.id === id).name).join(' & ');
      resultText = `Voting finalized. TIE between: ${names} (${maxVotes} votes each). GM must decide the tiebreaker!`;
    }

    // Report results to GM
    io.to('gm').emit('votingResults', {
      success: true,
      votingType: state.votingType,
      tallies,
      details: voteDetails,
      summary: resultText
    });

    // Close voting
    state.votingActive = false;
    state.votingOptions = [];
    // Reset votes list
    state.votes = {};
    
    state.messages.push({
      id: 'alert_' + Date.now(),
      senderId: 'gm',
      senderName: 'Game Master',
      channelId: 'gm-alerts',
      text: `🗳️ ${resultText}`,
      timestamp: new Date().toISOString()
    });

    await saveState();
    broadcastState();
  });

  // End Game
  socket.on('gmEndGame', async () => {
    if (socket.userId !== 'gm') return;
    const state = getState();
    state.gameStatus = 'ENDED';
    state.messages.push({
      id: 'alert_' + Date.now(),
      senderId: 'gm',
      senderName: 'Game Master',
      channelId: 'gm-alerts',
      text: '⚔️ THE GAME HAS ENDED. All roles are revealed. Cast your eyes upon the true Traitors!',
      timestamp: new Date().toISOString()
    });
    await saveState();
    broadcastState();
  });

  // Reset lobby
  socket.on('gmResetGame', async () => {
    if (socket.userId !== 'gm') return;
    await resetState();
    broadcastState();
  });

  // --- PLAYER ACTIONS ---

  // Cast vote
  socket.on('castVote', async ({ votedId }) => {
    if (!socket.userId || socket.userId === 'gm') return;
    const state = getState();
    if (!state.votingActive) return;

    // Check if player is alive
    const voter = state.players.find(p => p.id === socket.userId);
    if (!voter || voter.status === 'DEAD') return;

    // Traitors can only vote for murders, Faithfuls and Traitors can vote for exile
    if (state.votingType === 'MURDER' && voter.role !== 'TRAITOR') return;

    // Cast vote
    state.votes[socket.userId] = votedId;
    await saveState();

    // Broadcast that a vote was cast (hiding the selection)
    broadcastState();

    // Report vote to GM real-time
    io.to('gm').emit('gmVoteCast', {
      voterId: socket.userId,
      voterName: voter.name,
      votesCount: Object.keys(state.votes).length
    });
  });

  // Create dynamic custom player group/alliance
  socket.on('createGroup', async ({ name, memberIds }) => {
    if (!socket.userId || socket.userId === 'gm') return;
    const state = getState();

    const creator = state.players.find(p => p.id === socket.userId);
    if (!creator || creator.status === 'DEAD') return;

    // Filter alive players and sanitize member IDs
    const sanitizedMembers = memberIds.filter(id => {
      const p = state.players.find(pl => pl.id === id);
      return p && p.status === 'ALIVE';
    });

    if (!sanitizedMembers.includes(socket.userId)) {
      sanitizedMembers.push(socket.userId);
    }

    if (sanitizedMembers.length < 2) return;

    const groupId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const newGroup = {
      id: groupId,
      name: name.trim().substr(0, 30) || `Alliance #${Date.now().toString().slice(-4)}`,
      memberIds: sanitizedMembers,
      creatorId: socket.userId
    };

    if (!state.groups) state.groups = [];
    state.groups.push(newGroup);

    state.messages.push({
      id: 'alert_' + Date.now(),
      senderId: 'gm',
      senderName: 'Game Master',
      channelId: groupId,
      text: `🕊️ Alliance created: "${newGroup.name}" containing ${newGroup.memberIds.length} players. Conversations are private.`,
      timestamp: new Date().toISOString()
    });

    await saveState();
    broadcastState();

    sanitizedMembers.forEach(memberId => {
      if (memberId !== socket.userId) {
        notifier.sendPushNotification(memberId, {
          title: 'Secret Alliance Formed',
          body: `You have been added to: "${newGroup.name}" by ${creator.name}.`,
          tag: `chat-group-created-${groupId}`
        });
      }
    });
  });

  // GM hides a Sacred Shield behind a painting
  socket.on('gmHideGalleryShield', async ({ paintingId }) => {
    if (socket.userId !== 'gm') return;
    const state = getState();
    
    if (!state.galleryShield) {
      state.galleryShield = {};
    }
    
    state.galleryShield.hiddenPaintingId = paintingId;
    state.galleryShield.claimed = false;
    state.galleryShield.claimedBy = null;

    await saveState();
    broadcastState();
  });

  // Player claims a hidden gallery shield
  socket.on('claimGalleryShield', async ({ paintingId }) => {
    const state = getState();
    const userId = socket.userId;
    if (!userId || userId === 'gm') return;

    const player = state.players.find(p => p.id === userId);
    if (!player || player.status !== 'ALIVE') return;

    if (!state.galleryShield || !state.galleryShield.hiddenPaintingId) {
      return socket.emit('galleryShieldResult', { success: false, error: 'No shield is hidden.' });
    }

    if (state.galleryShield.claimed) {
      return socket.emit('galleryShieldResult', { success: false, error: 'The shield has already been claimed.' });
    }

    if (state.galleryShield.hiddenPaintingId === paintingId) {
      state.galleryShield.claimed = true;
      state.galleryShield.claimedBy = userId;
      player.shielded = true;
      await saveState();
      broadcastState();

      // Send private success socket event to trigger local client animation
      socket.emit('galleryShieldResult', { success: true, paintingId });

      // Trigger push notification to targeted player
      notifier.sendPushNotification(userId, {
        title: 'Sacred Shield Discovered!',
        body: 'You found the hidden shield in the Gallery! You are protected from Traitor murder tonight.',
        tag: 'shield-status'
      });
    } else {
      socket.emit('galleryShieldResult', { success: false, error: 'Nothing is hidden behind this portrait.' });
    }
  });

  // Disconnection handler
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start Express server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
