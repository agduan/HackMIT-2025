import { useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";
import "./App.css";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
const socket = io(SOCKET_URL);

function App() {
  const [transcript, setTranscript] = useState("");
  const [liveFeedback, setLiveFeedback] = useState(null);
  const [finalAnalysis, setFinalAnalysis] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [videoStream, setVideoStream] = useState(null);
  const [videoFeedbackEnabled, setVideoFeedbackEnabled] = useState(true);
  const mediaRecorderRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    socket.on("transcript-chunk", (words) => {
      const newText = words.map((word) => word.word).join(" ");
      setTranscript((prev) => prev + " " + newText);
    });

    socket.on("live-feedback", (data) => {
      setLiveFeedback(data);
    });

    socket.on("final-analysis", (data) => {
      setFinalAnalysis(data);
      setIsRecording(false);
    });

    socket.on("analysis-error", (data) => {
      setError(data.message);
      setIsRecording(false);
    });

    return () => {
      socket.off("transcript");
      socket.off("live-feedback");
      socket.off("final-analysis");
      socket.off("analysis-error");
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      setTranscript("");
      setLiveFeedback(null);
      setFinalAnalysis(null);

      // Get audio and optionally video
      const mediaConstraints = { audio: true };
      if (videoFeedbackEnabled) {
        mediaConstraints.video = { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: "user" // Front camera
        };
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      
      // Set up video display only if video feedback is enabled
      if (videoFeedbackEnabled) {
        setVideoStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }

      // Check if MediaRecorder is supported and get supported MIME types
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        } else {
          mimeType = "";
        }
      }

      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : {},
      );
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.addEventListener("dataavailable", async (e) => {
        if (!e.data || e.data.size === 0) return;
        const arrayBuffer = await e.data.arrayBuffer();
        socket.emit("audio-chunk", arrayBuffer);
      });

      mediaRecorder.addEventListener("start", () => {
        console.log("MediaRecorder started successfully");
        setIsRecording(true);
      });

      mediaRecorder.addEventListener("error", (e) => {
        console.error("MediaRecorder error:", e);
        setError("Recording error occurred. Please try again.");
        setIsRecording(false);
      });

      mediaRecorder.start(250); // emit every 250ms
    } catch (err) {
      setError("Failed to access camera/microphone. Please check permissions.");
      console.error("Error starting recording:", err);
      setIsRecording(false);
    }
  };

  const toggleVideoFeedback = () => {
    setVideoFeedbackEnabled(!videoFeedbackEnabled);
    // If currently recording, stop and restart with new video setting
    if (isRecording) {
      stopRecording();
      setTimeout(() => {
        startRecording();
      }, 100);
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === "recording") {
      mr.stop();

      // Stop all tracks in the stream to release the microphone and camera
      const stream = mr.stream;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      
      // Clear video stream
      setVideoStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      socket.emit("end-stream");
      console.log("Recording stopped");
    } else {
      console.log("MediaRecorder not recording or not available");
      setIsRecording(false);
    }
  };

  const MetricCard = ({ title, value, feedback, score }) => (
    <div className={`metric-card ${score}`}>
      <h3>{title}</h3>
      <div className="metric-value">{value}</div>
      <p className="metric-feedback">{feedback}</p>
    </div>
  );

  const renderMetrics = (data) => {
    if (!data) return null;

    return (
      <div className="metrics-grid">
        <MetricCard
          title="Speaking Pace"
          value={`${data.pacing?.wpm || 0} WPM`}
          feedback={data.pacing?.feedback}
          score={data.pacing?.score}
        />
        <MetricCard
          title="Filler Words"
          value={`${data.fillerWords?.percentage || 0}%`}
          feedback={data.fillerWords?.feedback}
          score={data.fillerWords?.score}
        />
        <MetricCard
          title="Pauses"
          value={`${data.pauses?.longPauseCount || 0} long pauses`}
          feedback={data.pauses?.feedback}
          score={data.pauses?.score}
        />
        <MetricCard
          title="Sentiment"
          value={data.sentiment?.score || "neutral"}
          feedback={data.sentiment?.feedback}
          score={data.sentiment?.score}
        />
      </div>
    );
  };

  return (
    <div className="app-container">
      <header>
        <h1 style={{ fontFamily: 'Georgia, Times New Roman, serif', fontStyle: 'italic', fontWeight: 300, fontSize: '3em', letterSpacing: '0.02em' }}>Ok, Socrates</h1>
        <div style={{ fontSize: '1em', color: '#888', marginTop: '-0.5em', fontFamily: 'SF Pro, Inter, Arial, sans-serif' }}>
          Your personalized coach for real-time presentation feedback
        </div>
      </header>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      <div className="controls">
        <button
          onClick={startRecording}
          disabled={isRecording}
          className={`control-btn start-btn ${isRecording ? "disabled" : ""}`}
        >
          {isRecording ? "Recording..." : "Start Presentation"}
        </button>
        <button
          onClick={stopRecording}
          disabled={!isRecording}
          className={`control-btn stop-btn ${!isRecording ? "disabled" : ""}`}
        >
          Stop & Analyze
        </button>
        <div className="video-toggle-container">
          <label className="toggle-label">
            <span>Video Feedback</span>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={videoFeedbackEnabled}
                onChange={toggleVideoFeedback}
                className="toggle-input"
              />
              <span className="toggle-slider"></span>
            </div>
          </label>
        </div>
      </div>

      {isRecording && (
        <div className="recording-indicator">
          <div className="pulse"></div>
          <span>Live analysis in progress...</span>
        </div>
      )}

      <div className="main-content">
        {/* Top section: Video and Feedback side by side */}
        <div className="top-section">
          {/* Video Section - Left */}
          <section className="video-section">
            <h2>Your Presentation</h2>
            <div className="video-container">
              {!videoFeedbackEnabled ? (
                <div className="video-placeholder">
                  <div className="placeholder-icon">Video</div>
                  <p>Video feedback turned off</p>
                </div>
              ) : videoStream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="presentation-video"
                />
              ) : (
                <div className="video-placeholder">
                  <div className="placeholder-icon">Video</div>
                  <p>Click "Start Presentation" to begin video</p>
                </div>
              )}
            </div>
          </section>

          {/* Feedback Section - Right */}
          <section className="feedback-section">
            <h2>Real-time Feedback</h2>
            {liveFeedback && (
              <div className="live-feedback">
                <h3>Live Analysis</h3>
                {renderMetrics(liveFeedback)}
              </div>
            )}

            {finalAnalysis && (
              <div className="final-analysis">
                <h3>Final Analysis</h3>
                {renderMetrics(finalAnalysis)}

                {finalAnalysis.followUpQuestions &&
                  finalAnalysis.followUpQuestions.length > 0 && (
                    <div className="followup-questions">
                      <h4>Suggested Follow-up Questions</h4>
                      <ul>
                        {finalAnalysis.followUpQuestions.map(
                          (question, index) => (
                            <li key={index}>{question}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
              </div>
            )}
            
            {!liveFeedback && !finalAnalysis && (
              <div className="feedback-placeholder">
                <div className="placeholder-icon">Feedback</div>
                <p>Start presenting to see real-time feedback</p>
              </div>
            )}
          </section>
        </div>

        {/* Bottom section: Transcript */}
        <section className="transcript-section">
          <h2>Live Transcript</h2>
          <div className="transcript-content">
            {transcript || "Start speaking to see your transcript here..."}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
