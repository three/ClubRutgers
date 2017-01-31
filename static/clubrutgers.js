var Container = PIXI.Container,
    loader = PIXI.loader,
    resources = PIXI.loader.resources,
    Sprite = PIXI.Sprite;

var renderer, stage;
var player, others, background, chats;
var socket;

var run = true;

function init() {

    // Create Renderer
    renderer = PIXI.autoDetectRenderer(1024,512);
    $("#game-container").append(renderer.view);
    renderer.backgroundColor = 0xFFFFFF;

    // Stage for seals
    stage = new PIXI.Container();
    renderer.render(stage);

    PIXI.loader
        .add(["seal.png","floor.png","hill.png"])
        .load(setup);

    // Chat System
    $("#chatbox").on("keypress", (e) => {
        if ( e.keyCode == 13 ) {
            var txt = $(e.target).val();
            socket.emit("talk",{
                chat: txt,
                x: player.position.x,
                y: player.position.y});
            $(e.target).val("");
        }
    });
}

function setup() {
    player = new PIXI.Sprite(
        PIXI.loader.resources["seal.png"].texture
    );
    player.tx = 50; // Target position
    player.ty = 50;
    player.scale.set(.1);
    player.position.set(50,50);
    player.pivot.set(400,400);
    player.visible = false;

    background = new PIXI.Sprite(
        PIXI.loader.resources["hill.png"].texture
    );
    background.width = 1024;
    background.height = 512;

    background.interactive = true;
    background.on("pointerdown", (e) => {
        var x = e.data.global.x,
            y = e.data.global.y;

        player.tx = x;
        player.ty = y;

        socket.emit("pos", {
            posx: player.position.x,
            posy: player.position.y,
            tarx: player.tx,
            tary: player.ty,
        });
    });

    // Multiplayer (limit 20 players)
    others = [];
    for (var i=0;i<20;i++) {
        others[i] = new PIXI.Sprite(
            PIXI.loader.resources["seal.png"].texture
        );
        others[i].tx = 0; others[i].ty = 0;
        others[i].scale.set(.1);
        others[i].pivot.set(400,400)
        others[i].visible = false;
    }

    // Chat Text
    chats = [];
    for (var i=0;i<20;i++) {
        chats[i] = new PIXI.Text("",{
            fontSize: 10,
            stroke: "#FFFFFF",
            fill: "#000000",
            strokeThickness: 3,
        })
        chats[i].visible = false;
        chats[i].stopTime = 0;
    }


    // PIXI doesn't provide methods to change the z-index (for
    // performance reasons) so we must keep track of element ordering.
    stage.addChild(background);
    for (var i=0;i<20;i++)
        stage.addChild(others[i]);
    stage.addChild(player);
    for (var i=0;i<20;i++)
        stage.addChild(chats[i]);

    renderer.render(stage);

    gameLoop();

    // Setup Multiplayer
    socket = io(document.location.origin, {
        transports: ["websocket"]
    });
    socket.on("activate", (data) => {
        console.log(data);
        player.position.set(data.posx,data.posy);
        player.tx = data.tarx; player.ty = data.tary;

        var lobby = data.others;
        // Cold update
        for (var i=0;i<20;i++) {
            if ( lobby[i].active ) {
                others[i].visible = true;
                others[i].position.set(lobby[i].tarx,lobby[i].tary);
                others[i].tx = lobby[i].tarx;
                others[i].ty = lobby[i].tary;
            }
        }
    });
    socket.on("update", (data) => {
        console.log("Hot update");
        for (var i=0;i<20;i++) {
            if ( data[i].active ) {
                others[i].visible = true;
                if ( data[i].hot ) {
                    others[i].position.set(data[i].posx,data[i].posy);
                    others[i].tx = data[i].tarx;
                    others[i].ty = data[i].tary;
                    if ( data[i].chat !== "" ) {
                        chats[i].text = data[i].chat;
                        chats[i].stopTime = data[i].stopchat;
                    }
                }
            } else {
                others[i].visible = false;
            }
        }
    });
}

function gameLoop() {
    if (!run)
        return;
    requestAnimationFrame(gameLoop);

    // Move player closer to position
    var ox = player.tx-player.x,
        oy = player.ty-player.y,
        ds = Math.sqrt(ox*ox+oy*oy);
    if (ds > 3 ) {
        player.x = player.x + ox/ds;
        player.y = player.y + oy/ds;
    }

    // Move other players closer to position
    for (var i=0;i<20;i++) {
        //if (!others[i].visible)
        //    continue;
        var ox = others[i].tx-others[i].x,
            oy = others[i].ty-others[i].y,
            ds = Math.sqrt(ox*ox+oy*oy);
        if (ds > 3 ) {
            others[i].x = others[i].x + ox/ds;
            others[i].y = others[i].y + oy/ds;
        }
    }

    // Move chats to player position
    for (var i=0;i<20;i++) {
        if (chats[i].visible) {
            chats[i].position.set(others[i].position.x,others[i].position.y);
        }
    }

    // Update chats
    var time = (new Date()).getTime();
    for (var i=0;i<20;i++) {
        if ( chats[i].stopTime > time ) {
            chats[i].visible = true;
            chats[i].x = others[i].position.x;
            chats[i].y = others[i].position.y;
        } else {
            chats[i].visible = false;
        }
    }

    renderer.render(stage);
}

window.addEventListener("load",init);
