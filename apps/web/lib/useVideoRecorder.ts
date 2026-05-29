"use client";

import { useRef, useState } from "react";

/** Запись видеосообщения (видео+звук) с превью-стримом. */
export function useVideoRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopAll() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function start(): Promise<boolean> {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = s;
      setStream(s);
      chunksRef.current = [];
      const rec = new MediaRecorder(s);
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((x) => x + 1), 1000);
      return true;
    } catch {
      alert("Не удалось получить доступ к камере.");
      return false;
    }
  }

  function stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec) return resolve(null);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" });
        stopAll();
        setRecording(false);
        resolve(blob.size > 0 ? blob : null);
      };
      rec.stop();
    });
  }

  function cancel() {
    const rec = recorderRef.current;
    if (rec) {
      rec.onstop = () => stopAll();
      rec.stop();
    } else stopAll();
    chunksRef.current = [];
    setRecording(false);
  }

  return { recording, seconds, stream, start, stop, cancel };
}
