require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fetch = require('node-fetch');
const { PresentationAnalyzer } = require('./analysis/PresentationAnalyzer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const WISPR_ENDPOINT = process.env.WISPR_ENDPOINT;
const WISPR_KEY = process.env.WISPR_KEY;

// --- Configuration for Live Feedback ---
const LIVE_FEEDBACK_INTERVAL_MS = 5000; // Send feedback every 5 seconds

io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  // Initialize data stores for this specific client's session
  socket._transcript = [];
  socket._lastFeedbackTimestamp = Date.now();

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
      
      if (json && json.words && Array.isArray(json.words) && json.words.length > 0) {
        // Add new words to the transcript and send them to the client for live display
        socket._transcript.push(...json.words);
        socket.emit('transcript-chunk', json.words);
        socket.emit('transcript', { text: json.words.map(w => w.word).join(" ") });

        // --- Live Analysis Logic ---
        // Check if enough time has passed to send a new feedback update
        const now = Date.now();
        if (now - socket._lastFeedbackTimestamp > LIVE_FEEDBACK_INTERVAL_MS) {
          console.log(`Sending live feedback for socket: ${socket.id}`);
          
          // Run analysis on the transcript accumulated so far
          const analyzer = new PresentationAnalyzer(socket._transcript);
          const liveReport = analyzer.runFullAnalysis();
          
          // Emit a separate event for live feedback
          socket.emit('live-feedback', liveReport);
          
          // Reset the timer
          socket._lastFeedbackTimestamp = now;
        }
      }
    } catch (err) {
      console.error('wispr error', err);
    }
  });

  socket.on('end-stream', async () => {
    console.log(`Stream ended. Running FINAL analysis for socket: ${socket.id}`);
    
    if (socket._transcript && socket._transcript.length > 0) {
      try {
        const analyzer = new PresentationAnalyzer(socket._transcript);
        const finalReport = analyzer.runFullAnalysis();
        // The 'final-analysis' event signals the definitive end report
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

