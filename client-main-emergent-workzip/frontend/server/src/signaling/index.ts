import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';

interface RoomPeer {
  socketId: string;
  userId: string;
  name: string;
  role: 'mentor' | 'student';
}

const rooms = new Map<string, RoomPeer[]>();

export function initSignaling(httpServer: HttpServer, clientOrigin: string) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: clientOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/signaling',
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Signaling] Client connected: ${socket.id}`);

    socket.on('join-room', ({ roomId, userId, name, role }: { roomId: string; userId: string; name: string; role: 'mentor' | 'student' }) => {
      socket.join(roomId);

      if (!rooms.has(roomId)) rooms.set(roomId, []);
      const peers = rooms.get(roomId)!;

      // Send existing peers to the newly joined user
      socket.emit('room-peers', peers.map(p => ({ socketId: p.socketId, userId: p.userId, name: p.name, role: p.role })));

      // Notify existing peers about the new user
      socket.to(roomId).emit('peer-joined', { socketId: socket.id, userId, name, role });

      // Add to room
      peers.push({ socketId: socket.id, userId, name, role });

      console.log(`[Signaling] ${name} (${role}) joined room ${roomId} — ${peers.length} peer(s)`);
    });

    // Relay WebRTC offer from caller to target
    socket.on('offer', ({ to, offer, from, fromName }: { to: string; offer: RTCSessionDescriptionInit; from: string; fromName: string }) => {
      io.to(to).emit('offer', { from: socket.id, offer, fromName });
    });

    // Relay WebRTC answer from callee to caller
    socket.on('answer', ({ to, answer }: { to: string; answer: RTCSessionDescriptionInit }) => {
      io.to(to).emit('answer', { from: socket.id, answer });
    });

    // Relay ICE candidates between peers
    socket.on('ice-candidate', ({ to, candidate }: { to: string; candidate: RTCIceCandidateInit }) => {
      io.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    // Relay media state (mute/camera toggle)
    socket.on('media-state', ({ roomId, audio, video }: { roomId: string; audio: boolean; video: boolean }) => {
      socket.to(roomId).emit('peer-media-state', { from: socket.id, audio, video });
    });

    // Relay recording start/stop to all peers (DPDP: all must be notified)
    socket.on('broadcast-recording', ({ roomId, started, by }: { roomId: string; started: boolean; by: string }) => {
      socket.to(roomId).emit(started ? 'recording-started' : 'recording-stopped', { by });
    });

    // In-call chat relay
    socket.on('chat-message', ({ roomId, from, text, time }: { roomId: string; from: string; text: string; time: string }) => {
      socket.to(roomId).emit('chat-message', { from, text, time });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      rooms.forEach((peers, roomId) => {
        const idx = peers.findIndex(p => p.socketId === socket.id);
        if (idx !== -1) {
          const [leaving] = peers.splice(idx, 1);
          io.to(roomId).emit('peer-left', { socketId: socket.id, name: leaving.name });
          if (peers.length === 0) rooms.delete(roomId);
          console.log(`[Signaling] ${leaving.name} left room ${roomId}`);
        }
      });
      console.log(`[Signaling] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
