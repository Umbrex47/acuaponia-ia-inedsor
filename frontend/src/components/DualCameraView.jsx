import CameraFeed from './CameraFeed';

export default function DualCameraView({ fish, plants }) {
  return (
    <div className="dual-camera-view">
      <div className="dual-camera-panel dual-camera-panel--fish">
        <div className="dual-camera-tag dual-camera-tag--left">
          <span className="dual-camera-tag__dot bg-accent-blue" />
          Peces
        </div>
        <CameraFeed
          streamUrl={fish.cameraUrl}
          status={fish.cameraStatus}
          label="Pecera"
          subtitle={fish.mood}
          accentClass="text-accent-blue"
          compact
        />
      </div>

      <div className="dual-camera-panel dual-camera-panel--plants">
        <div className="dual-camera-tag dual-camera-tag--right">
          <span className="dual-camera-tag__dot bg-accent-green" />
          Plantas
        </div>
        <CameraFeed
          streamUrl={plants.cameraUrl}
          status={plants.cameraStatus}
          label="Cultivo"
          subtitle={plants.status}
          accentClass="text-accent-green"
          compact
        />
      </div>
    </div>
  );
}
