// server.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mediasoup = require('mediasoup');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let worker;
let router;
let producerTransport;
let consumers = [];

async function startMediasoup() {
  worker = await mediasoup.createWorker();
  router = await worker.createRouter({ mediaCodecs: mediasoup.defaultRouterOptions.mediaCodecs });
}

startMediasoup();

io.on('connection', (socket) => {
  // Handle new connection

  socket.on('createProducerTransport', async (data, callback) => {
    producerTransport = await router.createWebRtcTransport(mediasoup.defaultWebRtcTransportOptions);
    callback({ id: producerTransport.id, iceParameters: producerTransport.iceParameters, iceCandidates: producerTransport.iceCandidates });
  });

  socket.on('connectProducerTransport', async ({ transportId, dtlsParameters }, callback) => {
    await producerTransport.connect({ dtlsParameters });
    callback();
  });

  socket.on('produce', async ({ kind, rtpParameters, appData }, callback) => {
    const producer = await producerTransport.produce({ kind, rtpParameters, appData });
    callback({ id: producer.id });
  });

  socket.on('consume', async ({ consumerTransportId, producerId, rtpCapabilities }, callback) => {
    const consumerTransport = await router.createWebRtcTransport(mediasoup.defaultWebRtcTransportOptions);
    consumers.push(consumerTransport);

    await consumerTransport.connect({ dtlsParameters: consumerTransport.dtlsParameters });
    const consumer = await consumerTransport.consume({ producerId, rtpCapabilities });

    callback({
      id: consumer.id,
      producerId: producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      iceParameters: consumerTransport.iceParameters,
      iceCandidates: consumerTransport.iceCandidates,
    });
  });

  socket.on('connectConsumerTransport', async ({ transportId, dtlsParameters }, callback) => {
    const consumerTransport = consumers.find((transport) => transport.id === transportId);
    if (!consumerTransport) return;

    await consumerTransport.connect({ dtlsParameters });
    callback();
  });

  socket.on('disconnect', () => {
    // Handle disconnection
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
