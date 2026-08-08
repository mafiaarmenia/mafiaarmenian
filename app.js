let currentRoom = null;
let currentPlayerId = null;
let isHost = false;


// ==========================
// SCREEN SYSTEM
// ==========================

function showScreen(id) {

    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });

    document.getElementById(id).classList.add("active");
}


function goHome() {
    showScreen("homeScreen");
}


function showCreate() {

    document.getElementById("createError").textContent = "";

    showScreen("createScreen");
}


function showJoin() {

    document.getElementById("joinError").textContent = "";

    showScreen("joinScreen");
}


// ==========================
// ROOM CODE
// ==========================

function generateRoomCode() {

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {
        code += chars.charAt(
            Math.floor(Math.random() * chars.length)
        );
    }

    return code;
}


// ==========================
// PLAYER ID
// ==========================

function generatePlayerId() {

    return "player_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 8);
}


// ==========================
// CREATE GAME
// ==========================

async function createGame() {

    const nameInput =
        document.getElementById("hostName");

    const error =
        document.getElementById("createError");

    const name =
        nameInput.value.trim();

    if (!name) {

        error.textContent =
            "Գրիր քո անունը։";

        return;
    }


    if (!window.database) {

        error.textContent =
            "Firebase-ը միացված չէ։";

        return;
    }


    error.textContent = "Ստեղծվում է խաղ...";


    try {

        let roomCode;
        let roomExists = true;


        while (roomExists) {

            roomCode = generateRoomCode();

            const roomRef =
                window.dbRef(
                    window.database,
                    "rooms/" + roomCode
                );

            const snapshot =
                await window.dbGet(roomRef);

            roomExists = snapshot.exists();
        }


        currentRoom = roomCode;

        currentPlayerId =
            generatePlayerId();

        isHost = true;


        const player = {

            id: currentPlayerId,

            name: name,

            isHost: true,

            joinedAt: Date.now()

        };


        const room = {

            code: roomCode,

            hostId: currentPlayerId,

            status: "waiting",

            createdAt: Date.now(),

            players: {

                [currentPlayerId]: player

            }

        };


        const roomRef =
            window.dbRef(
                window.database,
                "rooms/" + roomCode
            );


        await window.dbSet(
            roomRef,
            room
        );


        openLobby();

        listenToRoom();

        console.log(
            "🎮 Խաղը ստեղծվեց:",
            roomCode
        );


    } catch (errorObject) {

        console.error(errorObject);

        error.textContent =
            "Չհաջողվեց ստեղծել խաղ։";

    }

}


// ==========================
// JOIN GAME
// ==========================

async function joinGame() {

    const nameInput =
        document.getElementById("playerName");

    const codeInput =
        document.getElementById("roomCode");

    const error =
        document.getElementById("joinError");


    const name =
        nameInput.value.trim();

    const roomCode =
        codeInput.value
            .trim()
            .toUpperCase();


    if (!name) {

        error.textContent =
            "Գրիր քո անունը։";

        return;
    }


    if (roomCode.length !== 6) {

        error.textContent =
            "Գրիր 6 նիշանոց սենյակի կոդը։";

        return;
    }


    if (!window.database) {

        error.textContent =
            "Firebase-ը միացված չէ։";

        return;
    }


    error.textContent =
        "Միանում ենք...";


    try {

        const roomRef =
            window.dbRef(
                window.database,
                "rooms/" + roomCode
            );


        const snapshot =
            await window.dbGet(roomRef);


        if (!snapshot.exists()) {

            error.textContent =
                "Այս կոդով խաղ գոյություն չունի։";

            return;
        }


        const room =
            snapshot.val();


        if (room.status !== "waiting") {

            error.textContent =
                "Այս խաղն արդեն սկսվել է։";

            return;
        }


        currentRoom = roomCode;

        currentPlayerId =
            generatePlayerId();

        isHost = false;


        const player = {

            id: currentPlayerId,

            name: name,

            isHost: false,

            joinedAt: Date.now()

        };


        const playerRef =
            window.dbRef(
                window.database,
                "rooms/" +
                roomCode +
                "/players/" +
                currentPlayerId
            );


        await window.dbSet(
            playerRef,
            player
        );


        openLobby();

        listenToRoom();


    } catch (errorObject) {

        console.error(errorObject);

        error.textContent =
            "Միանալ չհաջողվեց։";

    }

}


