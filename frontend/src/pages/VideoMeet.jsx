import React, { useEffect, useRef, useState, useCallback } from "react";
import io from "socket.io-client";
import { useParams } from "react-router-dom";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";

const server_url =
  process.env.REACT_APP_SOCKET_URL ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:8000";

const connections = {};

const peerConfigConnections = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // { urls: "turn:your.turn.server:3478", username: "user", credential: "pass" },
  ],
};

function addStreamToConnection(pc, stream) {
  stream.getTracks().forEach((track) => {
    const existing = pc.getTransceivers().find(
      (t) => t.sender.track === null && t.receiver.track?.kind === track.kind
    );
    if (existing) {
      existing.sender.replaceTrack(track);
      existing.direction = "sendrecv";
    } else {
      pc.addTransceiver(track, { streams: [stream], direction: "sendrecv" });
    }
  });
}

function attachOnTrack(pc, socketListId, videoRef, setVideos) {
  const remoteStream = new MediaStream();
  pc.ontrack = (event) => {
    const incomingStream = event.streams?.[0];
    if (incomingStream) {
      incomingStream.getTracks().forEach((track) => {
        if (!remoteStream.getTracks().find((t) => t.id === track.id))
          remoteStream.addTrack(track);
      });
    } else {
      if (!remoteStream.getTracks().find((t) => t.id === event.track.id))
        remoteStream.addTrack(event.track);
    }
    setVideos((prev) => {
      const exists = prev.find((v) => v.socketId === socketListId);
      const updatedVideos = exists
        ? prev.map((v) =>
            v.socketId === socketListId ? { ...v, stream: remoteStream } : v
          )
        : [...prev, { socketId: socketListId, stream: remoteStream }];
      videoRef.current = updatedVideos;
      return updatedVideos;
    });
  };
}

/* ─── Reusable round control button ─── */
function CtrlBtn({ onClick, title, children, active = false, danger = false }) {
  const base =
    "relative flex items-center justify-center w-12 h-12 rounded-full border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500";
  const style = danger
    ? "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30"
    : active
    ? "bg-sky-600/30 border-sky-500/50 text-sky-400 hover:bg-sky-600/40"
    : "bg-slate-700 border-white/10 text-slate-200 hover:bg-slate-600";
  return (
    <button onClick={onClick} title={title} className={`${base} ${style}`}>
      {children}
    </button>
  );
}

