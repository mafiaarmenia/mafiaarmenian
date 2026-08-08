```javascript
let currentRoom = null;
let currentPlayerId = null;
let isHost = false;

let roomListener = null;
let startingGame = false;

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
    const error = document.getElementById("createError");

    if (error) {
        error.textContent = "";
    }

    showScreen("createScreen");
}

function showJoin() {
    const error = document.getElementById("joinError");

    if (error) {
        error.textContent = "";
    }

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
            .substring(2, 9)
    );
}

// ==========================
// FIREBASE CHECK
// ==========================

function firebaseReady() {
    return (
        window.database &&
        window.dbRef &&
        window.dbGet &&
        window.dbSet &&
        window.dbUpdate &&
        window.dbOnValue
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

    if (!firebaseReady()) {
        error.textContent = "Firebase-ը ճիշտ միացված չէ։";
        return;
    }

    error.textContent = "Ստեղծվում է խաղ...";

    try {
        let roomCode;
        let exists = true;

        while (exists) {
            roomCode = generateRoomCode();

            const testRef = window.dbRef(
                window.database,
                "rooms/" + roomCode
            );

            const snapshot = await window.dbGet(testRef);

            exists = snapshot.exists();
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
            phase: "lobby",
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

        console.log("🎮 Room created:", roomCode);

    } catch (errorObject) {
        console.error("CREATE ERROR:", errorObject);

        error.textContent = "Չհաջողվեց ստեղծել խաղ։";
    }
}

// ==========================
// JOIN GAME
// ==========================

async function joinGame() {
    const nameInput = document.getElementById("playerName");
    const codeInput = document.getElementById("roomCode");
    const error = document.getElementById("joinError");

    const name = nameInput.value.trim();

    const roomCode = codeInput.value
        .trim()
        .toUpperCase();

    if (!name) {
        error.textContent = "Գրիր քո անունը։";
        return;
    }

    if (roomCode.length !== 6) {
        error.textContent = "Գրիր 6 նիշանոց սենյակի կոդը։";
        return;
    }

    if (!firebaseReady()) {
        error.textContent = "Firebase-ը ճիշտ միացված չէ։";
        return;
    }

    error.textContent = "Միանում ենք...";

    try {
        const roomRef = window.dbRef(
            window.database,
            "rooms/" + roomCode
        );

        const snapshot = await window.dbGet(roomRef);

        if (!snapshot.exists()) {
            error.textContent =
                "Այս կոդով սենյակ գոյություն չունի։";
            return;
        }

        const room = snapshot.val();

        if (room.status !== "waiting") {
            error.textContent =
                "Այս խաղն արդեն սկսվել է։";
            return;
        }

        const existingPlayers = Object.keys(
            room.players || {}
        ).length;

        if (existingPlayers >= 20) {
            error.textContent =
                "Սենյակը լիքն է։";
            return;
        }

        currentRoom = roomCode;
        currentPlayerId = generatePlayerId();
        isHost = false;

        const player = {
            id: currentPlayerId,
            name: name,
            isHost: false,
            role: null,
            alive: true,
            joinedAt: Date.now()
        };

        const playerRef = window.dbRef(
            window.database,
            "rooms/" +
            roomCode +
            "/players/" +
            currentPlayerId
        );

        await window.dbSet(playerRef, player);

        openLobby();
        listenToRoom();

    } catch (errorObject) {
        console.error("JOIN ERROR:", errorObject);

        error.textContent =
            "Միանալ չհաջողվեց։";
    }
}

// ==========================
// OPEN LOBBY
// ==========================

function openLobby() {
    const code = document.getElementById(
        "displayRoomCode"
    );

    if (code) {
        code.textContent = currentRoom;
    }

    const controls = document.getElementById(
        "hostControls"
    );

    if (controls) {
        controls.style.display =
            isHost ? "block" : "none";
    }

    showScreen("lobbyScreen");
}

// ==========================
// LISTEN ROOM
// ==========================

function listenToRoom() {
    if (!currentRoom) {
        return;
    }

    if (roomListener) {
        roomListener();
        roomListener = null;
    }

    const roomRef = window.dbRef(
        window.database,
        "rooms/" + currentRoom
    );

    roomListener = window.dbOnValue(
        roomRef,
        snapshot => {

            if (!snapshot.exists()) {
                alert("Խաղի սենյակը փակվել է։");

                currentRoom = null;
                currentPlayerId = null;
                isHost = false;

                goHome();

                return;
            }

            const room = snapshot.val();

            renderPlayers(room.players || {});

            // Խաղը սկսված է
            if (room.status === "started") {

                // Եթե տվյալ խաղացողի դերը արդեն կա,
                // անմիջապես բացում ենք խաղի էկրանը
                const currentPlayer =
                    room.players &&
                    room.players[currentPlayerId];

                if (
                    currentPlayer &&
                    currentPlayer.role
                ) {
                    showGameScreen(room);
                }
            }
        }
    );
}

// ==========================
// RENDER PLAYERS
// ==========================

function renderPlayers(players) {
    const container =
        document.getElementById("playersList");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const playerArray =
        Object.values(players);

    playerArray.sort(
        (a, b) =>
            (a.joinedAt || 0) -
            (b.joinedAt || 0)
    );

    if (playerArray.length === 0) {
        container.innerHTML =
            "<p>Դեռ խաղացողներ չկան։";
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
            badge.textContent = "HOST";
            badge.className = "host-badge";
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
    if (!currentRoom) {
        return;
    }

    try {
        await navigator.clipboard.writeText(
            currentRoom
        );

        alert("Սենյակի կոդը պատճենվեց։");

    } catch {
        alert(
            "Սենյակի կոդը՝ " +
            currentRoom
        );
    }
}

// ==========================
// CREATE ROLES
// ==========================

function createRoles(playerCount) {

    const roles = [];

    let mafiaCount = 1;

    if (playerCount >= 6 && playerCount <= 8) {
        mafiaCount = 2;
    }

    if (playerCount >= 9) {
        mafiaCount = Math.max(
            2,
            Math.floor(playerCount / 3)
        );
    }

    // Մաֆիա
    for (let i = 0; i < mafiaCount; i++) {
        roles.push("Մաֆիա");
    }

    // Հատուկ դերեր
    if (playerCount >= 4) {
        roles.push("Բժիշկ");
        roles.push("Դետեկտիվ");
    }

    // Քաղաքացիներ
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

        const j = Math.floor(
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

    if (!currentRoom) {
        return;
    }

    if (!isHost) {
        return;
    }

    if (startingGame) {
        return;
    }

    if (!firebaseReady()) {
        alert("Firebase-ը ճիշտ միացված չէ։");
        return;
    }

    startingGame = true;

    try {

        const roomRef =
            window.dbRef(
                window.database,
                "rooms/" + currentRoom
            );

        const snapshot =
            await window.dbGet(roomRef);

        if (!snapshot.exists()) {
            alert("Խաղը գոյություն չունի։");
            return;
        }

        const room = snapshot.val();

        const players =
            room.players || {};

        const playerIds =
            Object.keys(players);

        const count =
            playerIds.length;

        // ======================
        // PLAYER COUNT
        // ======================

        if (count < 4) {
            alert(
                "Խաղը սկսելու համար պետք է առնվազն 4 խաղացող։"
            );
            return;
        }

        if (count > 20) {
            alert(
                "Առավելագույնը 20 խաղացող։"
            );
            return;
        }

        // ======================
        // CREATE ROLES
        // ======================

        const roles =
            createRoles(count);

        const shuffledPlayers =
            shuffleArray(playerIds);

        // ======================
        // ONE ATOMIC UPDATE
        // ======================

        const updates = {};

        for (
            let i = 0;
            i < shuffledPlayers.length;
            i++
        ) {

            const playerId =
                shuffledPlayers[i];

            const basePath =
                "rooms/" +
                currentRoom +
                "/players/" +
                playerId;

            updates[
                basePath + "/role"
            ] = roles[i];

            updates[
                basePath + "/alive"
            ] = true;
        }

        // Սկզբում status-ը
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

        // ======================
        // ATOMIC FIREBASE UPDATE
        // ======================

        const rootRef =
            window.dbRef(
                window.database,
                "/"
            );

        // Բոլոր դերերը + status-ը
        // ուղարկվում են մեկ Firebase request-ով
        await window.dbUpdate(
            rootRef,
            updates
        );

        console.log(
            "🎭 Roles assigned instantly:",
            roles
        );

    } catch (errorObject) {

        console.error(
            "START GAME ERROR:",
            errorObject
        );

        alert(
            "Չհաջողվեց սկսել խաղը։"
        );

    } finally {

        startingGame = false;
    }
}

// ==========================
// GAME SCREEN
// ==========================

function showGameScreen(room) {

    showScreen("gameScreen");

    const message =
        document.getElementById(
            "gameMessage"
        );

    const roleElement =
        document.getElementById(
            "playerRole"
        );

    const player =
        room.players &&
        room.players[currentPlayerId];

    if (!player) {

        message.textContent =
            "Խաղացողը չի գտնվել։";

        roleElement.textContent =
            "?";

        return;
    }

    const role =
        player.role;

    if (!role) {

        message.textContent =
            "Դերը դեռ չի բաժանվել։";

        roleElement.textContent =
            "...";

        return;
    }

    roleElement.textContent =
        role;

    roleElement.className = "";

    // ======================
    // MAFIA
    // ======================

    if (role === "Մաֆիա") {

        roleElement.classList.add(
            "role-mafia"
        );

        message.textContent =
            "🔫 Դու Մաֆիա ես։ Գաղտնի պահիր քո դերը։";
    }

    // ======================
    // DOCTOR
    // ======================

    else if (role === "Բժիշկ") {

        roleElement.classList.add(
            "role-doctor"
        );

        message.textContent =
            "🩺 Դու Բժիշկ ես։";
    }

    // ======================
    // DETECTIVE
    // ======================

    else if (role === "Դետեկտիվ") {

        roleElement.classList.add(
            "role-detective"
        );

        message.textContent =
            "🔎 Դու Դետեկտիվ ես։";
    }

    // ======================
    // CITIZEN
    // ======================

    else {

        roleElement.classList.add(
            "role-citizen"
        );

        message.textContent =
            "👤 Դու Քաղաքացի ես։ Փորձիր գտնել Մաֆիային։";
    }
}

// ==========================
// LEAVE GAME
// ==========================

async function leaveGame() {

    try {

        if (
            currentRoom &&
            currentPlayerId &&
            firebaseReady()
        ) {

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
        }

    } catch (errorObject) {

        console.error(
            "LEAVE ERROR:",
            errorObject
        );
    }

    if (roomListener) {
        roomListener();
        roomListener = null;
    }

    currentRoom = null;
    currentPlayerId = null;
    isHost = false;
    startingGame = false;

    goHome();
}

// ==========================
// ROOM CODE INPUT
// ==========================

const roomCodeInput =
    document.getElementById("roomCode");

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
// ENTER KEY
// ==========================

const hostNameInput =
    document.getElementById("hostName");

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
    document.getElementById("playerName");

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

// ==========================
// READY
// ==========================

console.log(
    "🎭 Mafia Armenia — FAST app.js loaded"
);
```

