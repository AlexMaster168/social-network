"use client";

import { useEffect, useRef } from "react";
import type { CallState } from "@/lib/useWebRTC";
import { CamOffIcon, HangupIcon, MicIcon, MicOffIcon, PhoneIcon, VideoIcon } from "./icons";

interface CallPanelProps {
  callState: CallState;
  isVideo: boolean;
  micOn: boolean;
  camOn: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerName: string;
  onAccept: () => void;
  onHangup: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
}

export function CallPanel(props: CallPanelProps) {
  const {
    callState, isVideo, micOn, camOn, localStream, remoteStream,
    peerName, onAccept, onHangup, onToggleMic, onToggleCam,
  } = props;

  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current && localStream) localRef.current.srcObject = localStream;
  }, [localStream]);
  useEffect(() => {
    if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  if (callState === "idle") return null;

  // Входящий звонок — компактная карточка
  if (callState === "incoming") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="card w-full max-w-xs p-6 text-center">
          <div className="mb-2 text-sm text-muted">Входящий {isVideo ? "видео" : "аудио"}-звонок</div>
          <div className="mb-5 text-lg font-bold">{peerName}</div>
          <div className="flex justify-center gap-4">
            <button
              onClick={onAccept}
              className="flex h-14 w-14 items-center justify-center rounded-full text-white"
              style={{ background: "var(--color-like)" }}
              title="Принять"
            >
              <PhoneIcon size={24} />
            </button>
            <button
              onClick={onHangup}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-danger)] text-white"
              title="Отклонить"
            >
              <HangupIcon size={24} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Звоним / разговор — большой оверлей
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* удалённое видео / заглушка */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {remoteStream && isVideo ? (
          <video ref={remoteRef} autoPlay playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="text-center text-white">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full text-4xl font-bold"
              style={{ background: "linear-gradient(135deg, #6d8cff, #5675f0)" }}>
              {peerName.charAt(0).toUpperCase()}
            </div>
            <div className="text-lg font-semibold">{peerName}</div>
            <div className="mt-1 text-sm text-white/60">
              {callState === "calling" ? "Звоним…" : "Разговор"}
              {!isVideo && " · аудио"}
            </div>
          </div>
        )}
        {/* всегда играем удалённый звук, даже без видео */}
        {remoteStream && !isVideo && <video ref={remoteRef} autoPlay playsInline className="hidden" />}

        {/* локальное превью */}
        {localStream && isVideo && (
          <video
            ref={localRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-4 right-4 h-36 w-28 rounded-xl border-2 border-white/20 object-cover sm:h-44 sm:w-32"
          />
        )}
      </div>

      {/* панель управления */}
      <div className="flex items-center justify-center gap-4 py-6">
        <button
          onClick={onToggleMic}
          className="flex h-14 w-14 items-center justify-center rounded-full text-white"
          style={{ background: micOn ? "rgba(255,255,255,0.15)" : "var(--color-danger)" }}
          title={micOn ? "Выключить микрофон" : "Включить микрофон"}
        >
          {micOn ? <MicIcon size={22} /> : <MicOffIcon size={22} />}
        </button>
        {isVideo && (
          <button
            onClick={onToggleCam}
            className="flex h-14 w-14 items-center justify-center rounded-full text-white"
            style={{ background: camOn ? "rgba(255,255,255,0.15)" : "var(--color-danger)" }}
            title={camOn ? "Выключить камеру" : "Включить камеру"}
          >
            {camOn ? <VideoIcon size={22} /> : <CamOffIcon size={22} />}
          </button>
        )}
        <button
          onClick={onHangup}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-danger)] text-white"
          title="Завершить"
        >
          <HangupIcon size={24} />
        </button>
      </div>
    </div>
  );
}
