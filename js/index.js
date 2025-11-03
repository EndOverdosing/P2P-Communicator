document.addEventListener('DOMContentLoaded', () => {
    const ls = { get: (k, f) => { try { return localStorage.getItem(k) || f; } catch (e) { return f; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
    const ui = {
        mainContentWrapper: document.getElementById('main-content-wrapper'),
        setupSection: document.getElementById('setup-section'),
        callSection: document.getElementById('call-section'),
        myIdInput: document.getElementById('my-id'),
        usernameInput: document.getElementById('username-input'),
        remoteIdInput: document.getElementById('remote-id-input'),
        saveUsernameBtn: document.getElementById('save-username-btn'),
        renewIdBtn: document.getElementById('renew-id-btn'),
        copyIdBtn: document.getElementById('copy-id-btn'),
        joinBtn: document.getElementById('join-btn'),
        videoMain: document.getElementById('video-main'),
        videoGrid: document.getElementById('video-grid'),
        muteBtn: document.getElementById('mute-btn'),
        toggleVideoBtn: document.getElementById('toggle-video-btn'),
        shareScreenBtn: document.getElementById('share-screen-btn'),
        toggleChatBtn: document.getElementById('toggle-chat-btn'),
        chatSidebar: document.getElementById('chat-sidebar'),
        chatDragHandle: document.getElementById('chat-drag-handle'),
        stopCallBtn: document.getElementById('stop-call-btn'),
        messagesDiv: document.getElementById('messages'),
        messageForm: document.getElementById('message-form'),
        messageInput: document.getElementById('message-input'),
        statusDiv: document.getElementById('status'),
        pipContainer: document.getElementById('pip-container'),
    };

    let peer, dataConnection;
    let localStream = null;
    let mediaConnections = {};

    let peerMetadata = {};

    let state = { username: ls.get('username', 'User'), isMuted: false, isVideoEnabled: true, isScreenSharing: false };
    const log = (...args) => console.log('[P2P DEBUG]', ...args);

    const isMobile = () => window.innerWidth <= 768;
    const updateStatus = (message, type = 'info') => { ui.statusDiv.textContent = message; const c = { error: 'var(--error)', success: 'var(--success)' }; ui.statusDiv.style.color = c[type] || 'var(--secondary-text)'; };

    const showCallUI = (show) => {
        ui.mainContentWrapper.classList.toggle('hidden', show);
        ui.callSection.classList.toggle('hidden', !show);
        if (show && isMobile()) {
            ui.chatSidebar.style.transform = 'translateY(100%)';
            setupMobileChatDrag();
        }
    };

    const initializePeer = (forceNew = false) => {
        updateStatus('Initializing Peer...');
        if (peer) peer.destroy();
        const peerId = forceNew ? null : ls.get('myPeerId', null);
        peer = new Peer(peerId, {
            host: '0.peerjs.com',
            port: 443,
            path: '/',
            secure: true,
            config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }] }
        });
        peer.on('open', id => {
            ls.set('myPeerId', id);
            ui.myIdInput.value = id;
            updateStatus('Ready to connect.', 'success');
        });
        peer.on('connection', conn => setupDataConnection(conn, false));
        peer.on('call', call => {
            const handle = async () => {
                if (!localStream) {
                    await startMedia();
                }
                call.answer(localStream);
                setupMediaConnection(call);
            };
            handle().catch(err => log('Error handling incoming call:', err));
        });
        peer.on('disconnected', () => {
            updateStatus('Disconnected. Reconnecting...', 'error');
            if (!peer.destroyed) {
                setTimeout(() => peer.reconnect(), 3000);
            }
        });
        peer.on('close', () => {
            updateStatus('Connection closed.', 'error');
        });
        peer.on('error', err => {
            console.error("PeerJS Error:", err);
            updateStatus(`Error: ${err.type}`, 'error');
            if (err.type === 'unavailable-id') {
                updateStatus('ID is already taken. Renewing ID.', 'error');
                initializePeer(true);
            } else if (err.type === 'network') {
                updateStatus('Network connection to server lost.', 'error');
            }
        });
    };

    const connectToPeer = (remoteId) => {
        if (!remoteId || !peer || remoteId === peer.id) return updateStatus("Please enter a valid peer ID.", 'error');
        updateStatus(`Connecting to ${remoteId}...`);
        const conn = peer.connect(remoteId, { reliable: true });
        setupDataConnection(conn, true);
    };

    const setupDataConnection = (conn, amInitiator = false) => {
        if (!conn) {
            return updateStatus("Connection failed. Peer might be offline or ID is invalid.", "error");
        }
        dataConnection = conn;
        conn.on('open', async () => {
            updateStatus(`Connected!`, 'success');
            ui.messageInput.disabled = false;
            await startMedia();
            addVideoStream(peer.id, localStream, true, state.username);
            updateVideoState(peer.id, state.isVideoEnabled);
            showCallUI(true);
            const userData = { type: 'userData', username: state.username, isVideoEnabled: state.isVideoEnabled };
            if (amInitiator) {
                await new Promise(r => setTimeout(r, 500));
                const call = peer.call(conn.peer, localStream);
                setupMediaConnection(call);
            }
            conn.send(userData);
        });
        conn.on('data', data => handleData(data, conn.peer));
        conn.on('close', () => { removeVideoStream(conn.peer); updateStatus("Peer has disconnected.", "error"); });
        conn.on('error', err => {
            log('Data connection error:', err);
            updateStatus(`Connection error: ${err.type}`, 'error');
        });
    };

    const handleData = (data, peerId) => {
        const tile = document.querySelector(`[data-peer-id="${peerId}"]`);
        switch (data.type) {
            case 'chat':
                addMessageToUI(data.sender, data.text);
                break;
            case 'videoState':
                updateVideoState(peerId, data.enabled);
                break;
            case 'userData':
                peerMetadata[peerId] = { username: data.username };
                if (tile) {
                    tile.querySelector('.info-bar').textContent = data.username;
                    const avatar = tile.querySelector('.placeholder-avatar');
                    if (avatar) avatar.textContent = data.username.charAt(0).toUpperCase();
                }
                updateVideoState(peerId, data.isVideoEnabled);
                break;
        }
    };

    const setupMediaConnection = (call) => {
        const peerId = call.peer;
        mediaConnections[peerId] = call;
        const username = peerMetadata[peerId]?.username || peerId.slice(0, 6);
        call.on('stream', remoteStream => {
            addVideoStream(peerId, remoteStream, false, username);
            const tile = document.querySelector(`[data-peer-id="${peerId}"]`);
            if (tile && peerMetadata[peerId]) {
                tile.querySelector('.info-bar').textContent = peerMetadata[peerId].username;
                const avatar = tile.querySelector('.placeholder-avatar');
                if (avatar) avatar.textContent = peerMetadata[peerId].username.charAt(0).toUpperCase();
            }
        });
        call.on('close', () => removeVideoStream(peerId));
        call.on('error', err => log('Media call error with', peerId, ':', err));
    };

    const startMedia = async (forceVideo = state.isVideoEnabled) => {
        try {
            const constraints = { video: forceVideo, audio: { echoCancellation: true, noiseSuppression: true } };
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            if (localStream) localStream.getTracks().forEach(t => t.stop());
            localStream = newStream;
            if (localStream.getAudioTracks().length > 0) localStream.getAudioTracks()[0].enabled = !state.isMuted;
            const localTile = document.querySelector(`[data-peer-id="${peer.id}"] video`);
            if (localTile) localTile.srcObject = localStream;
            return localStream;
        } catch (err) {
            updateStatus('Could not access camera/mic.', 'error');
            if (forceVideo) return startMedia(false);
            throw err;
        }
    };

    const startScreenShare = async () => {
        if (isMobile()) {
            alert("Screen sharing is not supported on mobile devices.");
            return;
        }
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: "screen" },
                audio: { echoCancellation: true, noiseSuppression: true }
            });

            const screenVideoTrack = screenStream.getVideoTracks()[0];
            const screenAudioTrack = screenStream.getAudioTracks()[0];
            const micAudioTrack = localStream?.getAudioTracks()[0];
            const newStream = new MediaStream([screenVideoTrack]);

            if (screenAudioTrack) {
                newStream.addTrack(screenAudioTrack);
            } else if (micAudioTrack) {
                newStream.addTrack(micAudioTrack.clone());
            }

            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }

            localStream = newStream;
            replaceStream(localStream);
            state.isScreenSharing = true;
            ui.shareScreenBtn.classList.add('active');

            screenVideoTrack.onended = () => {
                state.isScreenSharing = false;
                ui.shareScreenBtn.classList.remove('active');
                localStream.getTracks().forEach(track => track.stop());
                startMedia().then(stream => {
                    localStream = stream;
                    replaceStream(stream);
                }).catch(err => log('Error restarting media after screen share:', err));
            };
        } catch (err) {
            log('Screen share failed:', err);
            updateStatus('Could not start screen share.', 'error');
        }
    };

    const replaceStream = (newStream) => {
        const localVideo = document.querySelector(`[data-peer-id="${peer.id}"] video`);
        if (localVideo) localVideo.srcObject = newStream;
        Object.values(mediaConnections).forEach(call => {
            const pc = call.peerConnection;
            if (!pc) return;
            pc.getSenders().forEach(sender => {
                const newTrack = newStream.getTracks().find(t => t.kind === sender.track.kind);
                if (newTrack) sender.replaceTrack(newTrack).catch(e => log(`Error replacing ${newTrack.kind} track:`, e));
            });
        });
    };

    const addVideoStream = (id, stream, isLocal, name) => {
        if (document.querySelector(`[data-peer-id="${id}"]`)) return;
        const tile = document.createElement('div');
        tile.className = 'participant-tile';
        tile.dataset.peerId = id;
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = isLocal;
        tile.innerHTML = `<div class="video-off-placeholder"><div class="placeholder-avatar">${name.charAt(0).toUpperCase()}</div></div><div class="info-bar">${name}</div>`;
        tile.prepend(video);
        ui.videoGrid.append(tile);
    };

    const updateVideoState = (peerId, isEnabled) => {
        const tile = document.querySelector(`[data-peer-id="${peerId}"]`);
        if (tile) tile.classList.toggle('video-off', !isEnabled);
    };

    const removeVideoStream = (id) => {
        const tile = document.querySelector(`[data-peer-id="${id}"]`);
        if (tile) tile.remove();
        delete mediaConnections[id];
    };

    const addMessageToUI = (sender, text) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';
        msgDiv.innerHTML = `
                    <div class="message-avatar">${sender.charAt(0).toUpperCase()}</div>
                    <div class="message-content">
                        <div class="header">
                            <span class="username">${sender}</span>
                            <span class="timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div class="text">${text}</div>
                    </div>`;
        ui.messagesDiv.appendChild(msgDiv);
        ui.messagesDiv.scrollTop = ui.messagesDiv.scrollHeight;
    };

    const sendMessage = () => {
        const text = ui.messageInput.value.trim();
        if (text && dataConnection?.open) {
            const msg = { type: 'chat', sender: state.username, text };
            dataConnection.send(msg);
            addMessageToUI(state.username, text);
            ui.messageInput.value = '';
        }
    };

    const setupMobileChatDrag = () => {
        let isDragging = false, startY, startTransform;
        let snapPoints = null;

        const initSnapPoints = () => {
            if (snapPoints) return;
            const chatHeight = ui.chatSidebar.offsetHeight;
            snapPoints = { open: 0, hidden: chatHeight };
        };

        const setChatPosition = (y, animate = true) => {
            initSnapPoints();
            ui.chatSidebar.style.transition = animate ? 'transform 0.4s ease' : 'none';
            const newY = Math.max(snapPoints.open, Math.min(snapPoints.hidden, y));
            ui.chatSidebar.style.transform = `translateY(${newY}px)`;
        };

        const getCurrentTransform = () => {
            const style = window.getComputedStyle(ui.chatSidebar);
            const matrix = new DOMMatrixReadOnly(style.transform);
            return matrix.m42;
        };

        window.toggleMobileChat = () => {
            initSnapPoints();
            const currentPos = getCurrentTransform();
            const isEffectivelyHidden = currentPos >= snapPoints.hidden - 1;
            const targetPos = isEffectivelyHidden ? snapPoints.open : snapPoints.hidden;
            setChatPosition(targetPos, true);
        };

        const dragStart = (e) => {
            initSnapPoints();
            isDragging = true;
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            startTransform = getCurrentTransform();
            ui.chatSidebar.classList.add('dragging');
            document.addEventListener('touchmove', dragMove, { passive: false });
            document.addEventListener('touchend', dragEnd);
        };

        const dragMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const currentY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaY = currentY - startY;
            setChatPosition(startTransform + deltaY, false);
        };

        const dragEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            ui.chatSidebar.classList.remove('dragging');
            const currentPos = getCurrentTransform();
            const midpoint = (snapPoints.open + snapPoints.hidden) / 2;
            const targetPos = currentPos < midpoint ? snapPoints.open : snapPoints.hidden;
            setChatPosition(targetPos, true);
            document.removeEventListener('touchmove', dragMove);
            document.removeEventListener('touchend', dragEnd);
        };

        ui.chatDragHandle.addEventListener('touchstart', dragStart);
    };

    const setupEventListeners = () => {
        ui.saveUsernameBtn.onclick = () => {
            state.username = ui.usernameInput.value.trim() || 'User';
            ls.set('username', state.username);

            const myTile = document.querySelector(`[data-peer-id="${peer.id}"]`);
            if (myTile) {
                myTile.querySelector('.info-bar').textContent = state.username;
                myTile.querySelector('.placeholder-avatar').textContent = state.username.charAt(0).toUpperCase();
            }

            if (dataConnection && dataConnection.open) {
                dataConnection.send({
                    type: 'userData',
                    username: state.username,
                    isVideoEnabled: state.isVideoEnabled
                });
            }
        };
        ui.copyIdBtn.onclick = () => { navigator.clipboard.writeText(ui.myIdInput.value); const icon = ui.copyIdBtn.innerHTML; ui.copyIdBtn.innerHTML = `<i class="fa-solid fa-check"></i>`; setTimeout(() => { ui.copyIdBtn.innerHTML = icon; }, 1500); };
        ui.usernameInput.addEventListener('keyup', e => e.key === 'Enter' && ui.saveUsernameBtn.click());
        ui.remoteIdInput.addEventListener('keyup', e => e.key === 'Enter' && ui.joinBtn.click());
        ui.renewIdBtn.onclick = () => initializePeer(true);
        ui.joinBtn.onclick = () => connectToPeer(ui.remoteIdInput.value.trim());
        ui.stopCallBtn.onclick = () => window.location.reload();
        ui.shareScreenBtn.onclick = () => { state.isScreenSharing ? window.location.reload() : startScreenShare(); };
        ui.muteBtn.onclick = () => {
            state.isMuted = !state.isMuted;
            if (localStream) localStream.getAudioTracks().forEach(track => track.enabled = !state.isMuted);
            ui.muteBtn.classList.toggle('danger', state.isMuted);
            ui.muteBtn.innerHTML = state.isMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
        };
        ui.toggleVideoBtn.onclick = async () => {
            state.isVideoEnabled = !state.isVideoEnabled;

            if (state.isVideoEnabled) {
                try {
                    const newStream = await startMedia(true);
                    replaceStream(newStream);
                } catch (err) {
                    log('Failed to enable video, reverting.', err);
                    state.isVideoEnabled = false;
                }
            } else {
                if (localStream) {
                    localStream.getVideoTracks().forEach(t => t.stop());
                }
                const newStream = await startMedia(false);
                replaceStream(newStream);
            }

            ui.toggleVideoBtn.classList.toggle('active', state.isVideoEnabled);
            ui.toggleVideoBtn.innerHTML = state.isVideoEnabled ? '<i class="fa-solid fa-video"></i>' : '<i class="fa-solid fa-video-slash"></i>'
            updateVideoState(peer.id, state.isVideoEnabled);
            if (dataConnection?.open) dataConnection.send({ type: 'videoState', enabled: state.isVideoEnabled });
        };
        ui.toggleChatBtn.onclick = () => {
            if (isMobile() && typeof window.toggleMobileChat === 'function') {
                window.toggleMobileChat();
            } else {
                ui.chatSidebar.classList.toggle('visible');
            }
        };
        ui.messageForm.onsubmit = e => { e.preventDefault(); sendMessage(); };
        ui.videoGrid.addEventListener('click', e => {
            const tile = e.target.closest('.participant-tile');
            if (!tile || state.isScreenSharing) return;

            const isAlreadyFocused = tile.classList.contains('focused');
            const isInFocusMode = ui.videoMain.classList.contains('focus-mode');
            const myTile = document.querySelector(`[data-peer-id="${peer.id}"]`);
            const pipTileInContainer = ui.pipContainer.querySelector('.participant-tile');

            document.querySelectorAll('.participant-tile').forEach(t => {
                t.classList.remove('focused', 'pip');
            });

            if (pipTileInContainer) {
                ui.videoGrid.appendChild(pipTileInContainer);
            }

            if (isInFocusMode && isAlreadyFocused) {
                ui.videoMain.classList.remove('focus-mode');
            } else {
                ui.videoMain.classList.add('focus-mode');
                tile.classList.add('focused');
                if (myTile && myTile !== tile) {
                    myTile.classList.add('pip');
                    ui.pipContainer.appendChild(myTile);
                }
            }
        });
    };

    setupEventListeners();
    ui.usernameInput.value = state.username;
    initializePeer();
});