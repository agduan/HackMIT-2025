import { useRef, useEffect, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Pose } from '@mediapipe/pose';
import { Hands } from '@mediapipe/hands';

const ComputerVisionAnalyzer = ({ videoRef, onAnalysisUpdate, isActive = true }) => {
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

  // Store previous landmarks for movement detection
  const [previousLandmarks, setPreviousLandmarks] = useState(null);

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
    setEyeContactData(prev => ({
      ...prev,
      ...newEyeContactData
    }));
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
    
    if (visibleLandmarks.length < 3) {
      // Not enough visible landmarks for accurate analysis
      setBodyLanguageData(prev => ({
        ...prev,
        confidence: Math.round((visibleLandmarks.length / keyLandmarks.length) * 100)
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

    // Calculate spine alignment (horizontal deviation) - more sensitive
    const spineAlignment = Math.abs(shoulderCenter.x - hipCenter.x);
    
    // Calculate head alignment with shoulders - more sensitive
    const headAlignment = Math.abs(earCenter.x - shoulderCenter.x);
    
    // Calculate vertical posture (shoulders vs hips height)
    const verticalAlignment = Math.abs(shoulderCenter.y - hipCenter.y);
    
    // Calculate overall posture score with more lenient thresholds
    let postureScore = 100;
    
    // Deduct points for spine misalignment (more lenient)
    if (spineAlignment > 0.08) postureScore -= 40;
    else if (spineAlignment > 0.06) postureScore -= 25;
    else if (spineAlignment > 0.04) postureScore -= 15;
    else if (spineAlignment > 0.02) postureScore -= 5;
    
    // Deduct points for head misalignment (more lenient)
    if (headAlignment > 0.06) postureScore -= 35;
    else if (headAlignment > 0.05) postureScore -= 20;
    else if (headAlignment > 0.03) postureScore -= 10;
    else if (headAlignment > 0.02) postureScore -= 3;

    // Deduct points for vertical misalignment (more lenient)
    if (verticalAlignment > 0.15) postureScore -= 25;
    else if (verticalAlignment > 0.1) postureScore -= 10;

    // Determine posture category with more lenient thresholds
    let posture = 'good';
    if (postureScore < 70) posture = 'slouched';
    else if (postureScore < 85) posture = 'slightly_off';

    // Calculate movement-based confidence with more variability
    let movementConfidence = 0;
    let stabilityBonus = 0;
    
    if (previousLandmarks) {
      // Calculate movement between frames
      const currentCenter = {
        x: (shoulderCenter.x + hipCenter.x) / 2,
        y: (shoulderCenter.y + hipCenter.y) / 2
      };
      
      const prevCenter = {
        x: (previousLandmarks.shoulderCenter.x + previousLandmarks.hipCenter.x) / 2,
        y: (previousLandmarks.shoulderCenter.y + previousLandmarks.hipCenter.y) / 2
      };
      
      const movement = Math.sqrt(
        Math.pow(currentCenter.x - prevCenter.x, 2) + 
        Math.pow(currentCenter.y - prevCenter.y, 2)
      );
      
      // Higher movement = higher confidence (more active detection)
      movementConfidence = Math.min(100, movement * 2000);
      
      // Add stability bonus for consistent posture
      if (movement < 0.01) {
        stabilityBonus = 15; // Bonus for being stable
      }
    }

    // Calculate visibility confidence with more granular scoring
    const visibilityConfidence = (visibleLandmarks.length / keyLandmarks.length) * 100;
    
    // Add posture quality bonus
    let postureBonus = 0;
    if (postureScore > 90) postureBonus = 10;
    else if (postureScore > 80) postureBonus = 5;
    
    // Add landmark quality bonus (based on individual landmark visibility)
    const landmarkQuality = keyLandmarks.reduce((sum, landmark) => sum + landmark.visibility, 0) / keyLandmarks.length;
    const qualityBonus = Math.round(landmarkQuality * 20);
    
    // Combine all confidence factors with more variability
    const baseConfidence = Math.max(visibilityConfidence, movementConfidence);
    const totalConfidence = Math.min(100, baseConfidence + stabilityBonus + postureBonus + qualityBonus);

    // Store current landmarks for next frame
    setPreviousLandmarks({
      shoulderCenter,
      hipCenter,
      earCenter
    });

    const newBodyLanguageData = {
      posture,
      handGestures: bodyLanguageData.handGestures,
      movement: bodyLanguageData.movement,
      confidence: Math.round(totalConfidence)
    };

    console.log('Body language analysis:', {
      ...newBodyLanguageData,
      spineAlignment: spineAlignment.toFixed(3),
      headAlignment: headAlignment.toFixed(3),
      postureScore,
      confidenceBreakdown: {
        visibility: visibilityConfidence.toFixed(1),
        movement: movementConfidence.toFixed(1),
        stability: stabilityBonus,
        posture: postureBonus,
        quality: qualityBonus,
        total: totalConfidence.toFixed(1)
      }
    });
    
    // Force state update to ensure re-render
    setBodyLanguageData(prev => ({
      ...prev,
      ...newBodyLanguageData
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
    if (!isActive || !isInitialized || !videoRef.current || !canvasRef.current) {
      if (!isActive) {
        console.log('Skipping frame - analysis not active');
      } else {
        console.log('Skipping frame - not ready:', { isInitialized, hasVideo: !!videoRef.current, hasCanvas: !!canvasRef.current });
      }
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
    console.log('Updating parent with new data:', {
      eyeContact: eyeContactData,
      bodyLanguage: bodyLanguageData
    });
    onAnalysisUpdate({
      eyeContact: eyeContactData,
      bodyLanguage: bodyLanguageData
    });
  }, [eyeContactData, bodyLanguageData, onAnalysisUpdate]);

  useEffect(() => {
    if (isInitialized && videoRef.current && isActive) {
      const interval = setInterval(processFrame, 150); // Process every 150ms for more responsive updates
      return () => clearInterval(interval);
    }
  }, [isInitialized, isActive]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'none' }} // Hidden canvas for processing
    />
  );
};

export default ComputerVisionAnalyzer;
