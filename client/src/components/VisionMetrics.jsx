import React from 'react';

const VisionMetrics = ({ eyeContactData, bodyLanguageData }) => {
  const getPostureColor = (posture) => {
    switch (posture) {
      case 'good': return '#4caf50';
      case 'slightly_off': return '#ff9800';
      case 'slouched': return '#f44336';
      default: return '#2196f3';
    }
  };

  const getPostureText = (posture) => {
    switch (posture) {
      case 'good': return 'Excellent';
      case 'slightly_off': return 'Good';
      case 'slouched': return 'Needs Improvement';
      default: return 'Unknown';
    }
  };

  const getGazeDirectionText = (direction) => {
    switch (direction) {
      case 'center': return 'Looking at camera';
      case 'left': return 'Looking left';
      case 'right': return 'Looking right';
      case 'up': return 'Looking up';
      case 'down': return 'Looking down';
      default: return 'Unknown';
    }
  };

  return (
    <div className="vision-metrics">
      <h3>Visual Analysis</h3>
      
      {/* Eye Contact Metrics */}
      <div className="metric-card eye-contact">
        <h4>👁️ Eye Contact</h4>
        <div className="metric-value">
          {eyeContactData.eyeContactPercentage.toFixed(0)}%
        </div>
        <div className="metric-details">
          <p><strong>Status:</strong> {getGazeDirectionText(eyeContactData.gazeDirection)}</p>
          <p><strong>Looking at camera:</strong> {eyeContactData.isLookingAtCamera ? 'Yes' : 'No'}</p>
        </div>
      </div>

      {/* Body Language Metrics */}
      <div className="metric-card body-language">
        <h4>🤸 Body Language</h4>
        <div className="metric-details">
          <p><strong>Posture:</strong> 
            <span style={{ color: getPostureColor(bodyLanguageData.posture) }}>
              {getPostureText(bodyLanguageData.posture)}
            </span>
          </p>
          <p><strong>Hand Gestures:</strong> {bodyLanguageData.handGestures} active</p>
          <p><strong>Confidence:</strong> {bodyLanguageData.confidence.toFixed(0)}%</p>
        </div>
      </div>

      {/* Real-time Feedback */}
      <div className="vision-feedback">
        <h4>💡 Real-time Tips</h4>
        <div className="feedback-tips">
          {eyeContactData.eyeContactPercentage < 30 && (
            <p className="tip warning">⚠️ Try to look at the camera more often</p>
          )}
          {bodyLanguageData.posture === 'slouched' && (
            <p className="tip warning">⚠️ Straighten your posture</p>
          )}
          {bodyLanguageData.handGestures === 0 && (
            <p className="tip info">💡 Consider using hand gestures to emphasize points</p>
          )}
          {eyeContactData.eyeContactPercentage > 70 && bodyLanguageData.posture === 'good' && (
            <p className="tip success">✅ Great eye contact and posture!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisionMetrics;
