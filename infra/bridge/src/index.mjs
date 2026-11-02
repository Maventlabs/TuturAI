/**
 * TuturAI bridge: MQTT -> Cloud Firestore.
 *
 * The device talks MQTT over TLS; the web dashboard reads Firestore. The bridge
 * is the only component that is allowed to publish to the `config` and `cmd`
 * topics, and the only one that writes device documents.
 *
 * Two rules shape this file:
 *
 * 1. Write budget. Telemetry is written at most once per 60 s per device. The
 *    repository has already hit Firestore RESOURCE_EXHAUSTED once, so an
 *    unbounded write here would take the whole product down.
 *
 * 2. No secret in the log. An invalid payload is counted and described by shape,
 *    never echoed. A payload can contain a device identifier, and in a bug it
 *    could contain a credential.
 */
import { readFileSync } from 'node:fs';
import { createPrivateKey } from 'node:crypto';
import { pathToFileURL } from 'node:url';
// The library is branded "MQTT.js" on GitHub but published to npm as `mqtt`,
// and imported as `mqtt`. Using the GitHub name here is a 404.
import mqtt from 'mqtt';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const TELEMETRY_INTERVAL_MS = 60_000;
const FIRESTORE_COLLECTION = 'devices';

/** Read configuration from the environment. Nothing is hardcoded. */
function loadConfig() {
  const required = [
    'MQTT_URL',
    'MQTT_CA_CERT',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`missing required environment variables: ${missing.join(', ')}`);
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH is required');
  }

  return {
    mqttUrl: process.env.MQTT_URL,
    mqttCa: readFileSync(process.env.MQTT_CA_CERT, 'utf8'),
    mqttAdminPort: Number(process.env.MQTT_ADMIN_PORT ?? 9001),
    mqttAdminUsername: process.env.MQTT_ADMIN_USERNAME,
    mqttAdminPassword: process.env.MQTT_ADMIN_PASSWORD,
    firebase: JSON.parse(readFileSync(serviceAccountPath, 'utf8')),
  };
}

function initFirestore(firebaseConfig) {
  const app = initializeApp({
    credential: cert({
      projectId: firebaseConfig.project_id,
      clientEmail: firebaseConfig.client_email,
      // The key arrives as a PEM literal; Firebase expects the literal newlines.
      privateKey: createPrivateKey(firebaseConfig.private_key).export({
        type: 'pkcs8',
        format: 'pem',
      }),
    }),
  });
  return getFirestore(app);
}

/**
 * Splits a device topic into its parts.
 *
 * Returns null for anything that is not an exact
 * tuturai/devices/{deviceId}/{leaf} path. A wildcard or a longer path is
 * rejected rather than parsed leniently, because a device that could talk to a
 * topic outside its own namespace would be a security defect.
 */
export function parseTopic(topic) {
  if (typeof topic !== 'string') return null;
  const segments = topic.split('/');
  if (segments.length !== 4) return null;
  if (segments[0] !== 'tuturai' || segments[1] !== 'devices') return null;

  const [, , deviceId, leaf] = segments;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(deviceId)) return null;

  const leaves = new Set(['presence', 'telemetry', 'ack', 'config', 'cmd']);
  if (!leaves.has(leaf)) return null;

  return { deviceId, leaf };
}

/**
 * Validates a telemetry payload against the same contract the server enforces.
 * parseDeviceHeartbeat() rejects unknown keys, so this mirrors it exactly rather
 * than accepting a superset.
 */
export function validateTelemetry(payload) {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const allowed = new Set(['battery', 'signal', 'firmware']);
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) return null;
  }

  const telemetry = {};
  for (const key of ['battery', 'signal']) {
    if (payload[key] === undefined) continue;
    const value = payload[key];
    if (!Number.isInteger(value) || value < 0 || value > 100) return null;
    telemetry[key] = value;
  }

  if (payload.firmware !== undefined) {
    if (typeof payload.firmware !== 'string') return null;
    const trimmed = payload.firmware.trim();
    if (trimmed.length === 0 || trimmed.length > 64) return null;
    telemetry.firmware = trimmed;
  }

  return telemetry;
}

async function main() {
  const config = loadConfig();
  const db = initFirestore(config.firebase);

  // Telemetry is throttled per device, not globally: one chatty device must not
  // starve the others.
  const lastWrite = new Map();
  const counters = { accepted: 0, rejected: 0, throttled: 0 };

  const client = mqtt.connect(config.mqttUrl, {
    ca: config.mqttCa,
    // The bridge uses the admin account because it subscribes across all devices.
    username: config.mqttAdminUsername,
    password: config.mqttAdminPassword,
    reconnectPeriod: 5_000,
    clean: true,
  });

  client.on('connect', () => {
    console.log('bridge connected to the broker');
    // Subscribe across every device for presence and telemetry. The bridge is
    // permitted wildcards; devices are not.
    client.subscribe('tuturai/devices/+/presence', { qos: 1 });
    client.subscribe('tuturai/devices/+/telemetry', { qos: 0 });
    client.subscribe('tuturai/devices/+/ack', { qos: 1 });
  });

  client.on('message', (topic, buffer) => {
    const parsed = parseTopic(topic);
    if (parsed === null) {
      counters.rejected += 1;
      console.warn(`rejected topic with unexpected shape: ${topic}`);
      return;
    }

    let payload;
    try {
      payload = JSON.parse(buffer.toString('utf8'));
    } catch {
      counters.rejected += 1;
      console.warn(`rejected malformed JSON on ${parsed.leaf}`);
      return;
    }

    if (parsed.leaf === 'telemetry') {
      const telemetry = validateTelemetry(payload);
      if (telemetry === null) {
        counters.rejected += 1;
        console.warn('rejected telemetry with invalid shape');
        return;
      }

      const now = Date.now();
      const previous = lastWrite.get(parsed.deviceId) ?? 0;
      if (now - previous < TELEMETRY_INTERVAL_MS) {
        counters.throttled += 1;
        return;
      }
      lastWrite.set(parsed.deviceId, now);
    }

    counters.accepted += 1;

    db.collection(FIRESTORE_COLLECTION)
      .doc(parsed.deviceId)
      .set(
        {
          [parsed.leaf]: payload,
          lastSeenAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      .catch((error) => {
        // The error message can contain a document path, never a payload.
        console.error(`firestore write failed for ${parsed.leaf}: ${error.code ?? 'unknown'}`);
      });
  });

  client.on('error', (error) => console.error('bridge mqtt error:', error.message));

  setInterval(() => {
    console.log(
      `bridge stats accepted=${counters.accepted} rejected=${counters.rejected} throttled=${counters.throttled}`,
    );
  }, 60_000);
}

// Only start the bridge when this file is executed directly. Without this guard
// importing the module for a unit test would open a real MQTT connection and
// exit the process.
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error('bridge failed to start:', error.message);
    process.exitCode = 1;
  });
}