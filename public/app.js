// Socket.io connection
// Auto-detect the server URL (works for both localhost and production)
const socket = io({
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// Connection event handlers
socket.on('connect', () => {
  console.log('✅ Connected to server:', socket.id);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
});

// Global state
let currentStreamId = null;
let localStream = null;
let peerConnections = new Map();
let isStreaming = false;
let currentViewerStreamId = null;
let viewerPeerConnection = null;

// DOM Elements
const homeView = document.getElementById('homeView');
const streamView = document.getElementById('streamView');
const watchView = document.getElementById('watchView');
const homeBtn = document.getElementById('homeBtn');
const streamBtn = document.getElementById('streamBtn');
const watchBtn = document.getElementById('watchBtn');
const startStreamBtn = document.getElementById('startStreamBtn');
const stopStreamBtn = document.getElementById('stopStreamBtn');
const localVideo = document.getElementById('localVideo');
const streamsList = document.getElementById('streamsList');
const viewerModal = document.getElementById('viewerModal');
const remoteVideo = document.getElementById('remoteVideo');
const refreshStreamsBtn = document.getElementById('refreshStreamsBtn');

// Navigation
homeBtn.addEventListener('click', () => showView('homeView'));
streamBtn.addEventListener('click', () => showView('streamView'));
watchBtn.addEventListener('click', () => {
    showView('watchView');
    loadStreams();
});

function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewName).classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (viewName === 'homeView') homeBtn.classList.add('active');
    if (viewName === 'streamView') streamBtn.classList.add('active');
    if (viewName === 'watchView') watchBtn.classList.add('active');
}

// Check if media devices are available
function checkMediaDevices() {
    // Check if running over HTTP (not HTTPS) and not on localhost
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '[::1]';
    const isHTTPS = window.location.protocol === 'https:';
    const isHTTP = window.location.protocol === 'http:';
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return {
            available: false,
            error: 'Your browser does not support camera/microphone access. Please use Chrome, Firefox, Edge, or Safari.'
        };
    }
    
    // Chrome and Edge require HTTPS for getUserMedia when not on localhost
    if (isHTTP && !isLocalhost) {
        return {
            available: false,
            error: 'Camera/microphone access requires HTTPS when accessing from a network IP.\n\n' +
                   'Solutions:\n' +
                   '1. Use localhost instead: http://localhost:3000\n' +
                   '2. Set up HTTPS for your server\n' +
                   '3. Use Firefox (which allows HTTP on local network)\n\n' +
                   'Current URL: ' + window.location.href
        };
    }
    
    return { available: true };
}

// Start Streaming
startStreamBtn.addEventListener('click', async () => {
    // Check if media devices are available
    const mediaCheck = checkMediaDevices();
    if (!mediaCheck.available) {
        alert(mediaCheck.error);
        return;
    }
    
    // Disable button while processing
    startStreamBtn.disabled = true;
    startStreamBtn.textContent = 'Requesting permissions...';
    
    try {
        const streamTitle = document.getElementById('streamTitle').value || 'My Live Stream';
        const streamerName = document.getElementById('streamerName').value || 'Streamer';
        
        // Try to get user media with fallback options
        let constraints = {
            video: { 
                width: { ideal: 1280 }, 
                height: { ideal: 720 },
                facingMode: 'user'
            },
            audio: true
        };
        
        let localStream;
        let errorMessage = '';
        
        try {
            // Try with both video and audio first
            localStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (error) {
            console.warn('Failed to get both video and audio, trying video only:', error);
            errorMessage = error.message;
            
            try {
                // Try video only
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false
                });
                alert('Note: Microphone access was denied. Streaming with video only.');
            } catch (videoError) {
                console.warn('Failed to get video, trying audio only:', videoError);
                
                try {
                    // Try audio only
                    localStream = await navigator.mediaDevices.getUserMedia({
                        video: false,
                        audio: true
                    });
                    alert('Note: Camera access was denied. Streaming with audio only.');
                } catch (audioError) {
                    // Both failed
                    throw new Error('Could not access camera or microphone.');
                }
            }
        }
        
        if (!localStream) {
            throw new Error('Failed to get media stream');
        }
        
        // Check if we got any tracks
        const videoTracks = localStream.getVideoTracks();
        const audioTracks = localStream.getAudioTracks();
        
        if (videoTracks.length === 0 && audioTracks.length === 0) {
            throw new Error('No media tracks available');
        }
        
        localVideo.srcObject = localStream;
        document.getElementById('streamContainer').style.display = 'block';
        
        // Generate stream ID
        currentStreamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        document.getElementById('currentStreamId').textContent = currentStreamId;
        
        // Join stream room
        socket.emit('start-stream', {
            streamId: currentStreamId,
            title: streamTitle,
            streamer: streamerName
        });
        
        socket.emit('join-stream', currentStreamId);
        
        isStreaming = true;
        startStreamBtn.style.display = 'none';
        stopStreamBtn.style.display = 'inline-block';
        
        // Set up WebRTC for new viewers
        setupStreamerWebRTC();
        
    } catch (error) {
        console.error('Error starting stream:', error);
        
        let userMessage = 'Error accessing camera/microphone.\n\n';
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            userMessage += 'Permission was denied. Please:\n';
            userMessage += '1. Click the camera/microphone icon in your browser\'s address bar\n';
            userMessage += '2. Select "Allow" for camera and microphone\n';
            userMessage += '3. Refresh the page and try again\n\n';
            userMessage += 'Or check your browser settings:\n';
            userMessage += '- Chrome: Settings > Privacy and security > Site settings > Camera/Microphone\n';
            userMessage += '- Firefox: Options > Privacy & Security > Permissions\n';
            userMessage += '- Edge: Settings > Site permissions > Camera/Microphone';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            userMessage += 'No camera or microphone found.\n';
            userMessage += 'Please connect a camera/microphone and try again.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            userMessage += 'Camera/microphone is being used by another application.\n';
            userMessage += 'Please close other applications using your camera/microphone and try again.';
        } else if (error.name === 'OverconstrainedError') {
            userMessage += 'Camera does not support the requested settings.\n';
            userMessage += 'Trying with default settings...';
        } else {
            userMessage += `Error: ${error.message || 'Unknown error'}\n\n`;
            userMessage += 'Troubleshooting:\n';
            userMessage += '1. Make sure your camera/microphone is connected\n';
            userMessage += '2. Check browser permissions\n';
            userMessage += '3. Try using HTTPS (localhost works, but some networks require HTTPS)\n';
            userMessage += '4. Restart your browser';
        }
        
        alert(userMessage);
    } finally {
        startStreamBtn.disabled = false;
        startStreamBtn.textContent = 'Start Streaming';
    }
});

