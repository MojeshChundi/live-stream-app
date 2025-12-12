const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Store active streams and rooms
const activeStreams = new Map();
const rooms = new Map();
const streamers = new Map(); // streamId -> streamer socket ID

// Health check endpoint (for keep-alive pings)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    streams: activeStreams.size
  });
});

// API Routes
app.get('/api/streams', (req, res) => {
  const streams = Array.from(activeStreams.values()).map(stream => ({
    id: stream.id,
    title: stream.title,
    streamer: stream.streamer,
    viewers: stream.viewers,
    createdAt: stream.createdAt
  }));
  res.json(streams);
});

app.get('/api/streams/:id', (req, res) => {
  const stream = activeStreams.get(req.params.id);
  if (!stream) {
    return res.status(404).json({ error: 'Stream not found' });
  }
  res.json({
    id: stream.id,
    title: stream.title,
    streamer: stream.streamer,
    viewers: stream.viewers,
    createdAt: stream.createdAt
  });
});

app.post('/api/streams', (req, res) => {
  const { title, streamer } = req.body;
  const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const stream = {
    id: streamId,
    title: title || 'Untitled Stream',
    streamer: streamer || 'Anonymous',
    viewers: 0,
    createdAt: new Date().toISOString()
  };
  
  activeStreams.set(streamId, stream);
  rooms.set(streamId, new Set());
  
  res.json(stream);
});

app.delete('/api/streams/:id', (req, res) => {
  const streamId = req.params.id;
  if (activeStreams.has(streamId)) {
    activeStreams.delete(streamId);
    rooms.delete(streamId);
    io.to(streamId).emit('stream-ended');
    res.json({ message: 'Stream deleted successfully' });
  } else {
    res.status(404).json({ error: 'Stream not found' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a stream room
  socket.on('join-stream', (streamId) => {
    socket.join(streamId);
    const room = rooms.get(streamId);
    if (room) {
      room.add(socket.id);
      const stream = activeStreams.get(streamId);
      if (stream) {
        stream.viewers = room.size;
        io.to(streamId).emit('viewer-count', stream.viewers);
      }
    }
    console.log(`User ${socket.id} joined stream ${streamId}`);
  });

  // Leave a stream room
  socket.on('leave-stream', (streamId) => {
    socket.leave(streamId);
    const room = rooms.get(streamId);
    if (room) {
      room.delete(socket.id);
      const stream = activeStreams.get(streamId);
      if (stream) {
        stream.viewers = room.size;
        io.to(streamId).emit('viewer-count', stream.viewers);
      }
    }
    console.log(`User ${socket.id} left stream ${streamId}`);
  });

  // WebRTC signaling - Offer
  socket.on('offer', (data) => {
    // Get the streamer's socket ID for this stream
    const streamerId = streamers.get(data.streamId);
    if (streamerId) {
      // Send offer directly to the streamer
      io.to(streamerId).emit('offer', {
        offer: data.offer,
        viewerId: socket.id,
        streamId: data.streamId
      });
      console.log(`Offer forwarded from viewer ${socket.id} to streamer ${streamerId} for stream ${data.streamId}`);
    } else {
      console.error(`No streamer found for stream ${data.streamId}`);
    }
  });

  // WebRTC signaling - Answer
  socket.on('answer', (data) => {
    console.log(`Answer received from streamer ${socket.id} for viewer ${data.viewerId}`);
    socket.to(data.viewerId).emit('answer-viewer', {
      answer: data.answer,
      streamerId: socket.id
    });
    console.log(`Answer forwarded to viewer ${data.viewerId}`);
  });

  // WebRTC signaling - ICE Candidate
  socket.on('ice-candidate', (data) => {
    if (data.targetId) {
      // Send to specific target (streamer to viewer)
      socket.to(data.targetId).emit('ice-candidate-viewer', {
        candidate: data.candidate,
        senderId: socket.id
      });
    } else if (data.streamId) {
      // If no targetId but streamId provided, route to streamer (viewer to streamer)
      const streamerId = streamers.get(data.streamId);
      if (streamerId) {
        socket.to(streamerId).emit('ice-candidate-streamer', {
          candidate: data.candidate,
          senderId: socket.id
        });
      }
    }
  });

  // Start streaming
  socket.on('start-stream', (data) => {
    const { streamId, title, streamer } = data;
    socket.join(streamId);
    
    if (!activeStreams.has(streamId)) {
      const stream = {
        id: streamId,
        title: title || 'Untitled Stream',
        streamer: streamer || 'Anonymous',
        viewers: 0,
        createdAt: new Date().toISOString()
      };
      activeStreams.set(streamId, stream);
      rooms.set(streamId, new Set([socket.id]));
      streamers.set(streamId, socket.id); // Store streamer's socket ID
    }
    
    socket.emit('stream-started', { streamId });
    io.emit('new-stream', activeStreams.get(streamId));
    console.log(`Stream started: ${streamId} by ${socket.id}`);
  });

  // Stop streaming
  socket.on('stop-stream', (streamId) => {
    activeStreams.delete(streamId);
    rooms.delete(streamId);
    streamers.delete(streamId);
    io.to(streamId).emit('stream-ended');
    io.emit('stream-removed', streamId);
    console.log(`Stream stopped: ${streamId}`);
  });

  // Chat messages
  socket.on('chat-message', (data) => {
    io.to(data.streamId).emit('chat-message', {
      message: data.message,
      username: data.username || 'Anonymous',
      timestamp: new Date().toISOString()
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove user from all rooms
    rooms.forEach((room, streamId) => {
      if (room.has(socket.id)) {
        room.delete(socket.id);
        const stream = activeStreams.get(streamId);
        if (stream) {
          stream.viewers = room.size;
          io.to(streamId).emit('viewer-count', stream.viewers);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const os = require('os');

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  if (NODE_ENV === 'development') {
    const localIP = getLocalIP();
    console.log(`Live streaming server running on port ${PORT}`);
    console.log(`\n📍 Access the platform:`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://${localIP}:${PORT}`);
    console.log(`\n💡 Share this URL with others on your network: http://${localIP}:${PORT}\n`);
  } else {
    console.log(`Live streaming server running on port ${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
  }
});

