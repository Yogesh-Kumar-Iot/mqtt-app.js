require('dotenv').config();
console.log("🟡 Script starting...");

const mqtt = require('mqtt');
const admin = require('firebase-admin');

// ---------------- 🔥 Firebase Setup ----------------
try {
  const serviceAccount = {
    project_id: process.env.FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined,
  };

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    console.log("✅ Firebase initialized");
  }
} catch (err) {
  console.error("❌ Firebase init error:", err.message);
}

const db = admin.database();

// Test Firebase connection
db.ref('test-connection').push({
  message: "App.js is running!",
  timestamp: Date.now(),
}, (err) => {
  if (err) {
    console.error("❌ Test write failed:", err);
  } else {
    console.log("✅ Test data written to Firebase!");
  }
});

// ---------------- 📡 MQTT Setup ----------------
const client = mqtt.connect(`mqtts://${process.env.HIVEMQ_HOST}:${process.env.HIVEMQ_PORT}`, {
  username: process.env.HIVEMQ_USERNAME,
  password: process.env.HIVEMQ_PASSWORD,
  rejectUnauthorized: false,
  connectTimeout: 4000,
  clientId: `mqttjs_${Math.random().toString(16).slice(2, 10)}`,
});

console.log("🚀 Starting MQTT to Firebase Bridge...");

// 🕒 Watchdog Timer
let heartbeatTimeout;

// Function to trigger when no message is received in time
function setOfflineStatus() {
  console.warn("🔴 No MQTT message received in 30s. Marking as offline.");

  db.ref('system-status').push({
    status: "Server is down, check ESP32",
    timestamp: Date.now(),
    lastSeen: Date.now() - 30000 // approx time since last message
  }, (err) => {
    if (err) {
      console.error("❌ Failed to write offline status to Firebase:", err);
    } else {
      console.log("📢 Offline status updated in Firebase");
    }
  });
}

// Reset the watchdog timer
function resetWatchdog() {
  if (heartbeatTimeout) {
    clearTimeout(heartbeatTimeout);
  }

  heartbeatTimeout = setTimeout(() => {
    setOfflineStatus();
  }, 30000); // 30 seconds
}

// On first connect, start the watchdog (waiting for first message)
client.on('connect', () => {
  console.log('✅ Connected to HiveMQ');
  client.subscribe('pot/adc/1', (err) => {
    if (err) {
      console.error('❌ Subscribe error:', err.message);
    } else {
      console.log('📡 Subscribed to pot/adc/1');
      // ✅ Start watchdog: expect a message within 30s
      resetWatchdog();
    }
  });
});

client.on('message', (topic, message) => {
  const payload = message.toString();
  console.log(`📥 ${topic}: ${payload}`);

  // ✅ Reset watchdog on every message
  resetWatchdog();

  // Optional: Clear offline status when data returns
  db.ref('system-status').push({
    topic,
    value: payload,
    status: "online",
    timestamp: Date.now(),
  }, (err) => {
    if (err) {
      console.error('❌ Firebase write failed:', err);
    } else {
      console.log('✅ Data & online status saved to Firebase');
    }
  });
});

client.on('error', (err) => {
  console.error('❌ MQTT Error:', err.message);
  // You might also want to set offline status here if connection drops
});

// ---------------- 🛡️ Global Error Handlers ----------------
process.on('uncaughtException', (err) => {
  console.error("🔥 Uncaught Exception:", err);
});

process.on('unhandledRejection', (err) => {
  console.error("🔥 Unhandled Rejection:", err);
});