"use client";

import { useRef, useState } from "react";

/** Запись голосового через MediaRecorder. Возвращает Blob по stop(). */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function start(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      return true;
    } catch {
      alert("Не удалось получить доступ к микрофону.");
      return false;
    }
  }

  /** Останавливает запись и возвращает Blob (или null при отмене). */
  function stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec) return resolve(null);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        stopTracks();
        setRecording(false);
        resolve(blob.size > 0 ? blob : null);
      };
      rec.stop();
    });
  }

  function cancel() {
    const rec = recorderRef.current;
    if (rec) {
      rec.onstop = () => stopTracks();
      rec.stop();
    } else {
      stopTracks();
    }
    chunksRef.current = [];
    setRecording(false);
  }

  return { recording, seconds, start, stop, cancel };
}
