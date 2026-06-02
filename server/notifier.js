const webpush = require('web-push');

let vapidKeys;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY
  };
} else {
  // Generate them dynamically if not provided, and print to logs so user can copy them.
  console.log("VAPID keys not set in environment. Generating temporary ones for this session...");
  vapidKeys = webpush.generateVAPIDKeys();
  console.log("=========================================");
  console.log("TEMPORARY VAPID KEYS GENERATED:");
  console.log("Public Key:", vapidKeys.publicKey);
  console.log("Private Key:", vapidKeys.privateKey);
  console.log("Add these to your environment variables on Railway to persist push subscriptions!");
  console.log("=========================================");
}

webpush.setVapidDetails(
  'mailto:traitors-birthday-game@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

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
