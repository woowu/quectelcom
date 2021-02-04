#!/usr/bin/node --harmony
'use strict';
const stream = require('stream');
const readline = require('readline');
const Emitter = require('events').EventEmitter;

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
    port.write('AT\r');
}

rl.on('line', line => {
    if (line == 'OK\r')
        console.log('OK');
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
