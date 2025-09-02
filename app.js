require('dotenv').config();
console.log("🟡 Script starting...");
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
  rejectUnauthorized: false,  // accept HiveMQ TLS
  connectTimeout: 4000,
  clientId: `mqttjs_${Math.random().toString(16).slice(2, 10)}`,
});

console.log("🚀 Starting MQTT to Firebase Bridge...");

client.on('connect', () => {
  console.log('✅ Connected to HiveMQ');
  client.subscribe('pot/adc/1', (err) => {
    if (err) {
      console.error('❌ Subscribe error:', err.message);
    } else {
      console.log('📡 Subscribed to pot/adc/1');
    }
  });
});

client.on('message', (topic, message) => {
  const payload = message.toString();
  console.log(`📥 ${topic}: ${payload}`);

  db.ref('mqttData').push({
    topic,
    value: payload,
    timestamp: Date.now(),
  }, (err) => {
    if (err) {
      console.error('❌ Firebase write failed:', err);
    } else {
      console.log('✅ Data saved to Firebase');
    }
  });
});

client.on('error', (err) => {
  console.error('❌ MQTT Error:', err.message);
});

// ---------------- 🛡️ Global Error Handlers ----------------
process.on('uncaughtException', (err) => {
  console.error("🔥 Uncaught Exception:", err);
});

process.on('unhandledRejection', (err) => {
  console.error("🔥 Unhandled Rejection:", err);
});
