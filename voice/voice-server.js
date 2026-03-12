require('dotenv').config();

const express = require('express');
const { WebSocketServer } = require('ws');
const twilioRoute = require('./routes/twilioWebhook');
const { startDeepgramStream } = require('./services/deepgramService');
const { searchProduct } = require('./services/semanticSearch');
const { lookupCustomer, createOrder } = require('./services/erpService');
const { newCallState, updateState } = require('./services/callState');

const PORT = process.env.VOICE_PORT || 4000;

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use('/incoming-call', twilioRoute);

// Health check — useful for Railway / ngrok to confirm server is up
app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Voice server running on port ${PORT}`);
  console.log(`📞 Twilio webhook → POST /incoming-call`);
  console.log(`🔊 WebSocket stream → wss://YOUR_DOMAIN/audio-stream`);
});

const wss = new WebSocketServer({ server, path: '/audio-stream' });

wss.on('connection', (ws) => {
  console.log('📲 New call connected via WebSocket');

  const state = newCallState();
  let dgStream = null;

  // Start Deepgram stream — handle failure gracefully
  try {
    dgStream = startDeepgramStream(async (transcript) => {
      if (!transcript || !transcript.trim()) return;

      console.log(`🎤 Transcript: "${transcript}"`);

      try {
        const response = await updateState(state, transcript);
        if (response) {
          ws.send(JSON.stringify({ event: 'say', text: response }));
          console.log(`🔊 Response: "${response}"`);
        }
      } catch (err) {
        console.error('❌ Error in updateState:', err.message);
      }
    });
  } catch (err) {
    console.error('❌ Failed to start Deepgram stream:', err.message);
  }

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.event === 'connected') {
        console.log('🔗 Twilio media stream connected');
      }

      if (data.event === 'start') {
        console.log(`📡 Stream started — CallSid: ${data.start?.callSid}`);
      }

     if (data.event === 'media') {
  if (!dgStream) return;
  const audio = Buffer.from(data.media.payload, 'base64');
  console.log('🔊 Audio chunk received, size:', audio.length); // ← add this
  dgStream.send(audio);
}

      if (data.event === 'stop') {
        console.log('🛑 Twilio stream stopped');
      }
    } catch (err) {
      console.error('❌ Error parsing WebSocket message:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('📴 Call ended — WebSocket closed');
    if (dgStream) {
      try { dgStream.finish(); } catch (_) {}
    }
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err.message);
  });
});

// Catch unhandled server errors — don't crash the process
server.on('error', (err) => {
  console.error('❌ Server error:', err.message);
});