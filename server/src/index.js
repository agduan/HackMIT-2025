require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fetch = require('node-fetch');
const { PresentationAnalyzer } = require('./analysis/presentationAnalyzer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const WISPR_ENDPOINT = process.env.WISPR_ENDPOINT;
const WISPR_KEY = process.env.WISPR_KEY;

io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  // Initialize a transcript array for this specific client's session
  socket._transcript = [];

  socket.on('audio-chunk', async (arrayBuffer) => {
    const audioBuffer = Buffer.from(arrayBuffer);

    try {
      const res = await fetch(WISPR_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WISPR_KEY}`,
          'Content-Type': 'audio/webm' // Adjust if your audio format is different
        },
        body: audioBuffer
      });
      const json = await res.json();
      
      // --- IMPORTANT ASSUMPTION ---
      // This assumes the Wispr API response includes a `words` array:
      // json.words = [{ word: 'hello', startTime: 0.5, endTime: 1.0 }, ...]
      // You must confirm this based on the actual API response.

      if (json && json.words && Array.isArray(json.words)) {
        socket._transcript.push(...json.words);
        socket.emit('transcript-chunk', json.words);
      }
    } catch (err) {
      console.error('wispr error', err);
    }
  });

  socket.on('end-stream', async () => {
    console.log(`Stream ended. Running full analysis for socket: ${socket.id}`);
    
    if (socket._transcript && socket._transcript.length > 0) {
      try {
        const analyzer = new PresentationAnalyzer(socket._transcript);
        const finalReport = analyzer.runFullAnalysis();
        socket.emit('final-analysis', finalReport);
      } catch (error) {
        console.error('Error during final analysis:', error);
        socket.emit('analysis-error', { message: 'Failed to analyze the presentation.' });
      }
    } else {
      console.log(`No transcript data to analyze for socket: ${socket.id}`);
      socket.emit('analysis-error', { message: 'No transcript was generated to analyze.' });
    }
    // Clear the transcript for the next session
    socket._transcript = [];
  });

  socket.on('disconnect', () => console.log('disconnected', socket.id));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log('listening on', PORT));
