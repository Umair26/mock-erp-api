require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');

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
    endpointing: 1000,
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

module.exports = { startDeepgramStream };
