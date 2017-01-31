const http = require("http");
const path = require("path");
const express = require("express");
const socketio = require("socket.io");

var app, server, io;

var lobby;

function init() {
    // Setup Lobby
    lobby = [];
    for (var i=0;i<20;i++)
        lobby[i] = {
            id: i,
            active: false,
            hot: false,
            posx: 0, posy: 0,
            tarx: 0, tary: 0,
            chat: "", stopchat: 0,
            sio: null,
        }

    // Express Server
    app = express();
    app.set("port", 8080);
    // Serve Static directory
    app.use(express.static(path.join(__dirname,"static")));

    // Server/Socketio
    server = http.Server(app);
    io = socketio(server);

    io.on("connection", handleSocketConnection);

    server.listen(8080);
}

function handleSocketConnection(socket) {
    // Find space in the lobby for our player
    var playerid = 0;
    while (lobby[playerid++].active) {
        if (playerid > 20) {
            socket.close(); // Not enough room
            console.log("Lobby full, turned player away.");
            return;
        }
    }
    playerid--;
    var player = lobby[playerid];

    // Events
    socket.on("pos", (data) => {
        player.posx = data.posx;
        player.posy = data.posy;
        player.tarx = data.tarx;
        player.tary = data.tary;
        player.hot = true;
        console.log("Position Change", playerid, data);

        updatePlayers();
    });

    socket.on("talk", (data) => {
        console.log("chat", playerid, data.chat);
        player.chat = data.chat;
        player.stopchat = (new Date()).getTime()+2500;
        player.hot = true;
        player.posx = data.x;
        player.posy = data.y;

        updatePlayers();
    });

    socket.on("disconnect", (data) => {
        player.hot = true;
        player.active = false;
    });

    // Set up player
    player.active = true;
    player.posx = 50;
    player.posy = 50;
    player.tarx = 50;
    player.tary = 50;
    player.sio = socket;

    // Log everything
    console.log("New Player:", playerid);

    // Tell client their id
    socket.emit("activate",{
        active: true,
        posx: player.posx,
        posy: player.posy,
        tarx: player.tarx,
        tary: player.tary,
        others: updateData(),
    });
}

function updateData() {
    var update = [];
    for (var i=0;i<20;i++) {
        update[i] = {
            active: lobby[i].active,
            hot: lobby[i].hot,
            posx: lobby[i].posx,
            posy: lobby[i].posy,
            tarx: lobby[i].tarx,
            tary: lobby[i].tary,
            chat: lobby[i].chat,
            stopchat: lobby[i].stopchat,
        };
        lobby[i].hot = false;
    }
    return update;
}

function updatePlayers() {
    var update = updateData();

    // socketio lobbys might work better?
    for (var i=0;i<20;i++) {
        if (lobby[i].active)
            lobby[i].sio.emit("update",update);
    }
}

init();
