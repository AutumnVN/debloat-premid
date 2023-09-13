const { createServer } = require('http');
const { Server } = require('socket.io');
const { Client } = require('discord-rpc');

const server = createServer();
const io = new Server(server, {
    serveClient: false,
    allowEIO3: true,
    cors: { origin: '*' }
});

let rpcClients = [];

class RPCClient {
    clientId;
    currentPresence;
    client;
    clientReady = false;

    constructor(clientId) {
        rpcClients.push(this);

        this.clientId = clientId;
        this.client = new Client({ transport: 'ipc' });

        this.client.once('ready', () => {
            this.clientReady = true;
            this.setActivity();
        });

        this.client.once('disconnected', () => (
            rpcClients = rpcClients.filter(client => client.clientId !== this.clientId)
        ));

        this.client.login({ clientId: this.clientId }).catch(() => this.destroy());
    }

    setActivity(presenceData) {
        presenceData = presenceData ? presenceData : this.currentPresence;

        presenceData.presenceData.largeImageText = 'Debloat PreMiD v7.2.7';

        if (!this.clientReady || !presenceData) return;

        this.client.setActivity(presenceData.presenceData).catch(() => this.destroy());
    }

    clearActivity() {
        this.currentPresence = null;

        if (!this.clientReady) return;

        this.client.clearActivity().catch(() => this.destroy());
    }

    async destroy() {
        try {
            if (this.clientReady) {
                this.client.clearActivity();
                this.client.destroy();
            }

            rpcClients = rpcClients.filter(client => client.clientId !== this.clientId);
        } catch (err) {
            console.error(err);
        }
    }
}

server.listen(3020);
server.on('error', socketError);
io.on('connection', socketConnection);

function socketConnection(socket) {
    getDiscordUser()
        .then(user => socket.emit('discordUser', user))
        .catch(err => socket.emit('discordUser', null));

    socket.on('setActivity', setActivity);
    socket.on('clearActivity', clearActivity);
    socket.on('getVersion', () => socket.emit('receiveVersion', '2.2.0'.replace(/[\D]/g, '')));
    socket.once('disconnect', socketDisconnect);
}

async function getDiscordUser() {
    new Promise((resolve, reject) => {
        const client = new Client({ transport: 'ipc' });
        client.login({ clientId: '503557087041683458' })
            .then(({ user }) => {
                client.destroy().then(() => resolve(user))
            }).catch(err => reject(err));
    });
}

function setActivity(presence) {
    let client = rpcClients.find(client => client.clientId === presence.clientId);

    if (!client) {
        client = new RPCClient(presence.clientId);
        client.currentPresence = presence;
    } else client.setActivity(presence);
}

function clearActivity(clientId) {
    if (clientId) {
        let client = rpcClients.find(client => client.clientId === clientId);
        client.clearActivity();
    } else rpcClients.forEach(client => client.clearActivity());
}

function socketError(err) {
    console.error(err);
}

function socketDisconnect() {
    rpcClients.forEach(client => client.destroy());
}

process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);
