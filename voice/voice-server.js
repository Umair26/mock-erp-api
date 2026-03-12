require('dotenv').config();

const express = require('express');
const { WebSocketServer } = require('ws');
const twilio = require('twilio');
const twilioRoute = require('./routes/twilioWebhook');
const { startDeepgramStream, synthesizeText } = require('./services/deepgramService');
const { searchProduct } = require('./services/semanticSearch');
const { lookupCustomer, createOrder } = require('./services/erpService');
const { newCallState, updateState } = require('./services/callState');

const PORT = process.env.VOICE_PORT || 4000;

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use('/incoming-call', twilioRoute);

// Health check — useful for Railway / ngrok to confirm server is up
app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

// Helper function to send voice response via TTS and WebSocket
async function sendVoiceResponse(ws, text) {
  try {
    console.log(`🎤 Synthesizing: "${text}"`);
    const audioBuffer = await synthesizeText(text);

    if (!audioBuffer || audioBuffer.length === 0) {
      console.error('❌ TTS returned empty buffer');
      return;
    }

    console.log(`✅ TTS returned ${audioBuffer.length} bytes of audio`);

    // Convert audio buffer to base64 and send through WebSocket as media events
    // Split into chunks matching Twilio's expected size (160 bytes = 20ms at 8kHz)
    const chunkSize = 160;
    let chunkCount = 0;
    for (let i = 0; i < audioBuffer.length; i += chunkSize) {
      const chunk = audioBuffer.slice(i, Math.min(i + chunkSize, audioBuffer.length));
      const mediaEvent = {
        event: 'media',
        media: {
          payload: chunk.toString('base64'),
        },
      };
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(mediaEvent));
        chunkCount++;
      }
      // Small delay between chunks to avoid overwhelming the connection
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    console.log(`📞 Sent voice response to caller: "${text}" (${chunkCount} audio chunks)`);
  } catch (err) {
    console.error('❌ Failed to send voice response:', err.message);
  }
}

// Helper function to escape XML special characters (kept for reference if needed)
function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
        if (response && ws && ws.readyState === 1) {
          // Send response via TTS and WebSocket media stream
          await sendVoiceResponse(ws, response);
        }
      } catch (err) {
        console.error('❌ Error in updateState:', err.message);
        // Send error message via TTS
        if (ws && ws.readyState === 1) {
          await sendVoiceResponse(ws, 'There was an error processing your request. Please try again.');
        }
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
        console.log('🔊 Audio chunk received, size:', audio.length);
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