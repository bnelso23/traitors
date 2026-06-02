const webpush = require('web-push');

const cleanKey = (key) => {
  if (!key) return '';
  return key.trim().replace(/^['"]|['"]$/g, '').trim();
};

let vapidKeys = null;
let keysLoadedSuccessfully = false;

const envPublicKey = cleanKey(process.env.VAPID_PUBLIC_KEY);
const envPrivateKey = cleanKey(process.env.VAPID_PRIVATE_KEY);

if (envPublicKey && envPrivateKey) {
  try {
    webpush.setVapidDetails(
      'mailto:traitors-birthday-game@example.com',
      envPublicKey,
      envPrivateKey
    );
    vapidKeys = {
      publicKey: envPublicKey,
      privateKey: envPrivateKey
    };
    keysLoadedSuccessfully = true;
    console.log("VAPID Keys loaded successfully from environment variables.");
  } catch (err) {
    console.error("=========================================");
    console.error("CRITICAL WARNING: The VAPID Keys in your environment variables are INVALID!");
    console.error("Error details:", err.message);
    console.error("Falling back to generating temporary VAPID keys to prevent server crash.");
    console.error("=========================================");
  }
}

if (!keysLoadedSuccessfully) {
  console.log("Generating temporary VAPID keys for this session...");
  vapidKeys = webpush.generateVAPIDKeys();
  try {
    webpush.setVapidDetails(
      'mailto:traitors-birthday-game@example.com',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
    console.log("=========================================");
    console.log("TEMPORARY VAPID KEYS GENERATED:");
    console.log("Public Key:", vapidKeys.publicKey);
    console.log("Private Key:", vapidKeys.privateKey);
    console.log("Please copy these and add them to Railway variables to persist push alerts!");
    console.log("=========================================");
  } catch (err) {
    console.error("Failed to initialize VAPID details with temporary keys:", err);
  }
}

// We will store push subscriptions in memory
const subscriptions = {}; // playerId -> array of subscription objects

function addSubscription(playerId, subscription) {
  if (!subscriptions[playerId]) {
    subscriptions[playerId] = [];
  }
  // Avoid duplicate subscriptions
  const exists = subscriptions[playerId].some(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    subscriptions[playerId].push(subscription);
  }
}

function removeSubscription(playerId, endpoint) {
  if (subscriptions[playerId]) {
    subscriptions[playerId] = subscriptions[playerId].filter(s => s.endpoint !== endpoint);
  }
}

async function sendPushNotification(playerId, payload) {
  if (!subscriptions[playerId] || subscriptions[playerId].length === 0) {
    return;
  }

  const payloadString = JSON.stringify(payload);
  const sendPromises = subscriptions[playerId].map(async (sub) => {
    try {
      await webpush.sendNotification(sub, payloadString);
    } catch (error) {
      console.error(`Error sending push notification to player ${playerId}:`, error);
      if (error.statusCode === 410 || error.statusCode === 404) {
        // Subscription expired or unsubscribed, remove it
        removeSubscription(playerId, sub.endpoint);
      }
    }
  });

  await Promise.all(sendPromises);
}

module.exports = {
  vapidPublicKey: vapidKeys.publicKey,
  addSubscription,
  removeSubscription,
  sendPushNotification,
  subscriptions
};
