const express = require('express');
const app = express();
const webrtc = require('wrtc');
const http = require('http');
const server = http.createServer(app);
const io= require('socket.io')(server, {
    cors: {
        origin: '*',
    }
});

let streams = [];

io.on('connection', (socket) => {
    console.log(`\n${socket.id} connected to server`);

    socket.on('sendStream', async (payload, callback) => {
        console.log(`Received sendStream from ${socket.id}`)
        let exists = false;

        for (let i = 0; i < streams.length; i++) {
            if (streams[i].id === socket.id) {
                exists = true;
            }
        }

        if (!exists) {
            const peer = new webrtc.RTCPeerConnection({
                iceServers: [
                    {
                        urls: "stun:stun.l.google.com:19302"
                    }
                ]
            });

            peer.ontrack = (e) => handleTrackEvent(e, socket.id);

            const desc = new webrtc.RTCSessionDescription(payload.sdp);
            await peer.setRemoteDescription(desc);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            const returnPayload = {
                sdp: peer.localDescription
            }

            let users = [];

            for (let i = 0; i < streams.length; i++ ){
                users.push(streams[i].id);
            }

            io.emit('updateRoom', users, socket.id);
            console.log(`Sending updateRoom to all`)

            callback(returnPayload);
        }
    })

    socket.on('receiveStream', async (payload, callback) => {
        console.log(`Received receiveStream from ${socket.id}`)

        for (let i = 0; i < streams.length; i++) {
            if (streams[i].id === payload.target) {
                const peer = new webrtc.RTCPeerConnection({
                    iceServers: [
                        {
                            urls: "stun:stun.l.google.com:19302"
                        }
                    ]
                });

                const desc = new webrtc.RTCSessionDescription(payload.sdp);
                await peer.setRemoteDescription(desc);
                streams[i].stream.getTracks().forEach((track) => peer.addTrack(track, streams[i].stream));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);

                let returnPayload = {
                    sdp: peer.localDescription
                }

                callback(returnPayload);
            }
        }
    })

    socket.on('disconnect', () => {
        io.emit('userLeft', socket.id);
        console.log(`Sending userLeft(${socket.id}) to all`)

        let index;

        for (let i = 0; i < streams.length; i++) {
            if (streams[i].id === socket.id) {
                index = i;
            }
        }

        streams.splice(index, 1);

        console.log(`\n${socket.id} left the server`)
        console.log('Users in the call are now: ')
        console.log(streams)
    })
});

function handleTrackEvent(e, socketId) {
    let exists = false;

    for (let i = 0; i < streams.length; i++) {
        if (streams[i].id === socketId) {
            streams[i].stream = e.streams[0];
            exists = true;
            break;
        }
    }

    if (!exists) {
        streams.push({id: socketId, stream: e.streams[0]})
    }

    console.log(`\nUsers in the call are now: `)
    console.log(streams);
}

server.listen(5000, () => {
    console.log('server started on port 5000');
})