export default function VideoMeetComponent() {
  const { url: meetingCode } = useParams();
  const socketRef    = useRef();
  const socketIdRef  = useRef();

  /* FIX 1 — Separate refs for every local <video> element */
  const lobbyVideoRef   = useRef(null);
  const primaryVideoRef = useRef(null);
  const localThumbRef   = useRef(null);
  const localStreamRef  = useRef(null); /* FIX 10 — no more window.localStream */

  const [videoAvailable,  setVideoAvailable]  = useState(true);
  const [audioAvailable,  setAudioAvailable]  = useState(true);
  const [video,           setVideo]           = useState(true);
  const [audio,           setAudio]           = useState(true);
  const [screen,          setScreen]          = useState(false);
  const [showModal,       setModal]           = useState(true);
  const [screenAvailable, setScreenAvailable] = useState(false);
  const [messages,        setMessages]        = useState([]);
  const [message,         setMessage]         = useState("");
  const [newMessages,     setNewMessages]     = useState(0);
  const [askForUsername,  setAskForUsername]  = useState(true);
  const [username,        setUsername]        = useState("");
  const [videos,          setVideos]          = useState([]);
  const [copySnackbar,    setCopySnackbar]    = useState(false);
  const [pinnedSocketId,  setPinnedSocketId]  = useState(null); /* FIX 3 */

  const videoRef          = useRef([]);
  const iceCandidateQueue = useRef({});
  const chatBodyRef       = useRef(null);

  /* Auto-scroll chat */
  useEffect(() => {
    if (chatBodyRef.current)
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [messages]);

  /* FIX 1 — attach local stream to all local video elements at once */
  const attachLocalStream = useCallback((stream) => {
    if (!stream) return;
    [lobbyVideoRef, localThumbRef].forEach((ref) => {
      if (ref.current) ref.current.srcObject = stream;
    });
  }, []);

  const flushIceCandidates = async (fromId) => {
    const queue = iceCandidateQueue.current[fromId];
    if (!queue || !connections[fromId]) return;
    while (queue.length) {
      const candidate = queue.shift();
      try { await connections[fromId].addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (e) { console.warn("ICE flush error:", e); }
    }
  };

  useEffect(() => { getPermissions(); }, []); // eslint-disable-line

  const getPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setVideoAvailable(true);
      setAudioAvailable(true);
      if (navigator.mediaDevices.getDisplayMedia) setScreenAvailable(true);
      localStreamRef.current = stream;
      if (lobbyVideoRef.current) lobbyVideoRef.current.srcObject = stream;
    } catch (error) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setVideoAvailable(false);
        setAudioAvailable(true);
        localStreamRef.current = audioStream;
      } catch {
        setVideoAvailable(false);
        setAudioAvailable(false);
      }
      console.warn("getUserMedia error:", error);
    }
  };

  const silence = () => {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const dst = osc.connect(ctx.createMediaStreamDestination());
    osc.start(); ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  const black = ({ width = 640, height = 480 } = {}) => {
    const canvas = Object.assign(document.createElement("canvas"), { width, height });
    canvas.getContext("2d").fillRect(0, 0, width, height);
    return Object.assign(canvas.captureStream().getVideoTracks()[0], { enabled: false });
  };

  const getUserMediaSuccess = useCallback((stream) => {
    try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    localStreamRef.current = stream;
    attachLocalStream(stream);

    for (const id in connections) {
      if (id === socketIdRef.current) continue;
      connections[id].getTransceivers().forEach((tc) => {
        const kind = tc.sender.track?.kind;
        if (!kind) return;
        const nt = stream.getTracks().find((t) => t.kind === kind);
        if (nt) tc.sender.replaceTrack(nt).catch(console.error);
      });
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setVideo(false); setAudio(false);
        const bs = new MediaStream([black(), silence()]);
        localStreamRef.current = bs;
        attachLocalStream(bs);
        for (const id in connections) {
          connections[id].getTransceivers().forEach((tc) => {
            const kind = tc.sender.track?.kind;
            if (!kind) return;
            const nt = bs.getTracks().find((t) => t.kind === kind);
            if (nt) tc.sender.replaceTrack(nt).catch(console.error);
          });
        }
      };
    });
  }, [attachLocalStream]);

  const getUserMedia = useCallback(() => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: video && videoAvailable, audio: audio && audioAvailable })
        .then(getUserMediaSuccess)
        .catch(console.error);
    } else {
      try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    }
  }, [video, audio, videoAvailable, audioAvailable, getUserMediaSuccess]);

  const getDisplayMediaSuccess = useCallback((stream) => {
    try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    localStreamRef.current = stream;
    attachLocalStream(stream);

    for (const id in connections) {
      if (id === socketIdRef.current) continue;
      connections[id].getTransceivers().forEach((tc) => {
        const kind = tc.sender.track?.kind;
        if (!kind) return;
        const nt = stream.getTracks().find((t) => t.kind === kind);
        if (nt) tc.sender.replaceTrack(nt).catch(console.error);
      });
    }
    stream.getTracks().forEach((track) => {
      track.onended = () => { setScreen(false); getUserMedia(); };
    });
  }, [attachLocalStream, getUserMedia]);

  /* FIX 4 — stop display tracks when toggled off in-app */
  const stopScreenShare = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    getUserMedia();
  }, [getUserMedia]);

  const ensurePeerConnection = useCallback((peerId) => {
    if (!peerId || peerId === socketIdRef.current) return null;
    if (connections[peerId]) return connections[peerId];

    const pc = new RTCPeerConnection(peerConfigConnections);
    connections[peerId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit(
          "signal",
          peerId,
          JSON.stringify({ ice: event.candidate })
        );
      }
    };

    attachOnTrack(pc, peerId, videoRef, setVideos);

    const streamToAdd =
      localStreamRef.current || new MediaStream([black(), silence()]);
    if (!localStreamRef.current) localStreamRef.current = streamToAdd;
    addStreamToConnection(pc, streamToAdd);

    return pc;
  }, []);

  const gotMessageFromServer = useCallback(async (fromId, message) => {
    const signal = JSON.parse(message);
    if (fromId === socketIdRef.current) return;
    const pc = ensurePeerConnection(fromId);
    if (!pc) return;

    if (signal.sdp) {
      try {
        const sdp = new RTCSessionDescription(signal.sdp);
        const { signalingState } = pc;
        if (sdp.type === "offer") {
          if (signalingState !== "stable") { console.warn(`Ignoring offer — state: ${signalingState}`); return; }
          await pc.setRemoteDescription(sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current.emit("signal", fromId, JSON.stringify({ sdp: pc.localDescription }));
        } else if (sdp.type === "answer") {
          if (signalingState !== "have-local-offer") { console.warn(`Ignoring answer — state: ${signalingState}`); return; }
          await pc.setRemoteDescription(sdp);
        }
        await flushIceCandidates(fromId);
      } catch (e) { console.error("SDP error:", e); }
    }

    if (signal.ice) {
      if (pc.remoteDescription?.type) {
        try { await pc.addIceCandidate(new RTCIceCandidate(signal.ice)); }
        catch (e) { console.warn("ICE error:", e); }
      } else {
        if (!iceCandidateQueue.current[fromId]) iceCandidateQueue.current[fromId] = [];
        iceCandidateQueue.current[fromId].push(signal.ice);
      }
    }
  }, [ensurePeerConnection]);

  const connectToSocketServer = () => {
    const roomId = (meetingCode || window.location.pathname).replace(/^\/+/, "");

    socketRef.current = io.connect(server_url, {
      secure: false,
      reconnection: true,          /* FIX 8 */
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("chat-message", addMessage);

    socketRef.current.on("user-left", (id) => {
      if (connections[id]) {
        connections[id].close();
        delete connections[id];
      }
      setPinnedSocketId((prev) => (prev === id ? null : prev));
      setVideos((prev) => prev.filter((v) => v.socketId !== id));
      videoRef.current = videoRef.current.filter((v) => v.socketId !== id);
    });

    // Existing users: create a PC for the new peer and wait for their offer.
    socketRef.current.on("user-joined", (peerId) => {
      ensurePeerConnection(peerId);
    });

    // Joining user: server tells us who is already in the room, so we initiate offers.
    socketRef.current.on("existing-users", (users = []) => {
      users.forEach((peerId) => {
        const pc = ensurePeerConnection(peerId);
        if (!pc) return;
        pc.createOffer()
          .then((desc) => pc.setLocalDescription(desc))
          .then(() =>
            socketRef.current.emit(
              "signal",
              peerId,
              JSON.stringify({ sdp: pc.localDescription })
            )
          )
          .catch(console.error);
      });
    });

    socketRef.current.on("connect", () => {
      socketIdRef.current = socketRef.current.id;

      // Reset peers on reconnect (socket id changes).
      iceCandidateQueue.current = {};
      for (const id in connections) {
        try {
          connections[id].close();
        } catch {}
        delete connections[id];
      }
      setPinnedSocketId(null);
      setVideos([]);
      videoRef.current = [];
      setMessages([]);
      setNewMessages(0);

      socketRef.current.emit(
        "join-call",
        roomId
      );
    });
  };

  const getMedia = () => { setVideo(videoAvailable); setAudio(audioAvailable); connectToSocketServer(); };

  const handleVideo = () => {
    if (!localStreamRef.current) return;
    const nv = !video; setVideo(nv);
    localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = nv; });
  };

  const handleAudio = () => {
    if (!localStreamRef.current) return;
    const nv = !audio; setAudio(nv);
    localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = nv; });
  };

  /* FIX 4 */
  useEffect(() => {
    if (screen) {
      navigator.mediaDevices.getDisplayMedia?.({ video: true, audio: true })
        .then(getDisplayMediaSuccess)
        .catch(() => setScreen(false));
    } else {
      stopScreenShare();
    }
  }, [screen]); // eslint-disable-line

  const handleScreen  = () => setScreen((s) => !s);
  const handleEndCall = () => {
    try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    for (const id in connections) { connections[id].close(); delete connections[id]; }
    window.location.href = "/";
  };

  const addMessage = (data, sender, socketIdSender) => {
    setMessages((prev) => [...prev, { sender, data }]);
    if (socketIdSender !== socketIdRef.current) setNewMessages((n) => n + 1);
  };

  /* FIX 5 — reset badge when opening chat */
  const handleToggleChat = () =>
    setModal((m) => { if (!m) setNewMessages(0); return !m; });

  /* FIX 6 — guard empty / anonymous messages */
  const sendMessage = () => {
    if (!message.trim() || !username.trim() || !socketRef.current) return;
    socketRef.current.emit("chat-message", message, username);
    setMessage("");
  };

  /* FIX 7 — onKeyDown instead of deprecated onKeyPress */
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const connect = () => { setAskForUsername(false); getMedia(); };

  const copyMeetingCode = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopySnackbar(true);
    setTimeout(() => setCopySnackbar(false), 3000);
  };

  /* Attach local thumb once meeting screen mounts — FIX 1 */
  useEffect(() => {
    if (!askForUsername && localThumbRef.current && localStreamRef.current)
      localThumbRef.current.srcObject = localStreamRef.current;
  }, [askForUsername]);

  /* FIX 3 — primary video follows pinned peer or first remote */
  useEffect(() => {
    if (!primaryVideoRef.current) return;
    const target = pinnedSocketId
      ? videos.find((v) => v.socketId === pinnedSocketId)
      : videos[0];
    if (target?.stream) primaryVideoRef.current.srcObject = target.stream;
  }, [videos, pinnedSocketId]);

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <div className="w-screen h-screen bg-[#0d0f14] text-slate-100 flex overflow-hidden font-sans">

      {/* ──────────────── LOBBY ──────────────── */}
      {askForUsername ? (
        <div className="flex flex-col items-center justify-center gap-8 w-full h-full
          bg-[radial-gradient(ellipse_at_50%_40%,#1a2540_0%,#0d0f14_70%)]">

          {/* Brand */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-sky-600 flex items-center justify-center
              shadow-lg shadow-sky-900/40">
              <VideocamIcon style={{ fontSize: 28, color: "#fff" }} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">VideoBox</h1>
            <p className="text-slate-400 text-sm">Enter your name to join the call</p>
          </div>

          {/* Name input */}
          <div className="flex gap-3 items-center w-full max-w-sm px-4">
            <input
              type="text"
              placeholder="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && username.trim() && connect()}
              className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5
                text-slate-100 placeholder-slate-500 text-sm
                focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent
                transition-all"
            />
            <button
              onClick={connect}
              disabled={!username.trim()}
              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed
                text-white font-semibold text-sm px-5 py-2.5 rounded-xl
                transition-all duration-150 focus:outline-none focus-visible:ring-2
                focus-visible:ring-sky-400"
            >
              Join
            </button>
          </div>

          {/* Camera preview */}
          <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden
            border border-white/10 shadow-2xl shadow-black/60 bg-black aspect-video">
            <video
              ref={lobbyVideoRef}
              autoPlay muted playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
          </div>
        </div>

      ) : (
        /* ──────────────── MEETING ROOM ──────────────── */
        <div className="flex w-full h-full">

          {/* ── Chat Panel ── */}
          {showModal && (
            <aside className="w-72 min-w-[240px] max-w-[320px] flex-shrink-0 h-full
              bg-[#161b24] border-r border-white/[0.07] flex flex-col overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4
                border-b border-white/[0.07] flex-shrink-0">
                <span className="font-semibold text-sm tracking-wide text-slate-100">Chat</span>
                <button
                  onClick={handleToggleChat}
                  className="text-slate-400 hover:text-slate-100 transition-colors
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
                >
                  <CloseIcon fontSize="small" />
                </button>
              </div>

              {/* Messages */}
              <div
                ref={chatBodyRef}
                className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
                style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
              >
                {messages.length ? messages.map((item, i) => (
                  <div key={i} className="bg-slate-800/70 border border-white/[0.07]
                    rounded-xl px-3 py-2.5">
                    <div className="text-sky-400 text-[0.65rem] font-bold uppercase
                      tracking-wider mb-1">
                      {item.sender}
                    </div>
                    <div className="text-slate-200 text-[0.85rem] leading-snug break-words">
                      {item.data}
                    </div>
                  </div>
                )) : (
                  <p className="text-slate-500 text-xs text-center mt-6">No messages yet</p>
                )}
              </div>

              {/* Message input */}
              <div className="flex gap-2 px-4 py-3 border-t border-white/[0.07] flex-shrink-0">
                <input
                  type="text"
                  placeholder="Type a message…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2
                    text-slate-100 placeholder-slate-500 text-sm
                    focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                />
                <button
                  onClick={sendMessage}
                  disabled={!message.trim()}
                  className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed
                    text-white px-3 py-2 rounded-xl transition-all duration-150
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <SendIcon fontSize="small" />
                </button>
              </div>

              {/* Meeting code */}
              <div className="px-4 py-3 border-t border-white/[0.07] bg-black/20 flex-shrink-0">
                <p className="text-slate-500 text-[0.65rem] uppercase tracking-wider mb-2">
                  Meeting Code
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    readOnly
                    value={window.location.pathname.substring(1)}
                    className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5
                      text-slate-300 text-xs focus:outline-none truncate"
                  />
                  <button
                    onClick={copyMeetingCode}
                    className="bg-sky-600 hover:bg-sky-500 text-white p-1.5 rounded-lg
                      transition-all duration-150 focus:outline-none focus-visible:ring-2
                      focus-visible:ring-sky-400 flex-shrink-0"
                    title="Copy link"
                  >
                    <ContentCopyIcon style={{ fontSize: 16 }} />
                  </button>
                </div>
              </div>
            </aside>
          )}

          {/* ── Main Area ── */}
          <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#0d0f14]">

            <div className="flex-1 flex flex-col px-4 pt-4 gap-3 overflow-hidden">

              {/* Primary / Large Video — FIX 3 */}
              <div className="flex-1 rounded-2xl overflow-hidden bg-black
                border border-white/[0.07] shadow-2xl shadow-black/50 relative min-h-0">
                <video
                  ref={primaryVideoRef}
                  autoPlay playsInline
                  className="w-full h-full object-cover"
                  style={{ display: videos.length > 0 ? "block" : "none" }}
                />
                {videos.length === 0 && (
                  <video
                    ref={(el) => {
                      if (el && localStreamRef.current) el.srcObject = localStreamRef.current;
                    }}
                    autoPlay muted playsInline
                    className="w-full h-full object-cover"
                  />
                )}
                {videos.length === 0 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2
                    bg-black/60 backdrop-blur-sm text-slate-300 text-xs
                    px-4 py-1.5 rounded-full border border-white/10 whitespace-nowrap">
                    Waiting for others to join…
                  </div>
                )}
              </div>

              {/* Thumbnail strip */}
              {videos.length > 0 && (
                <div
                  className="flex gap-3 pb-1 overflow-x-auto flex-shrink-0 h-[120px]"
                  style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
                >
                  {/* Local thumbnail — FIX 1 dedicated ref */}
                  <div
                    onClick={() => setPinnedSocketId(null)}
                    title="Pin your own video"
                    className={`relative w-[180px] min-w-[150px] h-full rounded-xl overflow-hidden
                      bg-black flex-shrink-0 cursor-pointer transition-all duration-200 border-2
                      hover:scale-[1.02]
                      ${pinnedSocketId === null
                        ? "border-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.25)]"
                        : "border-transparent hover:border-sky-500/40"}`}
                  >
                    <video
                      ref={localThumbRef}
                      autoPlay muted playsInline
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1.5 left-2 bg-black/60 backdrop-blur-sm
                      text-white text-[0.6rem] font-semibold px-2 py-0.5 rounded-full">
                      You
                    </span>
                  </div>

                  {/* Remote thumbnails — FIX 3 click-to-pin */}
                  {videos.map((v) => (
                    <div
                      key={v.socketId}
                      onClick={() => setPinnedSocketId(v.socketId)}
                      title="Click to pin"
                      className={`relative w-[180px] min-w-[150px] h-full rounded-xl overflow-hidden
                        bg-black flex-shrink-0 cursor-pointer transition-all duration-200 border-2
                        hover:scale-[1.02]
                        ${pinnedSocketId === v.socketId
                          ? "border-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.25)]"
                          : "border-transparent hover:border-sky-500/40"}`}
                    >
                      <video
                        ref={(el) => { if (el && v.stream) el.srcObject = v.stream; }}
                        autoPlay playsInline
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Control Bar ── */}
            <div className="h-[72px] flex-shrink-0 flex items-center justify-center gap-3
              bg-[#161b24] border-t border-white/[0.07] px-6">

              <CtrlBtn onClick={copyMeetingCode} title="Copy Meeting Link">
                <ContentCopyIcon fontSize="small" />
              </CtrlBtn>

              <CtrlBtn
                onClick={handleVideo}
                title={video ? "Turn off camera" : "Turn on camera"}
                danger={!video}
              >
                {video ? <VideocamIcon fontSize="small" /> : <VideocamOffIcon fontSize="small" />}
              </CtrlBtn>

              {/* End call — distinct red pill */}
              <button
                onClick={handleEndCall}
                title="End call"
                className="flex items-center justify-center w-14 h-14 rounded-full
                  bg-red-500 hover:bg-red-600 active:scale-95 text-white
                  shadow-lg shadow-red-900/40 transition-all duration-150
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <CallEndIcon />
              </button>

              <CtrlBtn
                onClick={handleAudio}
                title={audio ? "Mute" : "Unmute"}
                danger={!audio}
              >
                {audio ? <MicIcon fontSize="small" /> : <MicOffIcon fontSize="small" />}
              </CtrlBtn>

              {screenAvailable && (
                <CtrlBtn
                  onClick={handleScreen}
                  title={screen ? "Stop sharing" : "Share screen"}
                  active={screen}
                >
                  {screen
                    ? <StopScreenShareIcon fontSize="small" />
                    : <ScreenShareIcon fontSize="small" />}
                </CtrlBtn>
              )}

              {/* Chat toggle — FIX 5 badge resets on open */}
              <CtrlBtn
                onClick={handleToggleChat}
                title="Toggle chat"
                active={showModal}
              >
                <ChatIcon fontSize="small" />
                {newMessages > 0 && !showModal && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full
                    bg-red-500 text-white text-[0.55rem] font-bold
                    flex items-center justify-center leading-none pointer-events-none">
                    {newMessages > 9 ? "9+" : newMessages}
                  </span>
                )}
              </CtrlBtn>
            </div>
          </main>
        </div>
      )}

      {/* ── Copy toast — FIX: no MUI Snackbar needed ── */}
      {copySnackbar && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
          bg-slate-700 border border-white/10 text-slate-100 text-sm
          px-5 py-3 rounded-2xl shadow-2xl shadow-black/50 backdrop-blur-sm
          animate-[fadeInUp_0.2s_ease-out] whitespace-nowrap">
          ✓ Meeting link copied to clipboard
        </div>
      )}
    </div>
  );
}
