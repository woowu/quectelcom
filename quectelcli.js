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
            state = waitRssiState().enter();
        });
        return Object.assign(me, {
            enter: function() {
                port.write('at\r');
                return this;
            },
        });
    }
    function waitRssiState() {
        const me = new Emitter();

        me.on('csq', rssi => {
            console.log('rssi', rssi);
            if (rssi >= 8) {
                state = checkSockStatusState().enter();
                return;
            }
            setTimeout(() => {
                port.write('at+csq\r');
            }, 1000);
        });
        return Object.assign(me, {
            enter: function() {
                port.write('at+csq\r');
                return this;
            },
        });
    }
    function checkSockStatusState() {
        const me = new Emitter();

        me.on('sock-state', (id, info) => {
            if (id != cid) return;
            const state = +info[4];
            if (! state || state == 4)
                state = connectingState().enter();
            else
                state = closingState().enter();
        });
        return Object.assign(me, {
            enter: function() {
                port.write(`at+qistate=,${cid}\r`);
                return this;
            },
        });
    }
    function closingState() {
        const me = new Emitter();
        var timer = null;

        const next = () => {
            state = connectingState().enter();
        };

        me.on('sock-closed', id => {
            if (timer) clearTimeout(timer);
            if (id == cid) next();
        });
        me.on('sock-error', (id, err) => {
            if (timer) clearTimeout(timer);
            if (id == cid) next();
        });
        return Object.assign(me, {
            enter: function() {
                port.write(`at+qiclose=${cid}\r`);
                timer = setTimeout(() => {
                    timer = null;
                    console.log('closing timeout');
                    next();
                }, 3000);
                return this;
            },
        });
    }
    function connectingState() {
        const me = new Emitter();

        me.on('sock-opened', id => {
            if (id == cid) state = connectedState(id).enter();
        });
        return Object.assign(me, {
            enter: function() {
                console.log('connecting server');
                port.write(`at+qiopen=${context},${cid},"TCP","${serverIp}",${serverPort},0,0\r`);
                return this;
            },
        });
    }
    function connectedState(id) {
        const me = new Emitter();

        me.on('sock-data', _id => {
            if (_id != id) return;
            console.log(`conn ${id} recved data.`);
            port.write(`at+qird=${id},1500\r`);
        });
        return Object.assign(me, {
            enter: function() {
                console.log(`conn ${id} opened`);
                return this;
            },
        });
    }

    var state = startedState().enter();
    em.on('ok', function() {
        if (state) state.emit('ok', ...arguments);
    });
    em.on('sock-opened', function() {
        if (state) state.emit('sock-opened', ...arguments);
    });
    em.on('sock-closed', function() {
        if (state) state.emit('sock-closed', ...arguments);
    });
    em.on('sock-state', function() {
        if (state) state.emit('sock-state', ...arguments);
    });
    em.on('sock-data', function() {
        if (state) state.emit('sock-data', ...arguments);
    });
    em.on('csq', function() {
        if (state) state.emit('csq', ...arguments);
    });
}

rl.on('line', line => {
    var info;
    var cid;

    if (! line.trim().length) return;
    if (argv.verbose) console.log('< ' + line);

    if (! line.search(/OK/)) {
        em.emit('ok');
        return;
    }
    if (! line.search(/ERROR/)) {
        em.emit('error');
        return;
    }
    if (! line.search(/\+QIOPEN: /)) {
        info = line.slice(9).split(',');
        cid = +info[0];
        if (+info[1] == 0) {
            em.emit('sock-opened', cid)
            return;
        }
        if (+info[1] == 567) {
            em.emit('sock-closed', cid)
            return;
        }
        em.emit('sock-error', cid, +info[1]);
    }
    if (! line.search(/\+QISTATE: /)) {
        info = line.slice(10).split(,);
        em.emit('sock-state', +info[0], info.slice(1));
    }
    if (! line.search(/\+QIURC: "recv",/)) {
        em.emit('sock-data', +line.slice(15))
        return;
    }
    if (! line.search(/\+csq: /)) {
        info = line.slice(6).split(',');
        em.emit('csq', +info[0], +info[1])
        return;
    }
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
