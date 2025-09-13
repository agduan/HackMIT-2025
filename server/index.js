require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fetch = require('node-fetch'); // or undici

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const WISPR_ENDPOINT = process.env.WISPR_ENDPOINT; // set in .env
const WISPR_KEY = process.env.WISPR_KEY;

io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  // buffer per-session if needed
  socket._audioBuffers = [];

  socket.on('audio-chunk', async (arrayBuffer) => {
    // arrayBuffer arrives as ArrayBuffer or Buffer depending on client
    const audioBuffer = Buffer.from(arrayBuffer);
    socket._audioBuffers.push(audioBuffer);

    // OPTION A: forward each chunk to Wispr if Wispr supports streaming
    // OPTION B: accumulate and send short aggregated chunks (e.g., every 1s)
    // Here we demonstrate a simple POST per-chunk (replace with real streaming)
    try {
      const res = await fetch(WISPR_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WISPR_KEY}`,
          'Content-Type': 'audio/webm' // adjust to actual content type
        },
        body: audioBuffer
      });
      const json = await res.json();
      // Example: emit transcript as soon as you get it
      if (json && json.text) {
        socket.emit('transcript', { text: json.text, start: json.start, end: json.end });
        // run quick analysis and emit feedback
        const feedback = analyzeTranscriptAndMetrics(json.text, socket);
        socket.emit('feedback', feedback);
      }
    } catch (err) {
      console.error('wispr error', err);
    }
  });

  socket.on('end-stream', async () => {
    // optional: finalize session, send remaining buffered audio as one file
    // const finalBuffer = Buffer.concat(socket._audioBuffers);
    // forward finalBuffer to Wispr for final transcription
  });

  socket.on('disconnect', () => console.log('disconnected', socket.id));
});

function analyzeTranscriptAndMetrics(text, socket) {
  // Simple JS analyzer — replace with more advanced pipeline
  const fillerWords = ['um','uh','like','you know','so','actually','basically'];
  const fillerCount = fillerWords.reduce((acc,w) => acc + ((text.match(new RegExp('\\b'+w+'\\b','gi'))||[]).length), 0);
  const words = text.split(/\s+/).filter(Boolean).length;
  // assume you have start/end timestamps — if not, use approximate duration
  const durationSec = socket._startTs ? (Date.now()-socket._startTs)/1000 : Math.max(1, words/2);
  const wpm = Math.round((words / durationSec) * 60);
  const clarity = Math.max(0, Math.round(100 - fillerCount*4 - Math.abs(wpm-130)/2));
  return { fillerCount, words, wpm, clarity };
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log('listening on', PORT));