// Stop Streaming
stopStreamBtn.addEventListener('click', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (currentStreamId) {
        socket.emit('stop-stream', currentStreamId);
        socket.emit('leave-stream', currentStreamId);
    }
    
    // Close all peer connections
    peerConnections.forEach(pc => pc.close());
    peerConnections.clear();
    
    // Reset WebRTC setup flag
    streamerWebRTCSetup = false;
    socket.off('offer');
    socket.off('ice-candidate-streamer');
    
    localVideo.srcObject = null;
    document.getElementById('streamContainer').style.display = 'none';
    isStreaming = false;
    startStreamBtn.style.display = 'inline-block';
    stopStreamBtn.style.display = 'none';
    currentStreamId = null;
});

// Setup WebRTC for streamer (only set up once)
let streamerWebRTCSetup = false;

function setupStreamerWebRTC() {
    if (streamerWebRTCSetup) return; // Only set up once
    streamerWebRTCSetup = true;
    
    socket.off('offer').on('offer', async (data) => {
        const { offer, viewerId } = data;
        
        if (!viewerId || !localStream) {
            console.error('Missing viewerId or localStream');
            return;
        }
        
        console.log('Streamer received offer from viewer:', viewerId);
        
        const peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
        
        // Add local stream tracks BEFORE setting remote description
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
            console.log('Added track:', track.kind);
        });
        
        // Connection state monitoring
        peerConnection.onconnectionstatechange = () => {
            console.log('Streamer connection state:', peerConnection.connectionState);
        };
        
        peerConnection.oniceconnectionstatechange = () => {
            console.log('Streamer ICE connection state:', peerConnection.iceConnectionState);
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    targetId: viewerId,
                    streamId: currentStreamId
                });
            }
        };
        
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            socket.emit('answer', {
                answer: answer,
                viewerId: viewerId
            });
            
            peerConnections.set(viewerId, peerConnection);
            console.log('Streamer sent answer to viewer:', viewerId);
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    });
    
    socket.off('ice-candidate-streamer').on('ice-candidate-streamer', async (data) => {
        const peerConnection = peerConnections.get(data.senderId);
        if (peerConnection && data.candidate) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    });
}

// Load and display streams
async function loadStreams() {
    try {
        const response = await fetch('/api/streams');
        const streams = await response.json();
        displayStreams(streams);
    } catch (error) {
        console.error('Error loading streams:', error);
    }
}

