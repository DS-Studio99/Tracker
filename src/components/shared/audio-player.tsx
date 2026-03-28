"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Download, Volume2, VolumeX, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatDuration } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/client";

interface AudioPlayerProps {
  src: string;
  title?: string;
  duration?: number;
}

/**
 * Resolves a Supabase Storage path or bucket URL into a publicly accessible URL.
 * If the src looks like a storage path (starts with a bucket name token), tries to create a signed URL.
 * Otherwise returns the src as-is (already a full URL).
 */
async function resolveAudioUrl(src: string): Promise<string> {
  // If it's already a full HTTP URL, use as-is
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  // Otherwise treat it as a Supabase storage path: "bucket-name/path/to/file"
  const slashIdx = src.indexOf("/");
  if (slashIdx === -1) return src;

  const bucket = src.substring(0, slashIdx);
  const path = src.substring(slashIdx + 1);

  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600); // 1-hour signed URL
    if (error || !data?.signedUrl) return src;
    return data.signedUrl;
  } catch {
    return src;
  }
}

export function AudioPlayer({ src, title, duration }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(true);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Resolve Supabase Storage URLs on mount
  useEffect(() => {
    let cancelled = false;
    setIsLoadingUrl(true);
    setHasError(false);
    resolveAudioUrl(src).then((url) => {
      if (!cancelled) {
        setResolvedSrc(url);
        setIsLoadingUrl(false);
      }
    });
    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (!duration) setAudioDuration(audio.duration);
    };
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => setHasError(true);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [duration, resolvedSrc]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || hasError) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => setHasError(true));
    }
    setIsPlaying((prev) => !prev);
  }, [isPlaying, hasError]);

  const handleSeek = (value: number | readonly number[]) => {
    const numVal = Array.isArray(value) ? (value as number[])[0] : (value as number);
    if (audioRef.current) {
      audioRef.current.currentTime = numVal;
      setCurrentTime(numVal);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  if (isLoadingUrl) {
    return (
      <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-md border text-sm w-full max-w-sm">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        <span className="text-slate-400 text-xs">Preparing audio...</span>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-800 text-sm w-full max-w-sm">
        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
        <span className="text-red-600 dark:text-red-400 text-xs">Audio unavailable or access denied</span>
        {resolvedSrc && (
          <a href={resolvedSrc} download target="_blank" rel="noreferrer" className="ml-auto shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600">
              <Download className="h-3 w-3" />
            </Button>
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-md border text-sm w-full max-w-sm">
      {resolvedSrc && (
        <audio ref={audioRef} src={resolvedSrc} preload="metadata" />
      )}
      
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full shrink-0"
        onClick={togglePlay}
        disabled={!resolvedSrc}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </Button>
      
      <div className="flex flex-col flex-1 gap-1 min-w-0">
        {title && <span className="text-xs font-medium truncate">{title}</span>}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 w-10 text-right shrink-0">
            {formatDuration(currentTime)}
          </span>
          <Slider
            value={[currentTime]}
            max={audioDuration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="flex-1"
            disabled={!resolvedSrc}
          />
          <span className="text-[10px] text-slate-500 w-10 shrink-0">
            {formatDuration(audioDuration)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleMute}>
          {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
        </Button>
        {resolvedSrc && (
          <a href={resolvedSrc} download target="_blank" rel="noreferrer">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950"
            >
              <Download className="h-3 w-3" />
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
