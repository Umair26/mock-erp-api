const { WebSocketServer } = require('ws');
const twilio = require('twilio');
const { startDeepgramStream } = require('./services/deepgramService');
const { newCallState, updateState } = require('./services/callState');
const { startCall, getCall, updateCall, endCall } = require('./services/callTracker');

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

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
    console.log(final ? '📴 Goodbye — hanging up' : '✅ TwiML sent');
  } catch (err) {
    console.error('❌ Failed to send TwiML:', err.message);
  }
}

function initVoiceServer(app, server) {
  app.post('/incoming-call', (req, res) => {
    const domain = process.env.DOMAIN;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Welcome to the ordering system. Please state your customer ID or email.</Say>
  <Connect>
    <Stream url="wss://${domain}/audio-stream"/>
  </Connect>
</Response>`;
    res.type('text/xml').send(twiml);
  });

  // Twilio status callback — fired when call ends, gives us duration
  app.post('/call-status', (req, res) => {
  console.log('📊 Raw callback body:', JSON.stringify(req.body));
  const { CallSid, CallDuration, CallStatus } = req.body;
  console.log(`📊 Call status: ${CallStatus} | Duration: ${CallDuration}s | SID: ${CallSid}`);
  if (CallSid && CallDuration) {
    endCall(CallSid, parseInt(CallDuration));
  }
  res.sendStatus(200);
});

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  const wss = new WebSocketServer({ server, path: '/audio-stream' });

  wss.on('connection', (ws) => {
    console.log('📲 New call connected via WebSocket');

    let dgStream = null;
    let callSid = null;
    let processing = false;
    let state = null;
    let deepgramSeconds = 0;
    let streamStartTime = null;

    function startNewDeepgramStream() {
      try {
        dgStream = startDeepgramStream(async (transcript) => {
          if (!transcript || !transcript.trim()) return;
          if (processing) return;
          processing = true;

          console.log(`🎤 Transcript: "${transcript}"`);

          if (/\b(goodbye|bye|ok goodbye|ok bye|good bye)\b/i.test(transcript)) {
            await sendVoiceResponse('Thank you. Goodbye!', callSid);
            processing = false;
            return;
          }

          try {
            const response = await updateState(state, transcript);

            // Track customer name when identified
            if (state.customer && callSid) {
              updateCall(callSid, { customer: state.customer.customer_name });
            }

            // Track order when placed
            if (state.state === 'DONE' && state.lastOrder && callSid) {
              updateCall(callSid, {
                orderPlaced: true,
                orderId: state.lastOrder.order_id,
                orderTotal: state.lastOrder.total_price || 0,
              });
            }

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
          streamStartTime = Date.now();

          if (!callStates.has(callSid)) {
            callStates.set(callSid, newCallState());
            startCall(callSid); // ← start tracking
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
          // Track Deepgram audio duration (each mulaw chunk = 20ms)
          deepgramSeconds += 0.02;
        }

        if (data.event === 'stop') {
          console.log('🛑 Twilio stream stopped');
          if (callSid) {
            updateCall(callSid, { deepgramSeconds: Math.round(deepgramSeconds) });
          }
        }

      } catch (err) {
        console.error('❌ Error parsing WebSocket message:', err.message);
      }
    });

    ws.on('close', () => {
      console.log('📴 Call ended — WebSocket closed');
      if (dgStream) { try { dgStream.finish(); } catch (_) {} }
      if (callSid && state && state.state === 'DONE') {
        callStates.delete(callSid);
      }
    });

    ws.on('error', (err) => console.error('❌ WebSocket error:', err.message));
  });

  console.log('📞 Voice server attached — POST /incoming-call');
  console.log(`🔊 WebSocket stream → wss://${process.env.DOMAIN}/audio-stream`);
}

module.exports = { initVoiceServer };