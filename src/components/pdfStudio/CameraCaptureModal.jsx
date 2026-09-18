import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Camera, RefreshCw, Check, X, Loader2, AlertTriangle } from 'lucide-react';

export const CameraCaptureModal = ({
  isOpen,
  onClose,
  onCaptureImage
}) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Initialize camera only when modal opens, release tracks on unmount/close
  useEffect(() => {
    let isMounted = true;

    const startCamera = async () => {
      setCameraError('');
      setIsCameraReady(false);
      setCapturedPreview(null);

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access is not supported by this browser environment.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'environment'
          },
          audio: false
        });

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (isMounted) setIsCameraReady(true);
          };
        }
      } catch (err) {
        console.error('Camera initialization error:', err);
        if (isMounted) {
          setCameraError(err.message || 'Failed to access camera device.');
        }
      }
    };

    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  };

  const handleSnapFrame = () => {
    if (!videoRef.current || isCapturing) return;

    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      
      // Limit to max 1920x1080 resolution to keep memory light and avoid UI lag
      const maxW = 1920;
      const maxH = 1080;
      let w = video.videoWidth || 1280;
      let h = video.videoHeight || 720;

      if (w > maxW) {
        h = Math.round((maxW / w) * h);
        w = maxW;
      }
      if (h > maxH) {
        w = Math.round((maxH / h) * w);
        h = maxH;
      }

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);

      canvas.toBlob((blob) => {
        if (!blob) {
          setIsCapturing(false);
          return;
        }

        const file = new File([blob], `camera_snap_${Date.now()}.png`, { type: 'image/png' });
        const previewUrl = URL.createObjectURL(blob);

        setCapturedPreview({
          file,
          previewUrl,
          width: w,
          height: h
        });

        setIsCapturing(false);
      }, 'image/png', 0.92);
    } catch (err) {
      console.error('Snapshot capture error:', err);
      setIsCapturing(false);
    }
  };

  const handleConfirmImage = () => {
    if (capturedPreview && onCaptureImage) {
      onCaptureImage(capturedPreview.file, capturedPreview.previewUrl);
      stopCamera();
      onClose();
    }
  };

  const handleRetake = () => {
    if (capturedPreview?.previewUrl) {
      URL.revokeObjectURL(capturedPreview.previewUrl);
    }
    setCapturedPreview(null);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        stopCamera();
        onClose();
      }}
      title="Add from Camera"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {cameraError ? (
          <div className="p-8 text-center glass-panel rounded-2xl border border-red-500/30 bg-red-500/10 space-y-3">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">Camera Access Error</h4>
            <p className="text-xs text-red-300 max-w-md mx-auto">{cameraError}</p>
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Retry Camera Permissions
            </Button>
          </div>
        ) : capturedPreview ? (
          <div className="space-y-4 text-center">
            <div className="relative rounded-2xl overflow-hidden border border-emerald-500/40 bg-black aspect-video flex items-center justify-center max-h-96">
              <img
                src={capturedPreview.previewUrl}
                alt="Captured Snapshot"
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <p className="text-xs text-gray-400 font-mono">
              Captured image: {capturedPreview.width} × {capturedPreview.height} px
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="secondary" size="md" icon={RefreshCw} onClick={handleRetake}>
                Retake
              </Button>
              <Button variant="primary" size="md" icon={Check} onClick={handleConfirmImage}>
                Insert into PDF
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-black aspect-video flex items-center justify-center max-h-96">
              {!isCameraReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-950 text-gray-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  <span>Initializing camera stream...</span>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                size="md"
                icon={isCapturing ? Loader2 : Camera}
                disabled={!isCameraReady || isCapturing}
                onClick={handleSnapFrame}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                {isCapturing ? 'Capturing...' : 'Capture Photo'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
