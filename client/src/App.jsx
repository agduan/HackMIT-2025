import { useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";
import "./App.css";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
const socket = io(SOCKET_URL);

function App() {
  const [transcript, setTranscript] = useState("");
  const [metrics, setMetrics] = useState({});
  const mediaRecorderRef = useRef(null);

  useEffect(() => {
    socket.on("transcript", (data) => {
      setTranscript((prev) => prev + " " + data.text);
    });

    socket.on("feedback", (data) => {
      setMetrics(data);
    });

    return () => {
      socket.off("transcript");
      socket.off("feedback");
    };
  }, []);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.addEventListener("dataavailable", async (e) => {
      if (!e.data || e.data.size === 0) return;
      const arrayBuffer = await e.data.arrayBuffer();
      socket.emit("audio-chunk", arrayBuffer);
    });

    mediaRecorder.start(250); // emit every 250ms
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr) {
      mr.stop();
      socket.emit("end-stream");
    }
  };

  return (
    <div className="app-container">
      <h1>Live Presentation Coach</h1>
      <div className="controls">
        <button onClick={startRecording}>Start</button>
        <button onClick={stopRecording}>Stop</button>
      </div>
      <section className="transcript">
        <h2>Transcript (live)</h2>
        <div>{transcript}</div>
      </section>
      <section className="metrics">
        <h2>Feedback Metrics</h2>
        <pre>{JSON.stringify(metrics, null, 2)}</pre>
      </section>
    </div>
  );
}

export default App;
