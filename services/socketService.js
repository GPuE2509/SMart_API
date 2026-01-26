const socketIo = require('socket.io');

let io;
const connectedClients = new Map(); // Map sessionId -> socket
const pendingMessages = new Map(); // Map sessionId -> array of pending messages

const initSocket = (server) => {
    io = socketIo(server, {
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:3000'],
            credentials: true,
            methods: ['GET', 'POST']
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });

    io.on('connection', (socket) => {
        console.log('🔌 New client connected:', socket.id);

        // Client gửi sessionId khi kết nối
        socket.on('register', (sessionId) => {
            connectedClients.set(sessionId, socket.id);
            socket.sessionId = sessionId;
            console.log('📝 Client registered with sessionId:', sessionId);

            // Send any pending messages for this session
            if (pendingMessages.has(sessionId)) {
                const messages = pendingMessages.get(sessionId);
                console.log(`📨 Sending ${messages.length} pending messages to session:`, sessionId);
                
                messages.forEach(({ event, data }) => {
                    io.to(socket.id).emit(event, data);
                });
                
                pendingMessages.delete(sessionId);
            }
        });

        socket.on('disconnect', () => {
            if (socket.sessionId) {
                connectedClients.delete(socket.sessionId);
                console.log('👋 Client disconnected:', socket.sessionId);
            }
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

// Send login verification notification to specific session
const sendLoginVerification = (sessionId, data) => {
    const socketId = connectedClients.get(sessionId);
    if (socketId) {
        io.to(socketId).emit('login-verification', data);
        console.log('✉️ Login verification sent to session:', sessionId);
        return true;
    }
    
    // Queue the message if client not connected yet
    console.log('⏳ Session not connected yet, queuing message:', sessionId);
    if (!pendingMessages.has(sessionId)) {
        pendingMessages.set(sessionId, []);
    }
    pendingMessages.get(sessionId).push({ event: 'login-verification', data });
    
    // Clear pending messages after 2 minutes
    setTimeout(() => {
        if (pendingMessages.has(sessionId)) {
            console.log('🗑️ Clearing expired pending messages for:', sessionId);
            pendingMessages.delete(sessionId);
        }
    }, 120000);
    
    return false;
};

// Send login approved notification
const sendLoginApproved = (sessionId, data) => {
    const socketId = connectedClients.get(sessionId);
    if (socketId) {
        io.to(socketId).emit('login-approved', data);
        console.log('✅ Login approved for session:', sessionId);
        return true;
    }
    
    // Queue the message
    console.log('⏳ Session not connected, queuing login-approved:', sessionId);
    if (!pendingMessages.has(sessionId)) {
        pendingMessages.set(sessionId, []);
    }
    pendingMessages.get(sessionId).push({ event: 'login-approved', data });
    
    return false;
};

// Send login denied notification
const sendLoginDenied = (sessionId, data) => {
    const socketId = connectedClients.get(sessionId);
    if (socketId) {
        io.to(socketId).emit('login-denied', data);
        console.log('❌ Login denied for session:', sessionId);
        return true;
    }
    
    // Queue the message
    console.log('⏳ Session not connected, queuing login-denied:', sessionId);
    if (!pendingMessages.has(sessionId)) {
        pendingMessages.set(sessionId, []);
    }
    pendingMessages.get(sessionId).push({ event: 'login-denied', data });
    
    return false;
};

module.exports = {
    initSocket,
    getIO,
    sendLoginVerification,
    sendLoginApproved,
    sendLoginDenied
};
