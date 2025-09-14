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
        console.log('Initializing MediaPipe models...');
        
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
            console.log('Face detected, analyzing eye contact...');
            analyzeEyeContact(results.multiFaceLandmarks[0]);
          }
        });

        // Set up pose results
        pose.onResults((results) => {
          if (results.poseLandmarks) {
            console.log('Pose detected, analyzing body language...');
            analyzeBodyLanguage(results.poseLandmarks);
          }
        });

        // Set up hands results
        hands.onResults((results) => {
          if (results.multiHandLandmarks) {
            console.log('Hands detected, analyzing gestures...');
            analyzeHandGestures(results.multiHandLandmarks);
          }
        });

        faceMeshRef.current = faceMesh;
        poseRef.current = pose;
        handsRef.current = hands;

        console.log('MediaPipe models initialized successfully');
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing MediaPipe:', error);
      }
    };

    initializeMediaPipe();
  }, []);

  const analyzeEyeContact = (landmarks) => {
    if (!landmarks || landmarks.length < 468) return;

    // More accurate eye landmarks for MediaPipe Face Mesh
    // Left eye landmarks
    const leftEyeInner = landmarks[133];  // Left eye inner corner
    const leftEyeOuter = landmarks[33];   // Left eye outer corner
    const leftEyeTop = landmarks[159];    // Left eye top
    const leftEyeBottom = landmarks[145]; // Left eye bottom
    
    // Right eye landmarks  
    const rightEyeInner = landmarks[362]; // Right eye inner corner
    const rightEyeOuter = landmarks[263]; // Right eye outer corner
    const rightEyeTop = landmarks[386];   // Right eye top
    const rightEyeBottom = landmarks[374]; // Right eye bottom

    // Calculate eye center points more accurately
    const leftEyeCenter = {
      x: (leftEyeInner.x + leftEyeOuter.x + leftEyeTop.x + leftEyeBottom.x) / 4,
      y: (leftEyeInner.y + leftEyeOuter.y + leftEyeTop.y + leftEyeBottom.y) / 4
    };

    const rightEyeCenter = {
      x: (rightEyeInner.x + rightEyeOuter.x + rightEyeTop.x + rightEyeBottom.x) / 4,
      y: (rightEyeInner.y + rightEyeOuter.y + rightEyeTop.y + rightEyeBottom.y) / 4
    };

    // Calculate overall eye center
    const eyeCenterX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
    const eyeCenterY = (leftEyeCenter.y + rightEyeCenter.y) / 2;

    // Calculate eye contact percentage based on distance from center
    const centerX = 0.5;
    const centerY = 0.5;
    const maxDistance = 0.3; // Maximum distance for 0% eye contact
    
    const distanceFromCenter = Math.sqrt(
      Math.pow(eyeCenterX - centerX, 2) + Math.pow(eyeCenterY - centerY, 2)
    );
    
    // Calculate eye contact percentage (closer to center = higher percentage)
    const eyeContactPercentage = Math.max(0, Math.min(100, 
      (1 - distanceFromCenter / maxDistance) * 100
    ));

    // Determine if looking at camera (more lenient threshold)
    const centerThreshold = 0.15; // 15% tolerance
    const isLookingAtCamera = distanceFromCenter < centerThreshold;

    // Determine gaze direction with more nuanced detection
    let gazeDirection = 'center';
    const horizontalDistance = Math.abs(eyeCenterX - centerX);
    const verticalDistance = Math.abs(eyeCenterY - centerY);
    
    if (horizontalDistance > verticalDistance) {
      if (eyeCenterX < 0.35) gazeDirection = 'left';
      else if (eyeCenterX > 0.65) gazeDirection = 'right';
    } else {
      if (eyeCenterY < 0.35) gazeDirection = 'up';
      else if (eyeCenterY > 0.65) gazeDirection = 'down';
    }

    const newEyeContactData = {
      isLookingAtCamera,
      eyeContactPercentage: Math.round(eyeContactPercentage),
      gazeDirection
    };

    console.log('Eye contact analysis:', newEyeContactData);
    setEyeContactData(newEyeContactData);
  };

  const analyzeBodyLanguage = (landmarks) => {
    if (!landmarks || landmarks.length < 33) return;

    // Key pose landmarks
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];

    // Check if key landmarks are visible
    const keyLandmarks = [nose, leftShoulder, rightShoulder, leftHip, rightHip];
    const visibleLandmarks = keyLandmarks.filter(landmark => landmark.visibility > 0.5);
    
    if (visibleLandmarks.length < 4) {
      // Not enough visible landmarks for accurate analysis
      setBodyLanguageData(prev => ({
        ...prev,
        confidence: (visibleLandmarks.length / keyLandmarks.length) * 100
      }));
      return;
    }

    // Analyze posture with multiple metrics
    const shoulderCenter = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2
    };

    const hipCenter = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2
    };

    const earCenter = {
      x: (leftEar.x + rightEar.x) / 2,
      y: (leftEar.y + rightEar.y) / 2
    };

    // Calculate spine alignment (horizontal deviation)
    const spineAlignment = Math.abs(shoulderCenter.x - hipCenter.x);
    
    // Calculate head alignment with shoulders
    const headAlignment = Math.abs(earCenter.x - shoulderCenter.x);
    
    // Calculate overall posture score
    let postureScore = 100;
    
    // Deduct points for spine misalignment
    if (spineAlignment > 0.08) postureScore -= 40;
    else if (spineAlignment > 0.05) postureScore -= 20;
    else if (spineAlignment > 0.03) postureScore -= 10;
    
    // Deduct points for head misalignment
    if (headAlignment > 0.06) postureScore -= 30;
    else if (headAlignment > 0.04) postureScore -= 15;
    else if (headAlignment > 0.02) postureScore -= 5;

    // Determine posture category
    let posture = 'good';
    if (postureScore < 50) posture = 'slouched';
    else if (postureScore < 75) posture = 'slightly_off';

    // Calculate confidence (based on landmark visibility and consistency)
    const confidence = (visibleLandmarks.length / keyLandmarks.length) * 100;

    const newBodyLanguageData = {
      ...bodyLanguageData,
      posture,
      confidence: Math.round(confidence)
    };

    console.log('Body language analysis:', newBodyLanguageData);
    setBodyLanguageData(newBodyLanguageData);
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
    if (!isInitialized || !videoRef.current || !canvasRef.current) {
      console.log('Skipping frame - not ready:', { isInitialized, hasVideo: !!videoRef.current, hasCanvas: !!canvasRef.current });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Check if video is ready
    if (video.readyState < 2) {
      console.log('Video not ready, readyState:', video.readyState);
      return; // Not enough data loaded
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Process with MediaPipe
    try {
      if (faceMeshRef.current) {
        await faceMeshRef.current.send({ image: canvas });
      }

      if (poseRef.current) {
        await poseRef.current.send({ image: canvas });
      }

      if (handsRef.current) {
        await handsRef.current.send({ image: canvas });
      }
    } catch (error) {
      console.error('Error processing frame:', error);
    }
  };

  // Update parent with current analysis data whenever it changes
  useEffect(() => {
    onAnalysisUpdate({
      eyeContact: eyeContactData,
      bodyLanguage: bodyLanguageData
    });
  }, [eyeContactData, bodyLanguageData, onAnalysisUpdate]);

  useEffect(() => {
    if (isInitialized && videoRef.current) {
      const interval = setInterval(processFrame, 200); // Process every 200ms for better performance
      return () => clearInterval(interval);
    }
  }, [isInitialized]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'none' }} // Hidden canvas for processing
    />
  );
};

export default ComputerVisionAnalyzer;
