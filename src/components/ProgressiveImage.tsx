import { useState, useEffect, type CSSProperties } from 'react'

interface ProgressiveImageProps {
  src: string
  alt: string
  loading?: 'lazy' | 'eager'
  style?: CSSProperties
  className?: string
  onError?: () => void
  onMouseEnter?: (e: React.MouseEvent<HTMLImageElement>) => void
  onMouseLeave?: (e: React.MouseEvent<HTMLImageElement>) => void
  /** Show a pulsing skeleton shimmer behind the image while loading */
  skeleton?: boolean
}

export default function ProgressiveImage({
  src,
  alt,
  loading = 'lazy',
  style,
  className,
  onError,
  onMouseEnter,
  onMouseLeave,
  skeleton = true,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
  }, [src])

  const containerStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    ...style,
  }

  const imgStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    filter: loaded ? 'blur(0)' : 'blur(12px)',
    opacity: loaded ? 1 : 0.7,
    transform: loaded ? 'scale(1)' : 'scale(1.05)',
    transition: 'filter 0.5s ease, opacity 0.5s ease, transform 0.5s ease',
  }

  return (
    <div className={className} style={containerStyle}>
      {skeleton && !loaded && (
        <div
          className="progressive-skeleton"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--surface-raised)',
            zIndex: 0,
          }}
        />
      )}
      <img
        src={src}
        alt={alt}
        loading={loading}
        style={imgStyle}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(true)
          onError?.()
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    </div>
  )
}