function displayStreams(streams) {
    streamsList.innerHTML = '';
    
    if (streams.length === 0) {
        streamsList.innerHTML = '<p>No active streams at the moment.</p>';
        return;
    }
    
    streams.forEach(stream => {
        const streamCard = document.createElement('div');
        streamCard.className = 'stream-card';
        streamCard.innerHTML = `
            <h3>${stream.title}</h3>
            <p>Streamer: ${stream.streamer}</p>
            <p class="viewers">👁️ ${stream.viewers} viewers</p>
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
                <button class="btn btn-primary" style="width: 100%; margin-top: 5px;">Watch Live Stream</button>
            </div>
        `;
        streamCard.addEventListener('click', (e) => {
            // Don't trigger if clicking the button (it will bubble up)
            if (e.target.tagName !== 'BUTTON') {
                watchStream(stream);
            }
        });
        // Also add click handler to the button
        const button = streamCard.querySelector('button');
        if (button) {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                watchStream(stream);
            });
        }
        streamsList.appendChild(streamCard);
    });
}

// Watch a stream
async function watchStream(stream) {
    currentViewerStreamId = stream.id;
    document.getElementById('viewerStreamTitle').textContent = stream.title;
    document.getElementById('viewerStreamer').textContent = stream.streamer;
    viewerModal.style.display = 'block';
    
    socket.emit('join-stream', stream.id);
    
    // Setup WebRTC for viewer
    setupViewerWebRTC(stream.id);
}

function setupViewerWebRTC(streamId) {
    // Close existing connection if any
    if (viewerPeerConnection) {
        viewerPeerConnection.close();
    }
    
    viewerPeerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    });
    
    // Handle remote stream
    viewerPeerConnection.ontrack = (event) => {
        console.log('Viewer received track:', event.track.kind, event.track);
        console.log('Event streams:', event.streams);
        
        if (event.streams && event.streams.length > 0) {
            const stream = event.streams[0];
            remoteVideo.srcObject = stream;
            console.log('Set video srcObject, tracks:', stream.getTracks().map(t => `${t.kind} (${t.readyState})`));
            
            // Ensure video plays
            remoteVideo.play().catch(error => {
                console.error('Error playing video:', error);
                // Try again after a short delay
                setTimeout(() => {
                    remoteVideo.play().catch(err => console.error('Retry play failed:', err));
                }, 500);
            });
        } else if (event.track) {
            // Fallback: create a new stream from the track
            console.log('Creating stream from single track');
            if (!remoteVideo.srcObject) {
                const stream = new MediaStream();
                stream.addTrack(event.track);
                remoteVideo.srcObject = stream;
                remoteVideo.play().catch(error => {
                    console.error('Error playing video:', error);
                });
            } else {
                // Add track to existing stream
                remoteVideo.srcObject.addTrack(event.track);
            }
        }
    };
    
    // Connection state monitoring
    viewerPeerConnection.onconnectionstatechange = () => {
        console.log('Viewer connection state:', viewerPeerConnection.connectionState);
    };
    
    viewerPeerConnection.oniceconnectionstatechange = () => {
        console.log('Viewer ICE connection state:', viewerPeerConnection.iceConnectionState);
    };
    
    // Handle ICE candidates
    viewerPeerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                candidate: event.candidate,
                streamId: streamId
            });
        }
    };
    
    // Remove old listeners and set up new ones
    socket.off('answer-viewer');
    socket.off('ice-candidate-viewer');
    
    // Handle answer
    socket.on('answer-viewer', async (data) => {
        if (viewerPeerConnection && data.answer) {
            try {
                await viewerPeerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                console.log('Viewer set remote description');
            } catch (error) {
                console.error('Error setting remote description:', error);
            }
        }
    });
    
    // Handle ICE candidates from streamer
    socket.on('ice-candidate-viewer', async (data) => {
        if (viewerPeerConnection && data.candidate && data.senderId !== socket.id) {
            try {
                await viewerPeerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    });
    
    // Create and send offer
    viewerPeerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
    })
        .then(offer => {
            return viewerPeerConnection.setLocalDescription(offer);
        })
        .then(() => {
            socket.emit('offer', {
                offer: viewerPeerConnection.localDescription,
                streamId: streamId
            });
            console.log('Viewer sent offer');
        })
        .catch(error => {
            console.error('Error creating offer:', error);
        });
}

// Close viewer modal
document.querySelector('.close').addEventListener('click', () => {
    viewerModal.style.display = 'none';
    if (currentViewerStreamId) {
        socket.emit('leave-stream', currentViewerStreamId);
    }
    if (viewerPeerConnection) {
        viewerPeerConnection.close();
        viewerPeerConnection = null;
    }
    remoteVideo.srcObject = null;
    currentViewerStreamId = null;
});

window.onclick = (event) => {
    if (event.target === viewerModal) {
        viewerModal.style.display = 'none';
        if (currentViewerStreamId) {
            socket.emit('leave-stream', currentViewerStreamId);
        }
        if (viewerPeerConnection) {
            viewerPeerConnection.close();
            viewerPeerConnection = null;
        }
        remoteVideo.srcObject = null;
        currentViewerStreamId = null;
    }
};

