# Live Video Streaming Platform

A real-time video streaming platform built with Node.js, WebRTC, and Socket.io. Stream your content live or watch others stream in real-time with peer-to-peer connections.

## Features

- 🎥 **Live Video Streaming**: Start broadcasting your video and audio in real-time
- 👁️ **Watch Streams**: Browse and watch active live streams
- 💬 **Real-time Chat**: Chat with streamers and other viewers
- 📊 **Viewer Count**: See how many people are watching
- 🔄 **WebRTC**: Peer-to-peer video streaming using WebRTC technology
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A modern web browser with WebRTC support (Chrome, Firefox, Safari, Edge)

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (optional, for custom port):
```
PORT=3000
NODE_ENV=development
```

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

5. Open your browser and navigate to:
```
http://localhost:3000
```

## 🚀 Deployment

This app can be deployed for free on several platforms. See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

**Quick Deploy Options:**
- **Render.com** (Recommended) - Free tier, automatic HTTPS
- **Railway.app** - Free tier with $5 credit/month
- **Fly.io** - Free tier available
- **Replit** - Free tier, easy setup

All platforms provide HTTPS automatically, which is required for camera/microphone access.

## Usage

### Starting a Stream

1. Click on "Go Live" in the navigation
2. Enter a stream title and your name
3. Click "Start Streaming"
4. Allow camera and microphone permissions when prompted
5. Your stream is now live!

### Watching a Stream

1. Click on "Watch Streams" in the navigation
2. Browse available streams
3. Click on a stream card to watch
4. Use the chat to interact with the streamer and other viewers

## Technology Stack

- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.io
- **Video Streaming**: WebRTC (Web Real-Time Communication)
- **Frontend**: HTML5, CSS3, JavaScript
- **Database**: In-memory storage (can be extended to use PostgreSQL)

## Architecture

- **Server**: Express server with Socket.io for WebSocket connections
- **Signaling**: WebRTC signaling handled through Socket.io
- **Streaming**: Peer-to-peer connections using WebRTC
- **ICE Servers**: Uses Google's public STUN servers

## API Endpoints

- `GET /api/streams` - Get all active streams
- `GET /api/streams/:id` - Get a specific stream
- `POST /api/streams` - Create a new stream
- `DELETE /api/streams/:id` - Delete a stream

## Socket.io Events

### Client to Server:
- `start-stream` - Start a new stream
- `stop-stream` - Stop the current stream
- `join-stream` - Join a stream room
- `leave-stream` - Leave a stream room
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice-candidate` - ICE candidate exchange
- `chat-message` - Send a chat message

### Server to Client:
- `stream-started` - Stream started confirmation
- `stream-ended` - Stream ended notification
- `new-stream` - New stream available
- `stream-removed` - Stream removed notification
- `viewer-count` - Updated viewer count
- `chat-message` - New chat message
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice-candidate` - ICE candidate

## Future Enhancements

- [ ] User authentication and profiles
- [ ] Stream recording and playback
- [ ] Multiple quality options
- [ ] Stream categories and tags
- [ ] Follow/favorite streams
- [ ] Notifications
- [ ] Database persistence
- [ ] TURN servers for better connectivity
- [ ] Stream analytics
- [ ] Moderation tools

## Troubleshooting

### Camera/Microphone not working
- Make sure you've granted browser permissions
- Check if other applications are using your camera/microphone
- Try refreshing the page

### Can't see streams
- Check your internet connection
- Make sure the streamer has started their stream
- Try refreshing the streams list

### Connection issues
- WebRTC requires STUN/TURN servers for NAT traversal
- For production, consider using dedicated TURN servers
- Check firewall settings

## License

ISC

## Contributing

Feel free to submit issues and enhancement requests!

