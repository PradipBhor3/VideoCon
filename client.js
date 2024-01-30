// client.js

const socket = io();

let localStream;
let localProducer;
const remoteProducers = {};

async function init() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById('localVideo').srcObject = stream;
  localStream = stream;

  const { id, iceParameters, iceCandidates } = await createProducerTransport();
  await connectProducerTransport(id, iceParameters);
  await produce(id, localStream);
}

init();

async function createProducerTransport() {
  return new Promise((resolve) => {
    socket.emit('createProducerTransport', {}, (data) => {
      resolve(data);
    });
  });
}

async function connectProducerTransport(transportId, dtlsParameters) {
  return new Promise((resolve) => {
    socket.emit('connectProducerTransport', { transportId, dtlsParameters }, () => {
      resolve();
    });
  });
}

async function produce(transportId, stream) {
  const track = stream.getTracks()[0];
  const params = { track };

  return new Promise((resolve) => {
    socket.emit('produce', { kind: track.kind, rtpParameters: params }, (data) => {
      localProducer = data.id;
      resolve();
    });
  });
}

socket.on('newConsumer', async (data) => {
  const { id, producerId, kind, rtpParameters, iceParameters, iceCandidates } = data;

  const transportId = await createConsumerTransport();
  await connectConsumerTransport(transportId, iceParameters);

  const remoteVideo = document.createElement('video');
  document.getElementById('remoteVideos').appendChild(remoteVideo);

  const consumer = await consume({
    consumerTransportId: transportId,
    producerId,
    rtpCapabilities: rtpParameters,
  });

  remoteProducers[id] = consumer;

  remoteVideo.srcObject = new MediaStream([consumer.track]);
  remoteVideo.play();
});

async function createConsumerTransport() {
  return new Promise((resolve) => {
    socket.emit('createConsumerTransport', {}, (data) => {
      resolve(data.id);
    });
  });
}

async function connectConsumerTransport(transportId, dtlsParameters) {
  return new Promise((resolve) => {
    socket.emit('connectConsumerTransport', { transportId, dtlsParameters }, () => {
      resolve();
    });
  });
}

async function consume({ consumerTransportId, producerId, rtpCapabilities }) {
  return new Promise((resolve) => {
    socket.emit('consume', { consumerTransportId, producerId, rtpCapabilities }, (data) => {
      resolve(data);
    });
  });
}
