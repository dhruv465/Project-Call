import { useEffect, useRef, useState } from 'react';

/**
 * AudioWaveform component for real-time visualization of audio
 * Features:
 * - Smooth animation with requestAnimationFrame
 * - Responsive design
 * - Customizable colors and styling
 * - Support for different visualization modes
 */

interface AudioWaveformProps {
  data?: number[];
  height?: number | string;
  width?: number | string;
  color?: string;
  backgroundColor?: string;
  mode?: 'bars' | 'line' | 'wave';
  barWidth?: number;
  barSpacing?: number;
  smoothing?: number;
  isActive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const AudioWaveform = ({
  data = [],
  height = 100,
  width = '100%',
  color = '#3b82f6',
  backgroundColor = 'transparent',
  mode = 'bars', // 'bars', 'line', 'wave'
  barWidth = 4,
  barSpacing = 2,
  smoothing = 0.5, // 0-1, higher = smoother animation
  isActive = true,
  className = '',
  style = {}
}: AudioWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const [currentData, setCurrentData] = useState<number[]>(data || []);
  const [targetData, setTargetData] = useState<number[]>(data || []);
  
  // Initialize canvas and animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Set canvas DPI for sharp rendering on high-resolution displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    context.scale(dpr, dpr);
    
    // Setup animation frame
    const animate = () => {
      // Smooth animation by interpolating between current and target values
      const newData = currentData.map((current, i) => {
        const target = targetData[i] || 0;
        return current + (target - current) * smoothing;
      });
      
      setCurrentData(newData);
      draw(context, newData, rect.width, rect.height);
      
      if (isActive) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    if (isActive) {
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, targetData, smoothing, currentData]);
  
  // Update target data when input data changes
  useEffect(() => {
    setTargetData(data);
  }, [data]);
  
  // Draw the waveform
  const draw = (
    ctx: CanvasRenderingContext2D, 
    data: number[], 
    width: number, 
    height: number
  ) => {
    ctx.clearRect(0, 0, width, height);
    
    if (backgroundColor !== 'transparent') {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }
    
    ctx.fillStyle = color;
    
    // Calculate scale to fit the data to the canvas
    const verticalScale = height / 2;
    const numBars = Math.floor(width / (barWidth + barSpacing));
    const scaledData = resampleData(data, numBars);
    
    switch (mode) {
      case 'bars':
        drawBars(ctx, scaledData, width, height, verticalScale);
        break;
      case 'line':
        drawLine(ctx, scaledData, width, height, verticalScale);
        break;
      case 'wave':
        drawWave(ctx, scaledData, width, height, verticalScale);
        break;
      default:
        drawBars(ctx, scaledData, width, height, verticalScale);
    }
  };
  
  // Draw bar visualization
  const drawBars = (
    ctx: CanvasRenderingContext2D, 
    data: number[], 
    width: number, 
    height: number, 
    scale: number
  ) => {
    const centerY = height / 2;
    const totalWidth = (barWidth + barSpacing) * data.length;
    const startX = (width - totalWidth) / 2;
    
    data.forEach((value: number, i: number) => {
      const x = startX + i * (barWidth + barSpacing);
      const barHeight = Math.max(2, Math.abs(value * scale));
      
      ctx.fillRect(
        x,
        centerY - barHeight / 2,
        barWidth,
        barHeight
      );
    });
  };
  
  // Draw line visualization
  const drawLine = (
    ctx: CanvasRenderingContext2D, 
    data: number[], 
    width: number, 
    height: number, 
    scale: number
  ) => {
    const centerY = height / 2;
    const step = width / (data.length - 1);
    
    ctx.beginPath();
    ctx.moveTo(0, centerY + data[0] * scale);
    
    data.forEach((value, i) => {
      ctx.lineTo(i * step, centerY + value * scale);
    });
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  
  // Draw wave visualization
  const drawWave = (
    ctx: CanvasRenderingContext2D, 
    data: number[], 
    width: number, 
    height: number, 
    scale: number
  ) => {
    const centerY = height / 2;
    const step = width / (data.length - 1);
    
    ctx.beginPath();
    ctx.moveTo(0, centerY + data[0] * scale);
    
    data.forEach((value: number, i: number) => {
      ctx.lineTo(i * step, centerY + value * scale);
    });
    
    ctx.lineTo(width, centerY);
    ctx.lineTo(0, centerY);
    ctx.closePath();
    
    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `${color}80`); // 50% opacity
    gradient.addColorStop(1, `${color}20`); // 12% opacity
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Add stroke on top
    ctx.beginPath();
    ctx.moveTo(0, centerY + data[0] * scale);
    
    data.forEach((value: number, i: number) => {
      ctx.lineTo(i * step, centerY + value * scale);
    });
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  
  // Resample data to match the number of bars
  const resampleData = (data: number[], targetLength: number): number[] => {
    if (data.length === 0) return Array(targetLength).fill(0);
    if (data.length === targetLength) return data;
    
    const result: number[] = [];
    const step = data.length / targetLength;
    
    for (let i = 0; i < targetLength; i++) {
      const pos = Math.floor(i * step);
      result.push(data[pos] || 0);
    }
    
    return result;
  };
  
  // Calculate inline styles
  const containerStyle = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...style
  };
  
  return (
    <div className={`audio-waveform ${className}`} style={containerStyle}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default AudioWaveform;
