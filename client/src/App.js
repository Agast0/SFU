import {useEffect, useRef, useState} from 'react';
import {socket} from './socket';
import Button from '@mui/material/Button';

function App() {
    const [users, setUsers] = useState([]);
    const [userJoined, setUserJoined] = useState(false);
    const localVideo = useRef({});
    const remoteVideos = useRef([]);

    useEffect(() => {
        socket.on('updateRoom', (users, userId) => {
            setUsers(users);
            console.log('users: updateRoom')
            console.log(users);

            initReceiveIndividual(userId);
        })

        socket.on('userLeft', (userId) => {
            console.log('users: userLeft')
            console.log(users)

            let index;

            for (let i = 0; i < remoteVideos.current.length; i++) {
                if (remoteVideos.current[i].id === userId) {
                    index = i;
                }
            }

            remoteVideos.current.splice(index, 1);
            console.log('remotevideos')
            console.log(remoteVideos.current)

            let tempUsers = users;
            index = tempUsers.indexOf(userId);
            tempUsers.splice(index, 1);
            setUsers(tempUsers);
        })
    }, []);

    async function initReceiveIndividual(userId) {
        const peer = createReceivePeer(userId);

        peer.addTransceiver("video", {direction: 'recvonly'});
        peer.addTransceiver("audio", {direction: 'recvonly'});
    }

    function createReceivePeer(user) {
        const peer = new RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302"
                }
            ]
        });

        peer.ontrack = (e) => handleTrackEvent(e, user);
        peer.onnegotiationneeded = () => handleNegotiationNeededEventReceiveVids(peer, user);

        return peer;
    }

    async function initReceive() {
        const peers = createReceivePeers();

        for (let i = 0; i < peers.length; i++) {
            peers[i].addTransceiver("video", {direction: 'recvonly'});
            peers[i].addTransceiver("audio", {direction: 'recvonly'});
        }
    }

    function createReceivePeers() {
        let peers = []

        for (let i = 0; i < users.length; i++) {

            if (users[i] != socket.id) {
                const peer = new RTCPeerConnection({
                    iceServers: [
                        {
                            urls: "stun:stun.l.google.com:19302"
                        }
                    ]
                });

                peer.ontrack = (e) => handleTrackEvent(e, users[i]);
                peer.onnegotiationneeded = () => handleNegotiationNeededEventReceiveVids(peer, users[i]);

                peers.push(peer);
            }
        }

        return peers;
    }

    async function handleNegotiationNeededEventReceiveVids(peer, targetId) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        const payload = {
            target: targetId,
            sdp: peer.localDescription
        }

        socket.emit('receiveStream', payload, (returnPayload) => {
            const desc = new RTCSessionDescription(returnPayload.sdp);
            peer.setRemoteDescription(desc).catch(e => console.log(e));
        });
    }

    function handleTrackEvent(e, videoId) {
        let exists = false;

        for (let i = 0; i < remoteVideos.current.length; i++) {
            if (remoteVideos.current[i].id === videoId) {
                exists = true;
                remoteVideos.current[i].video.srcObject = e.streams[0];
            }
        }

        if (!exists && videoId !== socket.id) {
            let video = new MediaStream;
            video.srcObject = e.streams[0];
            let data = {
                video: video,
                id: videoId,
            }
            remoteVideos.current.push(data);
            console.log(remoteVideos)
        }
    }

    async function init() {
        const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true,});
        localVideo.current.srcObject = stream;

        setUserJoined(true);
        const peer = createPeer();
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    }

    function createPeer() {
        const peer = new RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302"
                }
            ]
        });

        peer.onnegotiationneeded = () => handleNegotiationNeededEvent(peer);

        return peer;
    }

    async function handleNegotiationNeededEvent(peer) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        const payload = {
            sdp: peer.localDescription,
        };

        socket.emit('sendStream', payload, (returnPayload) => {
            const desc = new RTCSessionDescription(returnPayload.sdp);
            peer.setRemoteDescription(desc).catch(e => console.log(e));
        });
    }

    return (
        <div>
            {userJoined ? (
                <video autoPlay ref={localVideo} />
            ) : (
                <div>Join call!</div>
            )}

            {remoteVideos.current.map((remoteVideo) => (
                // <video autoPlay ref={remoteVideo.video} key={remoteVideo.id} />
                <div>dj</div>
            ))}

            <Button
                onClick={() => {
                    init();
                    initReceive();
                }}
                variant={"contained"}
            >
                Join Room
            </Button>
        </div>
    );
}

export default App;
