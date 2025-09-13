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
  const [videoFeedbackEnabled, setVideoFeedbackEnabled] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [selectedAnalysisType, setSelectedAnalysisType] = useState("general");
  const mediaRecorderRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    // Handle final transcript chunks with timestamps
    socket.on("transcript", (data) => {
      setTranscript((prev) => prev + " " + data.text);
    });

    // Handle interim (real-time) transcript results
    socket.on("interim-transcript", (data) => {
      // You can use this for showing real-time typing effect
      console.log("Interim:", data.text);
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

    socket.on("transcription-error", (data) => {
      setError(`Transcription error: ${data.message}`);
    });

    // fetch private JSON from Vercel API
    fetch("/api/get-json")
      .then((res) => res.json())
      .then((data) => {
        console.log("Private JSON from server:", data);
      })
      .catch((err) => console.error(err));

    return () => {
      socket.off("transcript");
      socket.off("interim-transcript");
      socket.off("live-feedback");
      socket.off("final-analysis");
      socket.off("analysis-error");
      socket.off("transcription-error");
    };
  }, []);

  // Send analysis type to server when it changes
  useEffect(() => {
    socket.emit("set-analysis-type", { analysisType: selectedAnalysisType });
  }, [selectedAnalysisType]);

  const startRecording = async () => {
    try {
      setError(null);
      setTranscript("");
      setLiveFeedback(null);
      setFinalAnalysis(null);

      console.log("Starting recording with video:", videoFeedbackEnabled);

      // Get audio and optionally video - optimize video constraints
      const mediaConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      };

      if (videoFeedbackEnabled) {
        mediaConstraints.video = {
          width: { ideal: 320, max: 480 }, // Reduced from 640
          height: { ideal: 240, max: 360 }, // Reduced from 480
          facingMode: "user",
          frameRate: { ideal: 15, max: 20 }, // Limit frame rate
        };
      }

      console.log("Requesting media with constraints:", mediaConstraints);
      const stream =
        await navigator.mediaDevices.getUserMedia(mediaConstraints);
      console.log(
        "Media stream obtained:",
        stream.getTracks().map((t) => `${t.kind}: ${t.label}`),
      );

      // Set up video display with the full stream (including video)
      if (videoFeedbackEnabled) {
        setVideoStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }

      // Check if MediaRecorder is supported and get supported MIME types
      // let mimeType = "audio/webm";
      // if (!MediaRecorder.isTypeSupported("audio/webm")) {
      //   if (MediaRecorder.isTypeSupported("audio/mp4")) {
      //     mimeType = "audio/mp4";
      //   } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
      //     mimeType = "audio/ogg";
      //   } else {
      //     mimeType = "";
      //   }
      // }

      let mimeType = "";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
        // Only use this if your server also supports OGG/Opus (yours expects WEBM_OPUS)
        mimeType = "audio/ogg;codecs=opus";
      } // else leave empty and let the browser pick

      console.log("Using MIME type:", mimeType);

      // Create MediaRecorder with only audio track to avoid conflicts
      const audioOnlyStream = new MediaStream([stream.getAudioTracks()[0]]);
      const mediaRecorder = new MediaRecorder(
        audioOnlyStream,
        mimeType ? { mimeType } : {},
      );
      mediaRecorderRef.current = mediaRecorder;

      // Store the full stream reference for cleanup
      mediaRecorder.fullStream = stream;

      mediaRecorder.addEventListener("dataavailable", async (e) => {
        if (!e.data || e.data.size === 0) return;
        console.log("Audio chunk size:", e.data.size, "bytes");
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

      // Use longer intervals to reduce processing overhead
      mediaRecorder.start(500); // emit every 500ms instead of 250ms
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
    console.log("Stopping recording...");
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === "recording") {
      mr.stop();

      // Stop all tracks in the full stream (both audio and video)
      const fullStream = mr.fullStream;
      if (fullStream) {
        fullStream.getTracks().forEach((track) => {
          console.log(`Stopping ${track.kind} track:`, track.label);
          track.stop();
        });
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
        {data.qualitativeFeedback && (
          <div className="qualitative-feedback-card">
            <h3>AI Feedback</h3>
            <div className="feedback-content">
              {data.qualitativeFeedback.feedback}
            </div>
            {data.qualitativeFeedback.source === "error" && (
              <p className="error-note">Note: Using fallback analysis</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      <header>
        <h1
          style={{
            fontFamily: "Georgia, Times New Roman, serif",
            fontStyle: "italic",
            fontWeight: 300,
            fontSize: "3em",
            letterSpacing: "0.02em",
          }}
        >
          Ok, Socrates
        </h1>
        <div
          style={{
            fontSize: "1em",
            color: "#888",
            marginTop: "-0.5em",
            fontFamily:
              'SF Pro, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
          }}
        >
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
        <div className="options-dropdown">
          <button
            onClick={() => setIsOptionsOpen(!isOptionsOpen)}
            className="options-btn"
          >
            {selectedAnalysisType === "general" && "General"}
            {selectedAnalysisType === "teaching" && "Teaching"}
            {selectedAnalysisType === "interview" && "Interview"}
            {selectedAnalysisType === "academic" && "Academic"}
            {" ▼"}
          </button>
          {isOptionsOpen && (
            <div className="dropdown-menu">
              <div
                className={`dropdown-item ${selectedAnalysisType === "general" ? "active" : ""}`}
                onClick={() => {
                  setSelectedAnalysisType("general");
                  setIsOptionsOpen(false);
                }}
              >
                General
              </div>
              <div
                className={`dropdown-item ${selectedAnalysisType === "teaching" ? "active" : ""}`}
                onClick={() => {
                  setSelectedAnalysisType("teaching");
                  setIsOptionsOpen(false);
                }}
              >
                Teaching
              </div>
              <div
                className={`dropdown-item ${selectedAnalysisType === "interview" ? "active" : ""}`}
                onClick={() => {
                  setSelectedAnalysisType("interview");
                  setIsOptionsOpen(false);
                }}
              >
                Interview
              </div>
              <div
                className={`dropdown-item ${selectedAnalysisType === "academic" ? "active" : ""}`}
                onClick={() => {
                  setSelectedAnalysisType("academic");
                  setIsOptionsOpen(false);
                }}
              >
                Academic/Research
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="main-content">
        {/* Top section: Video and Feedback side by side */}
        <div className="top-section">
          {/* Video Section - Left */}
          <section className="video-section">
            <h2>
              Your Presentation
              {isRecording && (
                <span
                  style={{
                    marginLeft: "10px",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <div
                    className="pulse"
                    style={{ width: "12px", height: "12px" }}
                  ></div>
                </span>
              )}
            </h2>
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
