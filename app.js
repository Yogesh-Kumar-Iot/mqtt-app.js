require('dotenv').config();
console.log("🟡 Script starting...");

try {
  const mqtt = require('mqtt');
  const admin = require('firebase-admin');

  console.log("✅ Modules loaded");

  const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  };

  if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL  // ← Loaded from .env
  });
  console.log("✅ Firebase initialized");
}
  const db = admin.database();

  // 🔥 Test Write
  db.ref('test-connection').push({
    message: "App.js is running!",
    timestamp: Date.now()
  }, (err) => {
    if (err) {
      console.error("❌ Test write failed:", err);
    } else {
      console.log("✅ Test data written to Firebase!");
    }
  });

const client = mqtt.connect(`mqtts://${process.env.HIVEMQ_HOST}:${process.env.HIVEMQ_PORT}`, {
  username: process.env.HIVEMQ_USERNAME,
  password: process.env.HIVEMQ_PASSWORD,
  rejectUnauthorized: false,  // allow self-signed CA from HiveMQ Cloud
  connectTimeout: 4000,
  clientId: `mqttjs_${Math.random().toString(16).slice(2, 10)}`
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

    db.ref('mqttData').push({ topic, value: payload, timestamp: Date.now() }, (err) => {
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

} catch (err) {
  console.error("❌ Script crashed:", err.message);
}










