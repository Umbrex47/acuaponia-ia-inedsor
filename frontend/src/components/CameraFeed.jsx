export default function CameraFeed({
  streamUrl,
  status = 'ok',
  label,
  subtitle,
  accentClass = 'text-accent-blue',
  compact = false,
}) {
  const hasStream = Boolean(streamUrl);

  return (
    <div className={`camera-feed ${compact ? 'camera-feed--compact' : ''}`}>
      {hasStream ? (
        <img
          src={streamUrl}
          alt={label}
          className="camera-feed__stream"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="camera-feed__placeholder" aria-hidden="true">
          <div className="camera-feed__placeholder-cross" />
        </div>
      )}

      <span className="camera-live-dot">
        {status === 'ok' ? 'Live' : status === 'warn' ? 'Señal débil' : 'Offline'}
      </span>

      {(label || subtitle) && (
        <div className="camera-feed__overlay">
          {label && (
            <div
              className={`font-display font-semibold ${
                compact ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
              }`}
            >
              {label}
            </div>
          )}
          {subtitle && (
            <div
              className={`${accentClass} font-semibold ${
                compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
              }`}
            >
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