// Chat functionality
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');

sendChatBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (message && currentViewerStreamId) {
        socket.emit('chat-message', {
            streamId: currentViewerStreamId,
            message: message,
            username: 'Viewer' // You can add username input
        });
        chatInput.value = '';
    }
}

socket.on('chat-message', (data) => {
    if (currentViewerStreamId) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.innerHTML = `
            <span class="username">${data.username}:</span>
            <span>${data.message}</span>
            <div class="timestamp">${new Date(data.timestamp).toLocaleTimeString()}</div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});

// Socket events
socket.on('viewer-count', (count) => {
    if (isStreaming) {
        document.getElementById('viewerCount').textContent = count;
    }
    if (currentViewerStreamId) {
        document.getElementById('viewerViewerCount').textContent = count;
    }
});

socket.on('new-stream', (stream) => {
    if (watchView.classList.contains('active')) {
        loadStreams();
    }
});

socket.on('stream-removed', (streamId) => {
    if (currentViewerStreamId === streamId) {
        viewerModal.style.display = 'none';
        alert('Stream has ended');
    }
    if (watchView.classList.contains('active')) {
        loadStreams();
    }
});

socket.on('stream-ended', () => {
    if (currentViewerStreamId) {
        viewerModal.style.display = 'none';
        alert('Stream has ended');
    }
});

// Refresh streams button
refreshStreamsBtn.addEventListener('click', loadStreams);

// Check permissions on page load
async function checkPermissions() {
    // Check HTTPS requirement first
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '[::1]';
    const isHTTPS = window.location.protocol === 'https:';
    const isHTTP = window.location.protocol === 'http:';
    
    const statusDiv = document.getElementById('permissionStatus');
    const messageDiv = document.getElementById('permissionMessage');
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (statusDiv && messageDiv) {
            statusDiv.style.display = 'block';
            statusDiv.className = 'permission-status error';
            messageDiv.textContent = 'Your browser does not support camera/microphone access. Please use a modern browser (Chrome, Firefox, Edge, or Safari).';
        }
        return;
    }
    
    // Check HTTPS requirement for Chrome/Edge when not on localhost
    if (isHTTP && !isLocalhost) {
        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
        const isEdge = /Edg/.test(navigator.userAgent);
        
        if ((isChrome || isEdge) && statusDiv && messageDiv) {
            statusDiv.style.display = 'block';
            statusDiv.className = 'permission-status error';
            messageDiv.innerHTML = '⚠️ <strong>HTTPS Required:</strong> Chrome/Edge require HTTPS for camera access on network IPs.<br><br>' +
                                   '💡 <strong>Solutions:</strong><br>' +
                                   '1. Use <a href="http://localhost:3000" style="color: #667eea; text-decoration: underline; font-weight: bold;">localhost:3000</a> instead<br>' +
                                   '2. Use Firefox browser (allows HTTP on local network)<br>' +
                                   '3. Set up HTTPS for your server';
        }
        return;
    }
    
    // Check if we can query permissions
    if (navigator.permissions && navigator.permissions.query) {
        try {
            const cameraPermission = await navigator.permissions.query({ name: 'camera' });
            const microphonePermission = await navigator.permissions.query({ name: 'microphone' });
            
            const statusDiv = document.getElementById('permissionStatus');
            const messageDiv = document.getElementById('permissionMessage');
            
            if (statusDiv && messageDiv) {
                if (cameraPermission.state === 'denied' || microphonePermission.state === 'denied') {
                    statusDiv.style.display = 'block';
                    statusDiv.className = 'permission-status error';
                    messageDiv.innerHTML = '⚠️ Camera/Microphone access is blocked. Please allow permissions in your browser settings and refresh the page.';
                } else if (cameraPermission.state === 'prompt' || microphonePermission.state === 'prompt') {
                    statusDiv.style.display = 'block';
                    statusDiv.className = 'permission-status';
                    messageDiv.innerHTML = 'ℹ️ Click "Start Streaming" to allow camera/microphone access.';
                }
            }
            
            // Listen for permission changes
            cameraPermission.onchange = () => checkPermissions();
            microphonePermission.onchange = () => checkPermissions();
        } catch (error) {
            // Permissions API not fully supported, that's okay
            console.log('Permissions API not fully supported');
        }
    }
}

// Check permissions when stream view is shown
streamBtn.addEventListener('click', () => {
    showView('streamView');
    setTimeout(checkPermissions, 100);
});

// Load streams on page load if on watch view
if (watchView.classList.contains('active')) {
    loadStreams();
}

// Initial permission check
checkPermissions();

