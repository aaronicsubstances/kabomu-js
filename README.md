# Kabomu Library for NodeJS

This is a port of the Kabomu library originally written in C#.NET to the NodeJS platform.

In a nutshell, Kabomu enables building quasi web applications that can connect endpoints within localhost and even within an OS process, through IPC mechanisms other than TCP.

It is like [node-ipc](https://npmjs.com/package/node-ipc) but focuses on localhost,
easier transition to http, and ease of porting to other programming languages.

See the [repository for the .NET version](https://github.com/aaronicsubstances/cskabomu) for more details.

## Install

`npm install kabomu`

## Usage

The entry classes of the libary are [StandardQuasiHttpClient](https://github.com/aaronicsubstances/kabomu-js/blob/master/src/StandardQuasiHttpClient.ts) and [StandardQuasiHttpServer](https://github.com/aaronicsubstances/kabomu-js/blob/master/src/StandardQuasiHttpServer.ts).

See [Examples](https://github.com/aaronicsubstances/kabomu-js/tree/master/examples) folder for sample file serving programs. Each of those programs demonstrates an IPC mechanism as represented by main files named with "-client" or "-server" suffix. E.g. to run the TCP client example, run

```
node tcp-client.js
```

The sample programs come in pairs: a client program and corresponding server program. The server program must be started first. By default a client program uploads all files from a *logs/client* folder in the current directory, to a folder created in a *logs/server* folder of the server program's current directory.

The [.env-example](https://github.com/aaronicsubstances/kabomu-js/blob/master/examples/.env-example) config file indicates how to change the default client and server endpoints (TCP ports or paths), as well as the directories of upload and saving.