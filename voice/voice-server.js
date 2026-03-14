require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const { WebSocketServer } = require('ws');
const twilio = require('twilio');
const twilioRoute = require('./routes/twilioWebhook');
const { startDeepgramStream } = require('./services/deepgramService');
const { newCallState, updateState } = require('./services/callState');

const PORT = process.env.VOICE_PORT || 4000;

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use('/incoming-call', twilioRoute);

app.get('/health', (req, res) => res.json({ status: 'ok', port: PORT }));

const callStates = new Map();

function isFinalMessage(text) {
  return /\b(goodbye|bye|auf wiedersehen|tschüss|session has ended)\b/i.test(text);
}

async function sendVoiceResponse(text, callSid) {
  try {
    console.log(`🔊 Response: "${text}"`);
    const domain = process.env.DOMAIN;
    const final = isFinalMessage(text);
    const twiml = final
      ? `<Response><Say>${text}</Say><Hangup/></Response>`
      : `<Response><Say>${text}</Say><Connect><Stream url="wss://${domain}/audio-stream"/></Connect></Response>`;

    await twilioClient.calls(callSid).update({ twiml });
    console.log(final ? '📴 Goodbye — call will hang up' : '✅ TwiML sent to caller');
  } catch (err) {
    console.error('❌ Failed to send TwiML:', err.message);
  }
}

const server = app.listen(PORT, () => {
  console.log(`✅ Voice server running on port ${PORT}`);
  console.log(`📞 Twilio webhook → POST /incoming-call`);
  console.log(`🔊 WebSocket stream → wss://${process.env.DOMAIN}/audio-stream`);
});

const wss = new WebSocketServer({ server, path: '/audio-stream' });

wss.on('connection', (ws) => {
  console.log('📲 New call connected via WebSocket');

  let dgStream = null;
  let callSid = null;
  let processing = false;
  let state = null;

  function startNewDeepgramStream() {
    try {
      dgStream = startDeepgramStream(async (transcript) => {
        if (!transcript || !transcript.trim()) return;
        if (processing) return;
        processing = true;

        console.log(`🎤 Transcript: "${transcript}"`);

        // Customer said goodbye
        if (/\b(goodbye|bye|ok goodbye|ok bye|good bye)\b/i.test(transcript)) {
          await sendVoiceResponse('Thank you. Goodbye!', callSid);
          processing = false;
          return;
        }

        try {
          const response = await updateState(state, transcript);
          if (response && callSid) {
            await sendVoiceResponse(response, callSid);
          }
        } catch (err) {
          console.error('❌ Error in updateState:', err.message);
          if (callSid) await sendVoiceResponse('There was an error. Please try again.', callSid);
        }

        processing = false;
      });
    } catch (err) {
      console.error('❌ Failed to start Deepgram stream:', err.message);
    }
  }

  startNewDeepgramStream();

  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.event === 'connected') {
        console.log('🔗 Twilio media stream connected');
      }

      if (data.event === 'start') {
        callSid = data.start?.callSid;

        if (!callStates.has(callSid)) {
          callStates.set(callSid, newCallState());
          console.log(`📡 New call — CallSid: ${callSid}`);
        } else {
          console.log(`📡 Reconnected — CallSid: ${callSid} | State: ${callStates.get(callSid).state}`);
        }

        state = callStates.get(callSid);
      }

      if (data.event === 'media') {
        if (!dgStream || !state) return;
        const audio = Buffer.from(data.media.payload, 'base64');
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
    if (dgStream) { try { dgStream.finish(); } catch (_) {} }
    // Only delete state when call is fully done — NOT on every stream reconnect
    if (callSid && state && state.state === 'DONE') {
      callStates.delete(callSid);
      console.log(`🗑️ State cleared for ${callSid}`);
    }
  });

  ws.on('error', (err) => console.error('❌ WebSocket error:', err.message));
});

server.on('error', (err) => console.error('❌ Server error:', err.message));