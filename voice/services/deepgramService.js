require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const https = require('https');

function startDeepgramStream(onTranscript) {
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  console.log('🔑 Deepgram API key:', process.env.DEEPGRAM_API_KEY ? 'loaded' : 'MISSING');

  const live = deepgram.listen.live({
    model: 'nova-2',
    language: 'en-US',
    encoding: 'mulaw',
    sample_rate: 8000,
    punctuate: true,
    interim_results: true,
    endpointing: 15000,  // 15 seconds of silence before closing stream (allows TTS response + customer thinking time)
  });

  live.on(LiveTranscriptionEvents.Open, () => {
    console.log('🎙️  Deepgram connection open');
  });

  live.on(LiveTranscriptionEvents.Transcript, (data) => {
    console.log('📦 Raw:', JSON.stringify(data).slice(0, 200));
    const alt = data?.channel?.alternatives?.[0];
    const text = alt?.transcript?.trim();
    if (text && data.is_final) {
      console.log(`📝 Final transcript: "${text}"`);
      onTranscript(text);
    }
  });

  live.on(LiveTranscriptionEvents.Error, (err) => {
    console.error('❌ Deepgram error:', err);
  });

  live.on(LiveTranscriptionEvents.Close, () => {
    console.log('🔌 Deepgram connection closed');
  });

  return live;
}

// Text-to-speech using Deepgram REST API
async function synthesizeText(text) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error('❌ DEEPGRAM_API_KEY not set');
      return reject(new Error('DEEPGRAM_API_KEY not set'));
    }

    const options = {
      hostname: 'api.deepgram.com',
      port: 443,
      path: '/v1/speak?model=aura-asteria-en&encoding=mulaw&sample_rate=8000',
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify({ text })),
      },
    };

    console.log('📡 Calling Deepgram TTS API...');
    const req = https.request(options, (res) => {
      console.log(`📡 TTS API Response Status: ${res.statusCode}`);
      let data = Buffer.alloc(0);

      res.on('data', (chunk) => {
        console.log(`📥 TTS API returned data chunk: ${chunk.length} bytes`);
        data = Buffer.concat([data, chunk]);
      });

      res.on('end', () => {
        console.log(`📦 TTS API complete - Total audio: ${data.length} bytes`);
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          console.error(`❌ TTS API error - Status: ${res.statusCode}`);
          reject(new Error(`Deepgram TTS failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (e) => {
      console.error(`❌ TTS API request failed: ${e.message}`);
      reject(new Error(`Deepgram TTS request failed: ${e.message}`));
    });

    req.setTimeout(10000, () => {
      console.error('❌ TTS API request timeout');
      req.destroy();
      reject(new Error('Deepgram TTS request timeout'));
    });

    console.log(`📨 Sending TTS request: "${text.slice(0, 50)}..."`);
    req.write(JSON.stringify({ text }));
    req.end();
  });
}

module.exports = { startDeepgramStream, synthesizeText };