// ==========================
// OPEN LOBBY
// ==========================

function openLobby() {

    document.getElementById(
        "displayRoomCode"
    ).textContent = currentRoom;


    const hostControls =
        document.getElementById(
            "hostControls"
        );


    if (isHost) {

        hostControls.style.display =
            "block";

    } else {

        hostControls.style.display =
            "none";
    }


    showScreen("lobbyScreen");
}


// ==========================
// LISTEN ROOM
// ==========================

function listenToRoom() {

    if (!currentRoom) return;


    const roomRef =
        window.dbRef(
            window.database,
            "rooms/" + currentRoom
        );


    window.dbOnValue(
        roomRef,
        snapshot => {

            if (!snapshot.exists()) {

                alert(
                    "Խաղի սենյակը փակվել է։"
                );

                goHome();

                return;
            }


            const room =
                snapshot.val();


            renderPlayers(
                room.players || {}
            );


            if (room.status === "started") {

                showGameScreen(
                    room
                );
            }

        }
    );
}


// ==========================
// RENDER PLAYERS
// ==========================

function renderPlayers(players) {

    const container =
        document.getElementById(
            "playersList"
        );


    container.innerHTML = "";


    const playerArray =
        Object.values(players);


    if (playerArray.length === 0) {

        container.innerHTML =
            "<p>Դեռ խաղացողներ չկան։</p>";

        return;
    }


    playerArray.forEach(player => {

        const div =
            document.createElement("div");

        div.className = "player";


        const name =
            document.createElement("span");

        name.textContent =
            "👤 " + player.name;


        const badge =
            document.createElement("span");


        if (player.isHost) {

            badge.textContent =
                "HOST";

            badge.className =
                "host-badge";
        }


        div.appendChild(name);

        div.appendChild(badge);

        container.appendChild(div);

    });
}


// ==========================
// COPY ROOM CODE
// ==========================

async function copyRoomCode() {

    if (!currentRoom) return;


    try {

        await navigator.clipboard.writeText(
            currentRoom
        );

        alert(
            "Սենյակի կոդը պատճենվեց։"
        );

    } catch {

        alert(
            "Կոդը՝ " + currentRoom
        );

    }
}


// ==========================
// START GAME
// ==========================

async function startGame() {

    if (!currentRoom || !isHost) {
        return;
    }


    const roomRef =
        window.dbRef(
            window.database,
            "rooms/" + currentRoom
        );


    await window.dbUpdate(
        roomRef,
        {
            status: "started"
        }
    );

}


// ==========================
// GAME SCREEN
// ==========================

function showGameScreen(room) {

    showScreen("gameScreen");


    document.getElementById(
        "gameMessage"
    ).textContent =
        "Խաղը սկսվել է։ Շուտով կավելացնենք դերերի բաժանումը։";


    document.getElementById(
        "playerRole"
    ).textContent =
        "Սպասում ենք...";
}


// ==========================
// LEAVE GAME
// ==========================

async function leaveGame() {

    if (currentRoom && currentPlayerId) {

        try {

            const playerRef =
                window.dbRef(
                    window.database,
                    "rooms/" +
                    currentRoom +
                    "/players/" +
                    currentPlayerId
                );


            await window.dbSet(
                playerRef,
                null
            );

        } catch (errorObject) {

            console.error(errorObject);

        }

    }


    currentRoom = null;

    currentPlayerId = null;

    isHost = false;

    goHome();
}


console.log("🎭 Mafia Online app.js պատրաստ է");