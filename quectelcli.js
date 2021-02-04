#!/usr/bin/node --harmony
'use strict';
const stream = require('stream');
const readline = require('readline');
const Emitter = require('events').EventEmitter;
const util = require('util');

const serialport = require('serialport');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]')

    .alias('d', 'device')
    .describe('d', 'serial device')

    .number('baud')
    .alias('b', 'baud')
    .default('b', 115200)
    .describe('b', 'baudrate')

    .count('verbose')
    .alias('v', 'verbose')

    .demandOption(['d', 'b'])
    .help('h')
    .epilog('copyright 2021')
    .argv;

const baud = argv.baud;
const context = 1;  /* context id */
const cid = 5;      /* connection id */
const serverIp = "116.6.51.98"
const serverPort = 9006;
const inStream = new stream.PassThrough();
const rl = readline.createInterface({
    input: inStream,
});
const em = new Emitter();

function loop(port) {

    function startedState() {
        const me = new Emitter();

        me.on('ok', () => {
            console.log('modem connected');
            state = connectingState().enter();
        });
        return Object.assign(me, {
            enter: function() {
                port.write('AT\r');
                return this;
            },
        });
    }
    function connectingState() {
        const me = new Emitter();

        me.on('sock-opened', id => {
            if (id != cid) return;
            console.log(`conn ${id} opened`);
            state = connectedState().enter();
        });
        return Object.assign(me, {
            enter: function() {
                port.write(`at+qiopen=${context},${cid},"TCP","${serverIp}",${serverPort},0,0\r`);
                return this;
            },
        });
    }
    function connectedState() {
        const me = new Emitter();

        me.on('sock-data', id => {
            console.log(`conn ${id} recved data.`);
        });
        return Object.assign(me, {
            enter: function() {
                port.write('at+qiopen=1,5,"TCP","116.6.51.98",9006,0,0\r');
                return this;
            },
        });
    }

    var state = startedState().enter();
    em.on('ok', () => {
        if (state) state.emit('ok');
    });
}

rl.on('line', line => {
    if (argv.verbose) console.log(Buffer.from(line));
    if (line == 'OK') {
        em.emit('ok');
        return;
    }
    if (! line.search('+QIOPEN: ')) {
        const info = line.slice(9).split(',');
        if (+info[1] == 0) {
            em.emit('sock-opened', +info[0])
            return;
        }
    }
    if (! line.search('+QIURC: "recv",')) {
        em.emit('sock-data', +line.slice(15))
        return;
    }
    console.log(line);
});

const port = new serialport(argv.device, {
    baudRate: baud,
}, err => {
    if (err) {
        console.error(err.message);
        process.exit(0);
    }
    loop(port);
});
port.on('data', data => {
    inStream.write(data);
});
