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
const inStream = new stream.PassThrough();
const rl = readline.createInterface({
    input: inStream,
});
const em = new Emitter();

function loop(port) {
    var state = null;

    function startedState() {
        const me = Object.assign({}, new Emitter());

        me.on('ok', () => {
            console.log('got ok');
        });
        return Object.assign(me, {
            enter: function() {
                port.write('AT\r');
            },
        });
    }

    state = startedState();
    state.enter();

    em.on('ok', () => {
        if (state) state.emit('ok');
    });
}

rl.on('line', line => {
    if (argv.verbose) console.log(Buffer.from(line));
    if (line == 'OK')
        em.emit('ok');
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
