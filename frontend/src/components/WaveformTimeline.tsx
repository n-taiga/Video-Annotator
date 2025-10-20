import React, { useEffect, useMemo, useRef, useState } from 'react'

interface WaveformTimelineProps {
  audioSrc: string
  currentTime?: number
  durationOverride?: number
  height?: number
  waveColor?: string
  backgroundColor?: string
  className?: string
  onSeek?: (time: number) => void
}

const SAMPLE_TARGET = 2000

interface WaveformState {
  duration: number
  samples: number[]
}

export default function WaveformTimeline({
  audioSrc,
  currentTime = 0,
  durationOverride,
  height = 96,
  waveColor = '#2563eb',
  backgroundColor = '#0f172a',
  className,
  onSeek
}: WaveformTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const scrubbingRef = useRef(false)
  const [containerWidth, setContainerWidth] = useState<number>(600)
  const [waveform, setWaveform] = useState<WaveformState | null>(null)
  const [waveformPath, setWaveformPath] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const effectiveDuration = useMemo(() => {
    if (durationOverride && durationOverride > 0) return durationOverride
    return waveform?.duration ?? 0
  }, [durationOverride, waveform])

  useEffect(() => {
    const target = containerRef.current
    if (!target) return
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return
      const width = Math.max(1, entry.contentRect.width)
      setContainerWidth(width)
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!audioSrc) {
      setWaveform(null)
      setWaveformPath('')
      setErrorMessage('No audio source provided.')
      return
    }
    let cancelled = false
    const controller = new AbortController()
    async function loadWaveform() {
      try {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioContext()
        }
        const ctx = audioContextRef.current
        const response = await fetch(audioSrc, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Unable to fetch audio: ${response.status}`)
        }
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        if (cancelled) return
        const waveformData = mixDownChannels(audioBuffer)
        const samples = downsampleWaveform(waveformData, SAMPLE_TARGET)
        const normalised = normaliseSamples(samples)
        setWaveform({ duration: audioBuffer.duration, samples: normalised })
        setErrorMessage(null)
      } catch (err) {
        if (cancelled) return
        if ((err as Error).name === 'AbortError') return
        console.error('Failed to build waveform', err)
        setWaveform(null)
        setWaveformPath('')
        setErrorMessage((err as Error).message || 'Failed to build waveform.')
      }
    }
    loadWaveform()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [audioSrc])

  useEffect(() => {
    if (!waveform) {
      setWaveformPath('')
      return
    }
    const svgWidth = Math.max(1, containerWidth)
    const svgHeight = Math.max(24, height)
    const path = buildWaveformPath(waveform.samples, svgWidth, svgHeight)
    setWaveformPath(path)
  }, [waveform, containerWidth, height])

  useEffect(() => {
    return () => {
      if (!audioContextRef.current) return
      const ctx = audioContextRef.current
      if (ctx.state === 'closed') return
      ctx.close().catch(() => undefined)
    }
  }, [])

  const cursorX = useMemo(() => {
    if (!effectiveDuration || effectiveDuration <= 0) return 0
    const clamped = Math.max(0, Math.min(effectiveDuration, currentTime))
    return (clamped / effectiveDuration) * containerWidth
  }, [effectiveDuration, currentTime, containerWidth])

  const handlePointerEvent = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!effectiveDuration || effectiveDuration <= 0) return
    if (!onSeek) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = event.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, px / rect.width))
    const time = ratio * effectiveDuration
    onSeek(time)
  }

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'mouse') event.preventDefault()
    scrubbingRef.current = true
    handlePointerEvent(event)
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!scrubbingRef.current) return
    if (event.buttons === 0) {
      scrubbingRef.current = false
      return
    }
    handlePointerEvent(event)
  }

  const handlePointerUp = () => {
    scrubbingRef.current = false
  }

  const renderContent = () => {
    if (errorMessage) {
      return <div className="waveform-error">{errorMessage}</div>
    }
    if (!waveformPath) {
      return <div className="waveform-loading">Building waveform…</div>
    }
    const svgHeight = Math.max(24, height)
    return (
      <svg
        ref={svgRef}
        className="waveform-svg"
        width="100%"
        height={svgHeight}
        viewBox={`0 0 ${containerWidth} ${svgHeight}`}
        preserveAspectRatio="none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <rect width={containerWidth} height={svgHeight} fill={backgroundColor} rx={4} ry={4} />
        <path d={waveformPath} fill={waveColor} opacity={0.85} />
        {effectiveDuration > 0 && (
          <line
            x1={cursorX}
            x2={cursorX}
            y1={4}
            y2={svgHeight - 4}
            stroke="#f97316"
            strokeWidth={2}
            pointerEvents="none"
          />
        )}
      </svg>
    )
  }

  return (
    <div ref={containerRef} className={className ? `waveform-container ${className}` : 'waveform-container'}>
      {renderContent()}
    </div>
  )
}

function mixDownChannels(buffer: AudioBuffer): Float32Array {
  const { length, numberOfChannels } = buffer
  if (numberOfChannels === 0) {
    return new Float32Array(length)
  }
  const output = new Float32Array(length)
  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const channelData = buffer.getChannelData(channel)
    for (let i = 0; i < length; i += 1) {
      output[i] += channelData[i] / numberOfChannels
    }
  }
  return output
}

function downsampleWaveform(data: Float32Array, targetSamples: number): number[] {
  const samples = Math.min(targetSamples, data.length)
  const blockSize = Math.max(1, Math.floor(data.length / samples))
  const result: number[] = []
  for (let i = 0; i < samples; i += 1) {
    const start = i * blockSize
    let sum = 0
    let count = 0
    for (let j = 0; j < blockSize && start + j < data.length; j += 1) {
      sum += Math.abs(data[start + j])
      count += 1
    }
    result.push(count === 0 ? 0 : sum / count)
  }
  return result
}

function normaliseSamples(samples: number[]): number[] {
  const maxVal = samples.reduce((acc, cur) => (cur > acc ? cur : acc), 0)
  if (maxVal === 0) return samples.map(() => 0)
  return samples.map(v => v / maxVal)
}

function buildWaveformPath(samples: number[], width: number, height: number): string {
  if (samples.length === 0) return ''
  const topPath: string[] = []
  const bottomPath: string[] = []
  const usableHeight = height - 8
  const mid = height / 2
  for (let i = 0; i < samples.length; i += 1) {
    const ratio = samples.length === 1 ? 0 : i / (samples.length - 1)
    const x = ratio * width
    const amplitude = samples[i] * (usableHeight / 2)
    const yTop = mid - amplitude
    const yBottom = mid + amplitude
    topPath.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${yTop.toFixed(2)}`)
    bottomPath.push(`L${x.toFixed(2)},${yBottom.toFixed(2)}`)
  }
  const reversedBottom = bottomPath.reverse()
  return `${topPath.join(' ')} ${reversedBottom.join(' ')} Z`
}
