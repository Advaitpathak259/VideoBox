import React, { useEffect, useRef, useState, useCallback } from "react";
import io from "socket.io-client";
import { IconButton, TextField, Snackbar } from "@mui/material";
import { Button } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import styles from "../styles/videoComponent.module.css";

const server_url =
  process.env.REACT_APP_SOCKET_URL || "https://videobox-1.onrender.com";

// Keep peer connections outside React state to avoid stale closures
const connections = {};

const peerConfigConnections = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// Use addTransceiver so send/receive directions are always explicit.
// This prevents "Incompatible send direction" SDP errors that happen when
// one side adds tracks and the other side's SDP says recvonly or inactive.
function addStreamToConnection(pc, stream) {
  stream.getTracks().forEach((track) => {
    // Check if a transceiver already exists for this kind — reuse it
    // instead of adding a duplicate sender on renegotiation.
    const existing = pc.getTransceivers().find(
      (t) => t.sender.track === null && t.receiver.track?.kind === track.kind
    );
    if (existing) {
      existing.sender.replaceTrack(track);
      existing.direction = "sendrecv";
    } else {
      pc.addTransceiver(track, {
        streams: [stream],
        direction: "sendrecv",   // always explicitly declare both directions
      });
    }
  });
}

// Use ontrack (not deprecated onaddstream) to receive remote streams.
// Rebuild a single MediaStream per peer from incoming tracks.
function attachOnTrack(pc, socketListId, videoRef, setVideos) {
  const remoteStream = new MediaStream();

  pc.ontrack = (event) => {
    // Use event.streams[0] if available; otherwise attach the track directly
    const incomingStream = event.streams && event.streams[0];
    if (incomingStream) {
      incomingStream.getTracks().forEach((track) => {
        if (!remoteStream.getTracks().find((t) => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
      });
    } else {
      if (!remoteStream.getTracks().find((t) => t.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }
    }

    setVideos((prev) => {
      const exists = prev.find((v) => v.socketId === socketListId);
      const updatedVideos = exists
        ? prev.map((v) =>
            v.socketId === socketListId
              ? { ...v, stream: remoteStream }
              : v
          )
        : [...prev, { socketId: socketListId, stream: remoteStream }];
      videoRef.current = updatedVideos;
      return updatedVideos;
    });
  };
}

export default function VideoMeetComponent() {
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoref = useRef();

  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);

  // BUG FIX 3: Initialize video/audio as booleans, NOT arrays
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);

  const [screen, setScreen] = useState(false);
  const [showModal, setModal] = useState(true);
  const [screenAvailable, setScreenAvailable] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [videos, setVideos] = useState([]);
  const [copySnackbar, setCopySnackbar] = useState(false);

  const videoRef = useRef([]);

  // BUG FIX 4: Queue ICE candidates that arrive before remoteDescription is set
  const iceCandidateQueue = useRef({});

  const flushIceCandidates = async (fromId) => {
    const queue = iceCandidateQueue.current[fromId];
    if (!queue || !connections[fromId]) return;
    while (queue.length) {
      const candidate = queue.shift();
      try {
        await connections[fromId].addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (e) {
        console.warn("ICE flush error:", e);
      }
    }
  };

  useEffect(() => {
    getPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPermissions = async () => {
    try {
      const constraints = { video: true, audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      setVideoAvailable(true);
      setAudioAvailable(true);

      if (navigator.mediaDevices.getDisplayMedia) {
        setScreenAvailable(true);
      }

      window.localStream = stream;
      if (localVideoref.current) {
        localVideoref.current.srcObject = stream;
      }
    } catch (error) {
      // Try audio only
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setVideoAvailable(false);
        setAudioAvailable(true);
        window.localStream = audioStream;
      } catch {
        setVideoAvailable(false);
        setAudioAvailable(false);
      }
      console.warn("getUserMedia error:", error);
    }
  };


  const silence = () => {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  const black = ({ width = 640, height = 480 } = {}) => {
    const canvas = Object.assign(document.createElement("canvas"), {
      width,
      height,
    });
    canvas.getContext("2d").fillRect(0, 0, width, height);
    const stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  const getUserMediaSuccess = (stream) => {
    // Stop old tracks
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {}

    window.localStream = stream;
    if (localVideoref.current) {
      localVideoref.current.srcObject = stream;
    }

    // Use replaceTrack to swap the track on existing transceivers.
    // This avoids direction mismatches and does NOT require renegotiation
    // because the transceiver structure (sendrecv) stays the same.
    for (const id in connections) {
      if (id === socketIdRef.current) continue;
      const pc = connections[id];

      pc.getTransceivers().forEach((transceiver) => {
        const kind = transceiver.sender.track?.kind;
        if (!kind) return;
        const newTrack = stream.getTracks().find((t) => t.kind === kind);
        if (newTrack) {
          transceiver.sender.replaceTrack(newTrack).catch(console.error);
        }
      });
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setVideo(false);
        setAudio(false);

        const blackSilence = () =>
          new MediaStream([black(), silence()]);
        window.localStream = blackSilence();
        if (localVideoref.current) {
          localVideoref.current.srcObject = window.localStream;
        }

        for (const id in connections) {
          const pc = connections[id];
          pc.getTransceivers().forEach((transceiver) => {
            const kind = transceiver.sender.track?.kind;
            if (!kind) return;
            const newTrack = window.localStream.getTracks().find((t) => t.kind === kind);
            if (newTrack) transceiver.sender.replaceTrack(newTrack).catch(console.error);
          });
        }
      };
    });
  };

  const getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: video && videoAvailable, audio: audio && audioAvailable })
        .then(getUserMediaSuccess)
        .catch(console.error);
    } else {
      try {
        window.localStream.getTracks().forEach((track) => track.stop());
      } catch {}
    }
  };

  const getDislayMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch {}

    window.localStream = stream;
    if (localVideoref.current) {
      localVideoref.current.srcObject = stream;
    }

    for (const id in connections) {
      if (id === socketIdRef.current) continue;
      const pc = connections[id];
      pc.getTransceivers().forEach((transceiver) => {
        const kind = transceiver.sender.track?.kind;
        if (!kind) return;
        const newTrack = stream.getTracks().find((t) => t.kind === kind);
        if (newTrack) transceiver.sender.replaceTrack(newTrack).catch(console.error);
      });
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setScreen(false);
        getUserMedia();
      };
    });
  };

  const getDislayMedia = () => {
    if (navigator.mediaDevices.getDisplayMedia) {
      navigator.mediaDevices
        .getDisplayMedia({ video: true, audio: true })
        .then(getDislayMediaSuccess)
        .catch(console.error);
    }
  };

  const gotMessageFromServer = useCallback(async (fromId, message) => {
    const signal = JSON.parse(message);
    if (fromId === socketIdRef.current) return;

    const pc = connections[fromId];
    if (!pc) {
      console.warn("No peer connection found for", fromId);
      return;
    }

    if (signal.sdp) {
      try {
        const sdp = new RTCSessionDescription(signal.sdp);
        const { signalingState } = pc;

        if (sdp.type === "offer") {
          // Only accept a new offer when in stable state
          if (signalingState !== "stable") {
            console.warn(`Ignoring offer from ${fromId} — state is: ${signalingState}`);
            return;
          }
          await pc.setRemoteDescription(sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current.emit(
            "signal",
            fromId,
            JSON.stringify({ sdp: pc.localDescription })
          );

        } else if (sdp.type === "answer") {
          // Only accept an answer when we sent an offer and are waiting for it
          if (signalingState !== "have-local-offer") {
            console.warn(`Ignoring answer from ${fromId} — state is: ${signalingState}`);
            return;
          }
          await pc.setRemoteDescription(sdp);
        }

        // Flush ICE candidates that arrived before remoteDescription was ready
        await flushIceCandidates(fromId);

      } catch (e) {
        console.error("SDP error:", e);
      }
    }

    if (signal.ice) {
      if (pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.ice));
        } catch (e) {
          console.warn("ICE candidate error:", e);
        }
      } else {
        if (!iceCandidateQueue.current[fromId]) {
          iceCandidateQueue.current[fromId] = [];
        }
        iceCandidateQueue.current[fromId].push(signal.ice);
      }
    }
  }, []);

  const connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false });

    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-call", window.location.href);
      socketIdRef.current = socketRef.current.id;

      socketRef.current.on("chat-message", addMessage);

      socketRef.current.on("user-left", (id) => {
        // Clean up peer connection
        if (connections[id]) {
          connections[id].close();
          delete connections[id];
        }
        setVideos((prev) => prev.filter((v) => v.socketId !== id));
        videoRef.current = videoRef.current.filter((v) => v.socketId !== id);
      });

      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((socketListId) => {
          // Avoid recreating an existing connection
          if (connections[socketListId]) return;

          const pc = new RTCPeerConnection(peerConfigConnections);
          connections[socketListId] = pc;

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socketRef.current.emit(
                "signal",
                socketListId,
                JSON.stringify({ ice: event.candidate })
              );
            }
          };

          // BUG FIX 1 & 5: Use ontrack instead of deprecated onaddstream
          attachOnTrack(pc, socketListId, videoRef, setVideos);

          // Add local stream tracks
          const streamToAdd = window.localStream || new MediaStream([black(), silence()]);
          if (!window.localStream) window.localStream = streamToAdd;
          addStreamToConnection(pc, streamToAdd);
        });

        // Only the newly joined user creates offers (not everyone)
        if (id === socketIdRef.current) {
          for (const id2 in connections) {
            if (id2 === socketIdRef.current) continue;
            connections[id2]
              .createOffer()
              .then((desc) => connections[id2].setLocalDescription(desc))
              .then(() => {
                socketRef.current.emit(
                  "signal",
                  id2,
                  JSON.stringify({ sdp: connections[id2].localDescription })
                );
              })
              .catch(console.error);
          }
        }
      });
    });
  };

  const getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  const handleVideo = () => {
    if (!window.localStream) return;
    const newVal = !video;
    setVideo(newVal);
    window.localStream.getVideoTracks().forEach((t) => { t.enabled = newVal; });
  };
  const handleAudio = () => {
    if (!window.localStream) return;
    const newVal = !audio;
    setAudio(newVal);
    window.localStream.getAudioTracks().forEach((t) => { t.enabled = newVal; });
  };

  useEffect(() => {
    if (screen) {
      getDislayMedia();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const handleScreen = () => setScreen((s) => !s);

  const handleEndCall = () => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch {}
    for (const id in connections) {
      connections[id].close();
      delete connections[id];
    }
    window.location.href = "/";
  };

  const addMessage = (data, sender, socketIdSender) => {
    setMessages((prev) => [...prev, { sender, data }]);
    if (socketIdSender !== socketIdRef.current) {
      setNewMessages((n) => n + 1);
    }
  };

  const sendMessage = () => {
    if (!message || !socketRef.current) return;
    socketRef.current.emit("chat-message", message, username);
    setMessage("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const connect = () => {
    setAskForUsername(false);
    getMedia();
  };

  const copyMeetingCode = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopySnackbar(true);
  };

  const primaryVideoRef = useRef(null);

  // Always keep localVideoref attached to the local stream.
  // Re-attach whenever the element remounts (e.g. lobby → meeting transition).
  useEffect(() => {
    if (localVideoref.current && window.localStream) {
      localVideoref.current.srcObject = window.localStream;
    }
  });

  // Keep primary (large) video in sync with first remote stream
  useEffect(() => {
    if (primaryVideoRef.current && videos.length > 0 && videos[0].stream) {
      primaryVideoRef.current.srcObject = videos[0].stream;
    }
  }, [videos]);

  return (
    <div className={styles.pageWrapper}>
      {askForUsername ? (
        <div className={styles.lobbyContainer}>
          <h2 className={styles.lobbyTitle}>Enter into Lobby</h2>
          <div className={styles.lobbyControls}>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              variant="outlined"
              size="small"
            />
            <Button variant="contained" onClick={connect}>
              Connect
            </Button>
          </div>
          <div className={styles.lobbyPreview}>
            {/* BUG FIX 2: localVideoref always points to local stream */}
            <video
              ref={localVideoref}
              autoPlay
              muted
              className={styles.lobbyVideo}
            />
          </div>
        </div>
      ) : (
        <div className={styles.meetContainer}>
          {/* CHAT PANEL */}
          {showModal && (
            <aside className={styles.chatPanel}>
              <div className={styles.chatHeader}>
                <h3>Chat</h3>
                <button className={styles.closeChatBtn} onClick={() => setModal(false)}>
                  ×
                </button>
              </div>

              <div className={styles.chatBody}>
                {messages.length ? (
                  messages.map((item, index) => (
                    <div key={index} className={styles.chatMessage}>
                      <div className={styles.chatSender}>{item.sender}</div>
                      <div className={styles.chatText}>{item.data}</div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyChat}>No messages yet</div>
                )}
              </div>

              <div className={styles.chatInput}>
                <TextField
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  size="small"
                  fullWidth
                />
                <Button variant="contained" onClick={sendMessage}>
                  Send
                </Button>
              </div>

              <div
                style={{
                  padding: "15px",
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  backgroundColor: "rgba(0,0,0,0.2)",
                }}
              >
                <div
                  style={{
                    marginBottom: "8px",
                    color: "#b0b0b0",
                    fontSize: "12px",
                  }}
                >
                  Meeting Code
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <TextField
                    value={window.location.pathname.substring(1)}
                    size="small"
                    fullWidth
                    InputProps={{
                      readOnly: true,
                      style: { color: "#fff", fontSize: "14px" },
                    }}
                  />
                  <IconButton
                    onClick={copyMeetingCode}
                    size="small"
                    style={{ backgroundColor: "#018CCB", color: "#fff" }}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </div>
              </div>
            </aside>
          )}

          {/* MAIN AREA */}
          <main className={styles.mainArea}>
            <div className={styles.conferenceWrap}>
              {/* Large Primary Video — always mounted, never swapped */}
              <div className={styles.primaryVideo}>
                {/* Remote stream shown when someone else is in the room */}
                <video
                  ref={primaryVideoRef}
                  autoPlay
                  playsInline
                  className={styles.largeVideo}
                  style={{ display: videos.length > 0 ? "block" : "none" }}
                />
                {/* Local stream shown when alone — always mounted so srcObject is never lost */}
                <video
                  ref={localVideoref}
                  autoPlay
                  muted
                  playsInline
                  className={styles.largeVideo}
                  style={{ display: videos.length > 0 ? "none" : "block" }}
                />
              </div>

              {/* Thumbnail grid */}
              <div className={styles.conferenceGrid}>
                {/* Local video thumbnail — always rendered here too.
                    Both this and the large slot reference localVideoref;
                    the useEffect above re-attaches srcObject every render
                    so whichever is visible always has the stream. */}
                {videos.length > 0 && (
                  <div className={styles.gridItem}>
                    <video
                      ref={localVideoref}
                      autoPlay
                      muted
                      playsInline
                      className={styles.gridVideo}
                    />
                    <span className={styles.nameTag}>You</span>
                  </div>
                )}

                {videos.map((v) => (
                  <div key={v.socketId} className={styles.gridItem}>
                    <video
                      ref={(ref) => {
                        if (ref && v.stream) ref.srcObject = v.stream;
                      }}
                      autoPlay
                      playsInline
                      className={styles.gridVideo}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* CONTROL BAR */}
            <div className={styles.controlBar}>
              <IconButton
                onClick={copyMeetingCode}
                className={styles.controlButton}
                size="large"
                title="Copy Meeting Link"
              >
                <ContentCopyIcon />
              </IconButton>

              <IconButton
                onClick={handleVideo}
                className={styles.controlButton}
                size="large"
              >
                {video ? <VideocamIcon /> : <VideocamOffIcon />}
              </IconButton>

              <IconButton
                onClick={handleEndCall}
                sx={{ background: "#ff4d4d", color: "white" }}
                size="large"
              >
                <CallEndIcon />
              </IconButton>

              <IconButton
                onClick={handleAudio}
                className={styles.controlButton}
                size="large"
              >
                {audio ? <MicIcon /> : <MicOffIcon />}
              </IconButton>

              {screenAvailable && (
                <IconButton
                  onClick={handleScreen}
                  className={styles.controlButton}
                  size="large"
                >
                  {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                </IconButton>
              )}

              <IconButton
                onClick={() => setModal((m) => !m)}
                className={styles.controlButton}
                size="large"
              >
                <ChatIcon />
                {newMessages > 0 && !showModal && (
                  <span className={styles.badge}>{newMessages}</span>
                )}
              </IconButton>
            </div>
          </main>
        </div>
      )}

      <Snackbar
        open={copySnackbar}
        autoHideDuration={3000}
        onClose={() => setCopySnackbar(false)}
        message="Meeting link copied to clipboard!"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </div>
  );
}