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

    const screen = document.getElementById(id);

    if (screen) {
        screen.classList.add("active");
    }
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
    return (
        "player_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 8)
    );
}

// ==========================
// CREATE GAME
// ==========================

async function createGame() {
    const nameInput = document.getElementById("hostName");
    const error = document.getElementById("createError");

    const name = nameInput.value.trim();

    if (!name) {
        error.textContent = "Գրիր քո անունը։";
        return;
    }

    if (!window.database) {
        error.textContent = "Firebase-ը միացված չէ։";
        return;
    }

    error.textContent = "Ստեղծվում է խաղ...";

    try {
        let roomCode;
        let roomExists = true;

        while (roomExists) {
            roomCode = generateRoomCode();

            const roomRef = window.dbRef(
                window.database,
                "rooms/" + roomCode
            );

            const snapshot = await window.dbGet(roomRef);

            roomExists = snapshot.exists();
        }

        currentRoom = roomCode;
        currentPlayerId = generatePlayerId();
        isHost = true;

        const player = {
            id: currentPlayerId,
            name: name,
            isHost: true,
            role: null,
            alive: true,
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

        const roomRef = window.dbRef(
            window.database,
            "rooms/" + roomCode
        );

        await window.dbSet(roomRef, room);

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
            role: null,
            alive: true,
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
                showGameScreen(room);
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
            "<p>Դեռ խաղացողներ չկան։";
        return;
    }

    playerArray
        .sort((a, b) =>
            a.joinedAt - b.joinedAt
        )
        .forEach(player => {
            const div =
                document.createElement(
                    "div"
                );

            div.className = "player";

            const name =
                document.createElement(
                    "span"
                );

            name.textContent =
                "👤 " + player.name;

            const badge =
                document.createElement(
                    "span"
                );

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
            "Սենյակի կոդը՝ " +
            currentRoom
        );
    }
}

// ==========================
// ROLE SYSTEM
// ==========================

function createRoles(playerCount) {

    const roles = [];

    /*
        4 խաղացող
        1 Մաֆիա
        1 Բժիշկ
        1 Դետեկտիվ
        1 Քաղաքացի

        5 խաղացող
        1 Մաֆիա
        1 Բժիշկ
        1 Դետեկտիվ
        2 Քաղաքացի

        6-8
        2 Մաֆիա
        1 Բժիշկ
        1 Դետեկտիվ
        մնացածը՝ Քաղաքացի

        9+
        մոտավորապես 1/3 Մաֆիա
    */

    let mafiaCount = 1;

    if (playerCount >= 6 && playerCount <= 8) {
        mafiaCount = 2;
    }

    if (playerCount >= 9) {
        mafiaCount =
            Math.max(
                2,
                Math.floor(playerCount / 3)
            );
    }

    for (let i = 0; i < mafiaCount; i++) {
        roles.push("Մաֆիա");
    }

    roles.push("Բժիշկ");
    roles.push("Դետեկտիվ");

    while (roles.length < playerCount) {
        roles.push("Քաղաքացի");
    }

    return shuffleArray(roles);
}

// ==========================
// SHUFFLE
// ==========================

function shuffleArray(array) {
    const result = [...array];

    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {
        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [
            result[i],
            result[j]
        ] = [
            result[j],
            result[i]
        ];
    }

    return result;
}

// ==========================
// START GAME
// ==========================

async function startGame() {
    if (!currentRoom || !isHost) {
        return;
    }

    if (!window.database) {
        alert(
            "Firebase-ը միացված չէ։"
        );
        return;
    }

    try {
        const roomRef =
            window.dbRef(
                window.database,
                "rooms/" + currentRoom
            );

        const snapshot =
            await window.dbGet(
                roomRef
            );

        if (!snapshot.exists()) {
            alert(
                "Խաղը գոյություն չունի։"
            );
            return;
        }

        const room =
            snapshot.val();

        const players =
            room.players || {};

        const playerIds =
            Object.keys(players);

        const playerCount =
            playerIds.length;

        // Առնվազն 4 խաղացող
        if (playerCount < 4) {
            alert(
                "Խաղը սկսելու համար պետք է առնվազն 4 խաղացող։"
            );
            return;
        }

        // Առավելագույնը 20 խաղացող
        if (playerCount > 20) {
            alert(
                "Առավելագույնը 20 խաղացող։"
            );
            return;
        }

        // Ստեղծում ենք դերերը
        const roles =
            createRoles(playerCount);

        // Խառնել խաղացողներին
        const shuffledPlayerIds =
            shuffleArray(playerIds);

        const updates = {};

        shuffledPlayerIds.forEach(
            (playerId, index) => {

                const role =
                    roles[index];

                updates[
                    "rooms/" +
                    currentRoom +
                    "/players/" +
                    playerId +
                    "/role"
                ] = role;

                updates[
                    "rooms/" +
                    currentRoom +
                    "/players/" +
                    playerId +
                    "/alive"
                ] = true;
            }
        );

        updates[
            "rooms/" +
            currentRoom +
            "/status"
        ] = "started";

        updates[
            "rooms/" +
            currentRoom +
            "/phase"
        ] = "night";

        updates[
            "rooms/" +
            currentRoom +
            "/startedAt"
        ] = Date.now();

        await window.dbUpdate(
            window.dbRoot,
            updates
        );

        console.log(
            "🎭 Դերերը բաժանվեցին:",
            roles
        );

    } catch (errorObject) {
        console.error(
            errorObject
        );

        alert(
            "Չհաջողվեց սկսել խաղը։"
        );
    }
}

// ==========================
// GAME SCREEN
// ==========================

function showGameScreen(room) {
    showScreen("gameScreen");

    const player =
        room.players &&
        room.players[currentPlayerId];

    const gameMessage =
        document.getElementById(
            "gameMessage"
        );

    const playerRole =
        document.getElementById(
            "playerRole"
        );

    if (!player) {
        gameMessage.textContent =
            "Խաղացողը չի գտնվել։";

        playerRole.textContent =
            "?";

        return;
    }

    const role =
        player.role;

    if (!role) {
        gameMessage.textContent =
            "Դերի բաժանումը դեռ չի ավարտվել։";

        playerRole.textContent =
            "...";

        return;
    }

    playerRole.textContent =
        role;

    playerRole.className = "";

    if (role === "Մաֆիա") {
        playerRole.classList.add(
            "role-mafia"
        );

        gameMessage.textContent =
            "Դու Մաֆիա ես։ Գաղտնի պահիր քո դերը։";
    }

    else if (role === "Բժիշկ") {
        playerRole.classList.add(
            "role-doctor"
        );

        gameMessage.textContent =
            "Դու Բժիշկ ես։";
    }

    else if (role === "Դետեկտիվ") {
        playerRole.classList.add(
            "role-detective"
        );

        gameMessage.textContent =
            "Դու Դետեկտիվ ես։";
    }

    else {
        playerRole.classList.add(
            "role-citizen"
        );

        gameMessage.textContent =
            "Դու Քաղաքացի ես։ Փորձիր գտնել Մաֆիային։";
    }
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
            console.error(
                errorObject
            );
        }
    }

    currentRoom = null;
    currentPlayerId = null;
    isHost = false;

    goHome();
}

// ==========================
// ROOM CODE AUTO FORMAT
// ==========================

const roomCodeInput =
    document.getElementById(
        "roomCode"
    );

if (roomCodeInput) {
    roomCodeInput.addEventListener(
        "input",
        function () {
            this.value =
                this.value
                    .toUpperCase()
                    .replace(
                        /[^A-Z0-9]/g,
                        ""
                    )
                    .substring(0, 6);
        }
    );
}

// ==========================
// NAME ENTER SUPPORT
// ==========================

const hostNameInput =
    document.getElementById(
        "hostName"
    );

if (hostNameInput) {
    hostNameInput.addEventListener(
        "keydown",
        function (event) {
            if (event.key === "Enter") {
                createGame();
            }
        }
    );
}

const playerNameInput =
    document.getElementById(
        "playerName"
    );

if (playerNameInput) {
    playerNameInput.addEventListener(
        "keydown",
        function (event) {
            if (event.key === "Enter") {
                joinGame();
            }
        }
    );
}

console.log(
    "🎭 Mafia Online — Role System Ready"
);
