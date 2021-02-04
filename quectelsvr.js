#!/usr/bin/node --harmony
'use strict';

const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const net = require('net');

const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')

    .number('port')
    .alias('p', 'port')
    .describe('p', 'tcp port to listen')

    .number('intvl')
    .alias('i', 'intvl')
    .describe('i', 'data sending interval')

    .demandOption(['p'])
    .help('h')
    .epilog('copyright 2021')
    .argv;

const port = argv.port;
const intvl = argv.intvl;

function talkClient(socket) {
    var stopped = false;
    var timer = null;
    var clientId = null;

    function next() {
        send();
        if (! stopped) timer = setTimeout(next, intvl * 1000);
    }

    const stop = () => {
        stopped = true;
        clearTimeout(timer);
    };
    const send = () => {
        var chunk = '';

        /* make 300 octets */
        for (var j = 0; j < 3; ++j) {
            for (var i = 0; i < 9; ++i)
                chunk = chunk + 'hellohell' + i;
        }
        socket.write(chunk);
    };

    clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`new connection from: ${clientId}`);
    socket.on('data', chunk => {
        console.log(`data received from client ${clientId}:`, chunk);
    });
    socket.on('end', () => {
        stop();
        console.log(`connection ${clientId} closed`);
    });
    socket.on('error', err => {
        stop();
        console.error(`client ${clientId} error`, err.message);
    });
    next();
}

const server = new net.Server();
server.listen(port, () => {
    console.log('listening on tcp port ' + port);
});
server.on('connection', talkClient);
