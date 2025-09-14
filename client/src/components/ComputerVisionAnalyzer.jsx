import { useRef, useEffect, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Pose } from '@mediapipe/pose';
import { Hands } from '@mediapipe/hands';

const ComputerVisionAnalyzer = ({ videoRef, onAnalysisUpdate }) => {
  const canvasRef = useRef(null);
  const faceMeshRef = useRef(null);
  const poseRef = useRef(null);
  const handsRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Eye contact tracking state
  const [eyeContactData, setEyeContactData] = useState({
    isLookingAtCamera: false,
    eyeContactPercentage: 0,
    gazeDirection: 'center'
  });

  // Body language analysis state
  const [bodyLanguageData, setBodyLanguageData] = useState({
    posture: 'good',
    handGestures: 0,
    movement: 'minimal',
    confidence: 0
  });

  useEffect(() => {
    const initializeMediaPipe = async () => {
      try {
        // Initialize Face Mesh for eye tracking
        const faceMesh = new FaceMesh({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        // Initialize Pose for body language
        const pose = new Pose({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        // Initialize Hands for gesture detection
        const hands = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        // Set up face mesh results
        faceMesh.onResults((results) => {
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            analyzeEyeContact(results.multiFaceLandmarks[0]);
          }
        });

        // Set up pose results
        pose.onResults((results) => {
          if (results.poseLandmarks) {
            analyzeBodyLanguage(results.poseLandmarks);
          }
        });

        // Set up hands results
        hands.onResults((results) => {
          if (results.multiHandLandmarks) {
            analyzeHandGestures(results.multiHandLandmarks);
          }
        });

        faceMeshRef.current = faceMesh;
        poseRef.current = pose;
        handsRef.current = hands;

        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing MediaPipe:', error);
      }
    };

    initializeMediaPipe();
  }, []);

  const analyzeEyeContact = (landmarks) => {
    if (!landmarks) return;

    // Key eye landmarks (approximate indices for MediaPipe Face Mesh)
    const leftEyeInner = landmarks[33];
    const leftEyeOuter = landmarks[133];
    const rightEyeInner = landmarks[362];
    const rightEyeOuter = landmarks[263];
    const noseTip = landmarks[1];

    // Calculate eye center points
    const leftEyeCenter = {
      x: (leftEyeInner.x + leftEyeOuter.x) / 2,
      y: (leftEyeInner.y + leftEyeOuter.y) / 2
    };

    const rightEyeCenter = {
      x: (rightEyeInner.x + rightEyeOuter.x) / 2,
      y: (rightEyeInner.y + rightEyeOuter.y) / 2
    };

    // Calculate gaze direction relative to camera
    const eyeCenterX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
    const eyeCenterY = (leftEyeCenter.y + rightEyeCenter.y) / 2;

    // Determine if looking at camera (center of frame)
    const centerThreshold = 0.1; // 10% tolerance
    const isLookingAtCamera = Math.abs(eyeCenterX - 0.5) < centerThreshold && 
                             Math.abs(eyeCenterY - 0.5) < centerThreshold;

    // Determine gaze direction
    let gazeDirection = 'center';
    if (eyeCenterX < 0.3) gazeDirection = 'left';
    else if (eyeCenterX > 0.7) gazeDirection = 'right';
    else if (eyeCenterY < 0.3) gazeDirection = 'up';
    else if (eyeCenterY > 0.7) gazeDirection = 'down';

    const newEyeContactData = {
      isLookingAtCamera,
      eyeContactPercentage: isLookingAtCamera ? 100 : 0,
      gazeDirection
    };

    setEyeContactData(newEyeContactData);
  };

  const analyzeBodyLanguage = (landmarks) => {
    if (!landmarks) return;

    // Key pose landmarks
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    // Analyze posture
    const shoulderCenter = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2
    };

    const hipCenter = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2
    };

    // Calculate spine alignment
    const spineAlignment = Math.abs(shoulderCenter.x - hipCenter.x);
    let posture = 'good';
    if (spineAlignment > 0.1) posture = 'slouched';
    else if (spineAlignment > 0.05) posture = 'slightly_off';

    // Calculate confidence (based on landmark visibility)
    const confidence = landmarks.filter(landmark => landmark.visibility > 0.5).length / landmarks.length;

    setBodyLanguageData(prev => ({
      ...prev,
      posture,
      confidence: confidence * 100
    }));
  };

  const analyzeHandGestures = (handLandmarks) => {
    if (!handLandmarks) return;

    // Count active hand gestures
    let gestureCount = 0;
    
    handLandmarks.forEach(hand => {
      // Simple gesture detection based on finger positions
      const thumb = hand[4];
      const index = hand[8];
      const middle = hand[12];
      const ring = hand[16];
      const pinky = hand[20];

      // Check if fingers are extended (simple gesture detection)
      const fingersExtended = [thumb, index, middle, ring, pinky].filter(finger => 
        finger.y < hand[0].y // Wrist landmark
      ).length;

      if (fingersExtended > 2) {
        gestureCount++;
      }
    });

    setBodyLanguageData(prev => ({
      ...prev,
      handGestures: gestureCount
    }));
  };

  const processFrame = async () => {
    if (!isInitialized || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Process with MediaPipe
    if (faceMeshRef.current) {
      await faceMeshRef.current.send({ image: canvas });
    }

    if (poseRef.current) {
      await poseRef.current.send({ image: canvas });
    }

    if (handsRef.current) {
      await handsRef.current.send({ image: canvas });
    }

    // Send combined analysis to parent
    onAnalysisUpdate({
      eyeContact: eyeContactData,
      bodyLanguage: bodyLanguageData
    });
  };

  useEffect(() => {
    if (isInitialized && videoRef.current) {
      const interval = setInterval(processFrame, 100); // Process every 100ms
      return () => clearInterval(interval);
    }
  }, [isInitialized, eyeContactData, bodyLanguageData]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'none' }} // Hidden canvas for processing
    />
  );
};

export default ComputerVisionAnalyzer;
