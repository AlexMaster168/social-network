"use client";

import { useCallback, useRef, useState } from "react";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export type CallState = "idle" | "calling" | "incoming" | "connected";

type Signal =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit; video: boolean }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; candidate: RTCIceCandidateInit }
  | { kind: "hangup" };

interface Options {
  sendSignal: (to: string, payload: unknown) => boolean;
}

export function useWebRTC({ sendSignal }: Options) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [isVideo, setIsVideo] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const peerRef = useRef<string | null>(null);
  const incomingRef = useRef<{ from: string; sdp: RTCSessionDescriptionInit; video: boolean } | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);

  const cleanup = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    setLocalStream((s) => {
      s?.getTracks().forEach((t) => t.stop());
      return null;
    });
    setRemoteStream(null);
    peerRef.current = null;
    incomingRef.current = null;
    pendingIce.current = [];
    setPeerId(null);
    setCallState("idle");
    setMicOn(true);
    setCamOn(true);
  }, []);

  const createPc = useCallback(
    (target: string) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal(target, { kind: "ice", candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        setRemoteStream(e.streams[0]);
      };
      pc.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          // соединение разорвалось — завершаем
        }
      };
      pcRef.current = pc;
      return pc;
    },
    [sendSignal],
  );

  async function getMedia(video: boolean) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    setLocalStream(stream);
    return stream;
  }

  /** Инициировать звонок пользователю. */
  const startCall = useCallback(
    async (target: string, video: boolean) => {
      try {
        setIsVideo(video);
        setPeerId(target);
        peerRef.current = target;
        const pc = createPc(target);
        const stream = await getMedia(video);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal(target, { kind: "offer", sdp: offer, video });
        setCallState("calling");
      } catch (err) {
        console.error("Не удалось начать звонок:", err);
        cleanup();
        alert("Не удалось получить доступ к камере/микрофону.");
      }
    },
    [createPc, sendSignal, cleanup],
  );

  /** Принять входящий звонок. */
  const acceptCall = useCallback(async () => {
    const inc = incomingRef.current;
    if (!inc) return;
    try {
      setIsVideo(inc.video);
      setPeerId(inc.from);
      peerRef.current = inc.from;
      const pc = createPc(inc.from);
      const stream = await getMedia(inc.video);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(inc.sdp));
      // применяем накопленные ICE-кандидаты
      for (const c of pendingIce.current) await pc.addIceCandidate(c);
      pendingIce.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(inc.from, { kind: "answer", sdp: answer });
      setCallState("connected");
    } catch (err) {
      console.error("Не удалось принять звонок:", err);
      cleanup();
    }
  }, [createPc, sendSignal, cleanup]);

  /** Отклонить/завершить звонок. */
  const hangup = useCallback(() => {
    const target = peerRef.current ?? incomingRef.current?.from;
    if (target) sendSignal(target, { kind: "hangup" });
    cleanup();
  }, [sendSignal, cleanup]);

  /** Обработать входящий сигнал (вызывается из useChatSocket.onSignal). */
  const handleSignal = useCallback(
    async (from: string, raw: unknown) => {
      const sig = raw as Signal;
      const pc = pcRef.current;

      if (sig.kind === "offer") {
        // уже занят другим звонком — отклоняем
        if (callState !== "idle") {
          sendSignal(from, { kind: "hangup" });
          return;
        }
        incomingRef.current = { from, sdp: sig.sdp, video: sig.video };
        setPeerId(from);
        setIsVideo(sig.video);
        setCallState("incoming");
      } else if (sig.kind === "answer") {
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
          for (const c of pendingIce.current) await pc.addIceCandidate(c);
          pendingIce.current = [];
          setCallState("connected");
        }
      } else if (sig.kind === "ice") {
        if (pc && pc.remoteDescription) await pc.addIceCandidate(sig.candidate);
        else pendingIce.current.push(sig.candidate);
      } else if (sig.kind === "hangup") {
        cleanup();
      }
    },
    [callState, sendSignal, cleanup],
  );

  const toggleMic = useCallback(() => {
    setLocalStream((s) => {
      s?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
      return s;
    });
    setMicOn((v) => !v);
  }, []);

  const toggleCam = useCallback(() => {
    setLocalStream((s) => {
      s?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
      return s;
    });
    setCamOn((v) => !v);
  }, []);

  return {
    callState,
    isVideo,
    micOn,
    camOn,
    localStream,
    remoteStream,
    peerId,
    startCall,
    acceptCall,
    hangup,
    handleSignal,
    toggleMic,
    toggleCam,
  };
}
