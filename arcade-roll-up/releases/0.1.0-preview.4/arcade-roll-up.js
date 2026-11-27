(() => {
"use strict";
const home = { x:0, y:1.263, z:.32 };
const prefabName = "Arcade Roll-Up Cabinet";
const ringY = 1.91, ringZ = 3.48, spacing = 1.04;
const ballRadius = .095, aimLimit = .40;
const values = [30, 10, 50];
const ringSize = [.85, 1, .70];
const ringPace = [1.35, 1, 1.75];
const baseRingHeights = values.map(() => ringY);
const blockerPace = 1.12;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createRingMotion(random = Math.random) {
    const randomDuration = index => (1.15 + random() * 1.55) / ringPace[index];
    const randomEndpoint = direction => direction > 0
        ? .035 + random() * .10
        : -(.08 + random() * .14);
    let rings = values.map((_, index) => {
        const duration = randomDuration(index);
        const direction = random() < .5 ? -1 : 1;
        return { elapsed:random() * duration, duration, from:randomEndpoint(-direction),
            to:randomEndpoint(direction) };
    });
    const step = dt => rings.map((ring, index) => {
        ring.elapsed += dt;
        while (ring.elapsed >= ring.duration) {
            ring.elapsed -= ring.duration;
            ring.from = ring.to;
            ring.to = randomEndpoint(-Math.sign(ring.from));
            ring.duration = randomDuration(index);
        }
        const blend = (1 - Math.cos(Math.PI * ring.elapsed / ring.duration)) / 2;
        return ringY + ring.from + (ring.to - ring.from) * blend;
    });
    step.checkpoint = () => rings.map(ring => ({...ring}));
    step.restore = state => { rings = state.map(ring => ({...ring})); };
    return step;
}

function createBlockerMotion(random = Math.random) {
    let position = 0, target = 0, speed = 0, pause = 0;
    const step = dt => {
        if (pause > 0) {
            pause -= dt;
            return position;
        }
        if (position === target) {
            const lane = random();
            if (lane < .22) {
                target = (random() - .5) * .28;
            } else {
                const side = lane < .61 ? -1 : 1;
                target = side * (.62 + random() * .24);
                if (Math.abs(target - position) < .07)
                    target = side * (Math.abs(position) < .74 ? .84 : .64);
            }
            speed = 1.05 + random() * 1.25;
        }
        const remaining = target - position;
        if (Math.abs(remaining) <= speed * dt) {
            position = target;
            pause = Math.abs(target) < .14 ? .03 + random() * .12 : .12 + random() * .22;
        } else {
            position += Math.sign(remaining) * speed * dt;
        }
        return position;
    };
    step.checkpoint = () => [position,target,speed,pause];
    step.restore = state => { [position,target,speed,pause] = state; };
    return step;
}
function slingshotPull(start, hand) {
    return {
        power: clamp((start.z-hand.z)/.22,0,1),
        aim: clamp((start.x-hand.x)*2.3,-aimLimit,aimLimit)
    };
}

function classifyRingCrossing(x, y, heights = baseRingHeights) {
    const index = Math.max(0, Math.min(2, Math.round(x / spacing) + 1));
    const offset = Math.hypot(x - (index - 1) * spacing, y - heights[index]);
    const scale = 1.20 * ringSize[index];
    // Match the opening and rim to the rendered ring.
    const clearRadius = .235 * scale;
    const contactRadius = .325 * scale + ballRadius;
    const touchedRim = offset >= clearRadius * Math.cos(Math.PI / 24) - ballRadius &&
        offset <= contactRadius;
    const kind = offset <= clearRadius ? "score" : touchedRim ? "rim" : "miss";
    return { index, kind, touchedRim };
}

function createGame(onRimHit = () => {}, onBlockerHit = () => {}, onScore = () => {}) {
    let player, initials, holding, shots = 0, score = 0, bonus = 0;
    let flight = null, result = "Grab to play";
    const leaders = [];
    return {
        get state() { return { player, initials, holding, shots, score, bonus, flight, result, leaders }; },
        restore(state) {
            ({player,initials,holding,shots,score,bonus,result} = state);
            flight = state.flight ? {...state.flight} : null;
            leaders.splice(0,leaders.length,...state.leaders);
        },
        disconnect(id) {
            if (id !== player) return;
            player = initials = holding = undefined;
            shots = score = 0;
            flight = null;
            result = "Grab to play";
        },
        grab(id) {
            if (!id || flight || holding) return "busy";
            if (id !== player) {
                if (player && (!initials || shots !== 3)) return "busy";
                player = id;
                initials = undefined;
                result = "Enter initials";
                return "initials";
            }
            if (!initials) return "initials";
            if (shots === 3) {
                shots = score = 0;
                bonus = (bonus + 1) % 3;
                result = "Time your roll";
            }
            holding = id;
            return "held";
        },
        confirm(id, value) {
            if (id !== player || initials || !/^[A-Z]{3}$/.test(value)) return false;
            initials = value;
            result = "Grab again";
            return true;
        },
        cancel(id) {
            if (id !== player) return;
            holding = undefined;
            if (!initials) {
                player = undefined;
                result = "Grab to play";
            }
        },
        release(id, power, aim) {
            if (id !== holding || !holding) return false;
            holding = undefined;
            if (power < .05) return false;
            const speed = 3.25 + 2.65 * power + 1.35 * clamp((power - .85) / .15, 0, 1);
            flight = { ...home, speed, aim, power, vy:0, elapsed:0, airborne:false };
            shots++;
            result = "Ball rolling";
            return true;
        },
        step(dt, blockerX, previousHeights = baseRingHeights, heights = previousHeights) {
            if (!flight) return;
            const f = flight;
            const before = {x:f.x, y:f.y, z:f.z};
            f.elapsed += dt;
            f.z += f.speed * dt;
            f.x = (f.z - home.z) * .84 * f.aim;
            if (!f.airborne) {
                f.y = home.y + (f.z - home.z) * .2126;
                f.speed -= 2.3 * dt;
                if (f.z >= 2.60) {
                    f.airborne = true;
                    f.vy = 1.68 + 1.15 * clamp((f.power - .85) / .15, 0, 1);
                    f.speed *= .84;
                }
            } else {
                f.y += f.vy * dt;
                f.vy -= 9.81 * dt;
            }
            if (Math.abs(f.z - 2.48) < .16 && Math.abs(f.x - blockerX) < .235 &&
                Math.abs(f.y - 1.748) < .215) {
                finish("BLOCKED");
                onBlockerHit(blockerX);
                return;
            }
            if (f.airborne && before.z < ringZ && f.z >= ringZ) {
                const ratio = (ringZ-before.z)/(f.z-before.z);
                const x = before.x + (f.x-before.x)*ratio;
                const y = before.y + (f.y-before.y)*ratio;
                const crossingHeights = heights.map((height,i) => previousHeights[i] +
                    (height - previousHeights[i]) * ratio);
                const {index:hit, kind, touchedRim} = classifyRingCrossing(x,y,crossingHeights);
                if (touchedRim) onRimHit(hit);
                if (kind === "miss") return finish("Miss");
                if (kind === "rim") return finish("RIM HIT");
                const points = values[hit] * (hit === bonus ? 2 : 1);
                score += points;
                finish(hit === bonus ? "+" + points + " BONUS" : "+" + points);
                onScore(hit);
                return;
            }
            if (f.elapsed > 5 || f.z > 5.4 || f.speed < .03) finish("Miss");
        }
    };
    function finish(message) {
        flight = null;
        result = message;
        if (shots === 3 && initials) {
            const next = leaders.findIndex(row => row.score < score);
            leaders.splice(next < 0 ? leaders.length : next, 0, { initials, score });
            if (leaders.length > 3) leaders.pop();
        }
    }
}

const roomChannel = "arcade-roll-up-v1";
const fixedStep = 1/120;
const bufferSeconds = .14;

function createRoomSync(scene, now, callbacks) {
    let host, startedAt, lastFrame, position, clockAt;
    const frames = [], sounds = [];
    const me = () => scene.localUser?.id ?? "preview";
    const participants = () => new Set([me(), ...Object.values(scene.users ?? {}).map(user => user.id)]
        .filter(id => id && id !== "local"));
    function send(kind, payload) {
        return scene.OneShot?.({channel:roomChannel,kind,...payload});
    }
    scene.On("one-shot", event => {
        let message;
        try { message = JSON.parse(event.detail.data); } catch { return; }
        const sender = event.detail.fromId;
        if (message?.channel !== roomChannel || !participants().has(sender) || sender === me()) return;
        if (message.kind === "frame") {
            const frame = message.frame;
            if (!Number.isSafeInteger(frame?.tick) || !Array.isArray(frame.heights) ||
                frame.heights.length !== 3 || !frame.state || !Array.isArray(frame.ringMotion) ||
                !Array.isArray(frame.blockerMotion)) return;
            if (host !== sender && host && participants().has(host)) return;
            if (host !== sender) {
                host = sender;
                frames.length = 0;
                sounds.length = 0;
                position = undefined;
            }
            if (frames.length && frame.tick <= frames[frames.length-1].tick) return;
            frames.push(frame);
            if (frames.length > 24) frames.shift();
            if (position === undefined) {
                position = frame.tick;
                clockAt = now();
            }
            lastFrame = frame;
        } else if (message.kind === "input" && host === me() && message.host === host) {
            callbacks.input(sender,message.action,message.args);
        } else if (message.kind === "sound" && host === sender && frames.length &&
            Number.isSafeInteger(message.tick) && sounds.length < 32) {
            sounds.push(message);
        }
    });
    return {
        get authority() { return host === me(); },
        get latest() { return lastFrame; },
        update() {
            const id = me();
            if (id === "local") return;
            startedAt ??= now();
            const present = participants();
            if (host && present.has(host)) return;
            if (!host && id !== "preview" && now() - startedAt < 750) return;
            const next = [...present].sort()[0];
            if (host === next) return;
            host = next;
            frames.length = 0;
            sounds.length = 0;
            position = undefined;
            if (host === id) callbacks.promoted(lastFrame,present);
        },
        publish(frame) {
            lastFrame = frame;
            if (participants().size > 1) return send("frame",{frame});
        },
        action(action,...args) {
            if (!host) return;
            if (host === me()) return callbacks.input(me(),action,args);
            return send("input",{host,action,args});
        },
        sound(effect,value,tick) {
            if (participants().size > 1) return send("sound",{effect,value,tick});
        },
        sample() {
            if (!frames.length) return;
            const newest = frames[frames.length-1];
            const currentTime = now();
            // One buffered timeline for every visible part of the cabinet.
            const desired = newest.tick - bufferSeconds / fixedStep;
            const rate = position < desired - 8 ? 1.10 : position > desired + 8 ? .90 : 1;
            position = Math.min(newest.tick,position + (currentTime-clockAt)*rate/(fixedStep*1000));
            clockAt = currentTime;
            while (sounds.length && sounds[0].tick <= position) {
                const sound = sounds.shift();
                callbacks.sound(sound.effect,sound.value);
            }
            while (frames.length > 1 && frames[1].tick <= position) frames.shift();
            const [a,b] = frames;
            if (!b) return a;
            const t = clamp((position-a.tick)/(b.tick-a.tick),0,1);
            const lerp = (first,next) => first+(next-first)*t;
            const sameBallPass = a.state.shots === b.state.shots && a.phase === b.phase;
            return {
                ...a,
                blocker:lerp(a.blocker,b.blocker),
                heights:a.heights.map((y,i) => lerp(y,b.heights[i])),
                ball:sameBallPass ? {
                    x:lerp(a.ball.x,b.ball.x), y:lerp(a.ball.y,b.ball.y),z:lerp(a.ball.z,b.ball.z)
                } : a.ball
            };
        }
    };
}

if (typeof module !== "undefined") module.exports = {
    createGame, slingshotPull, classifyRingCrossing, createRingMotion, createBlockerMotion, createRoomSync
};
if (typeof window === "undefined") return;
let started = false;
function boot(cabinet) {
    if (started) return;
    started = true;
    return start(BS.Scene.GetInstance(),cabinet).catch(error => {
        started = false;
        throw error;
    });
}
const reportStartup = () => boot().catch(error => console.error("Arcade Roll-Up setup", error));
if (typeof document !== "undefined" && document.currentScript?.dataset.arcadeRollUpMode === "snippet")
    window.ArcadeRollUpStart = boot;
else if (window.BS?.Scene) reportStartup();
else window.addEventListener("bs-loaded", reportStartup, { once:true });

async function start(scene,mountedCabinet) {
    await scene.WaitForUnityLoaded();
    const desktopControls = !mountedCabinet ||
        document.querySelector('bs-snippet[name="arcade-roll-up"]')
            ?.getAttribute("desktop-controls") === "true";
    const cabinet = mountedCabinet ?? await scene.Find(prefabName);
    const aimLeft = cabinet ? BS.KeyCode.Comma : BS.KeyCode.A;
    const aimRight = cabinet ? BS.KeyCode.Period : BS.KeyCode.D;
    const shoot = cabinet ? BS.KeyCode.Slash : BS.KeyCode.Space;
    let desktopSelected = !cabinet;
    const findPart = name => cabinet ? cabinet.Find(name) : scene.Find(name);
    let origin, yaw = 0;
    if (cabinet) {
        await cabinet.WatchTransform([BS.PN.position,BS.PN.eulerAngles], transform => {
            origin = transform.position;
            yaw = (transform.eulerAngles?.y ?? 0) * Math.PI / 180;
        });
    }
    const ringAudio = [];
    let room, simulationTick = 0;
    const blockerEmitter = await findPart("Roll-Up blocker audio");
    const blockerAudio = blockerEmitter?.GetComponent(BS.CT.AudioSource);
    function playSound(effect,value) {
        if (effect === "blocker" && blockerAudio) {
            report(blockerEmitter.SetLocalPosition(vector(value,1.748,2.48))
                .then(() => blockerAudio.PlayOneShot(0)));
        } else if ((effect === "rim" || effect === "score") && ringAudio[value]) {
            report(ringAudio[value].PlayOneShot(effect === "score" ? 1 : 0));
        }
    }
    function shareSound(effect,value) {
        playSound(effect,value);
        report(room.sound(effect,value,simulationTick));
    }
    const game = createGame(i => shareSound("rim",i), x => shareSound("blocker",x),
        i => shareSound("score",i));
    const me = () => scene.localUser?.id ?? "preview";
    const vector = (x, y, z) => new BS.Vector3(x,y,z);
    const color = (r,g,b) => new BS.Vector4(r,g,b,1);
    const amber = color(1,.63,.14), navy = color(.04,.10,.15), green = color(.57,1,.16);
    const report = promise => Promise.resolve(promise).catch(error => console.error("Arcade Roll-Up", error));
    async function object(name, p, parent, extra = {}) {
        const obj = new BS.GameObject({ name, parent, localPosition: vector(...p), ...extra });
        await obj.Async();
        return obj;
    }
    async function shape(name, p, parent, geometry, tint, extra) {
        const obj = await object(name, p, parent, extra);
        await obj.AddComponent(geometry);
        await obj.AddComponent(new BS.Material({ color:tint }));
        return obj;
    }
    const box = (width,height,depth) => new BS.Box({width,height,depth});
    async function text(name, p, parent, value, fontSize, width, height, tint = color(.95,.95,.98)) {
        const obj = await object(name, p, parent);
        return obj.AddComponent(new BS.Text({ text:value, fontSize, color:tint, enableWordWrapping:false,
            rectTransformSizeDelta:new BS.Vector2(width,height) }));
    }

    const root = await object("Arcade Roll-Up runtime", [0,0,0], cabinet);
    // The mounted snippet uses solid world geometry below the ramp and deck.
    // Default blocks the avatar body, lets hands through, and is outside the grab sphere.
    if (mountedCabinet) {
        const frontBody = await object("Arcade Roll-Up ramp collision", [0,.54,1.28], root,
            {layer:BS.L.Default});
        await frontBody.AddComponent(new BS.BoxCollider({
            isTrigger:false, size:vector(2.00,1.08,2.56)
        }));
        const rearBody = await object("Arcade Roll-Up deck collision", [0,.75,3.65], root,
            {layer:BS.L.Default});
        await rearBody.AddComponent(new BS.BoxCollider({
            isTrigger:false, size:vector(2.89,1.50,2.26)
        }));
    }
    const projectile = await shape("Roll-Up ball", [0,home.y,home.z], root,
        new BS.Sphere({radius:ballRadius,widthSegments:16,heightSegments:8}), color(1,.33,.09));
    const hazard = await shape("Moving hazard", [0,1.748,2.48], root, box(.28,.24,.13), amber);
    for (let index = -1; index <= 1; index++)
        await shape("Hazard stripe", [index*.052,0,-.069], hazard, box(.022,.125,.007), navy,
            {localEulerAngles:vector(0,0,-27)});
    await text("Cabinet title",[0,3.10,4.731],root,"ARCADE ROLL-UP",1.65,2.02,.20);
    const status = await text("Live score",[-.48,2.72,4.731],root,"",.91,.94,.52);
    const high = await text("High scores",[.48,2.72,4.731],root,"",.99,.94,.60,amber);
    const markers = [], ringAnchors = [];
    for (let i=0; i<3; i++) {
        const anchor = await findPart("Roll-Up rim audio " + i);
        if (!anchor) throw new Error("Missing moving ring anchor " + i);
        ringAnchors.push(anchor);
        ringAudio[i] = anchor.GetComponent(BS.CT.AudioSource);
        const size = ringSize[i];
        if (size !== 1) await anchor.SetLocalScale(vector(size,size,size));
        markers.push(await text("Ring "+values[i],[0,.56/size,-.04/size],anchor,
            String(values[i]),1.28/size,.38/size,.18/size));
    }
    const grab = await object("Grab the ball", [0,home.y,home.z], root, {layer:BS.L.Grabbable});
    await grab.AddComponent(new BS.SphereCollider({radius:.13}));
    const gripBody = await grab.AddComponent(new BS.Rigidbody({
        mass:.1,useGravity:false,isKinematic:false,freezePositionY:true,
        freezeRotationX:true,freezeRotationY:true,freezeRotationZ:true
    }));
    await grab.AddComponent(new BS.Grababble({grabType:BS.BSGrabType.Soft}));

    const panel = await shape("Enter initials",[home.x,home.y+.35,home.z],root,box(.64,.36,.025),navy);
    const glyphs = [];
    const draft = [0,0,0];
    const initialsText = () => String.fromCharCode(...draft.map(letter => 65+letter));
    async function key(name, x, y, width, caption, click) {
        const item = await shape(name,[x,y,-.02],panel,box(width,.045,.013),color(.14,.24,.31),{layer:BS.L.UI});
        await item.AddComponent(new BS.BoxCollider({size:vector(width,.045,.023)}));
        item.On("click", click);
        await text(name+" caption",[x,y,-.039],panel,caption,.30,width,.046);
    }
    await text("Initials instructions",[0,.14,-.038],panel,"ENTER YOUR THREE INITIALS",.30,.60,.060,amber);
    for (let index=0; index<3; index++) {
        const x = (index-1)*.15;
        glyphs.push(await text("Initial "+(index+1),[x,.005,-.039],panel,"A",.40,.12,.062));
        for (const [y, delta, caption] of [[.064,1,"+"],[-.053,25,"-"]])
            await key("Change initial "+index+" "+caption,x,y,.11,caption,() => {
                draft[index] = (draft[index]+delta)%26;
                glyphs[index].text = initialsText()[index];
            });
    }
    await key("Confirm initials",-.12,-.128,.21,"CONFIRM",() => report(room.action("confirm",initialsText())));
    await key("Cancel initials",.12,-.128,.18,"CANCEL",() => report(room.action("cancel")));
    panel.active = false;
    if (cabinet && desktopControls) {
        const focus = await shape("Arcade Roll-Up desktop controls",[.65,1.40,home.z],root,
            box(.36,.14,.025),navy,{layer:BS.L.UI});
        await focus.AddComponent(new BS.BoxCollider({size:vector(.36,.14,.04)}));
        const caption = await text("Arcade Roll-Up keyboard help",[0,0,-.022],focus,
            "DESKTOP PLAY",.34,.33,.13);
        function selectDesktop(selected) {
            if (!selected && desktopCharge !== null) {
                desktopCharge = null;
                report(room.action("cancel"));
            }
            desktopSelected = selected;
            caption.text = selected ? ",   .   AIM\n/   SHOOT" : "DESKTOP PLAY";
        }
        focus.On("click",() => selectDesktop(!desktopSelected));
        scene.On("key-press", event => {
            if (event.detail.key === BS.KeyCode.Escape) selectDesktop(false);
        });
    }

    let hold, pose, resetting = false, rejectGrab = false, blocker = 0;
    let sharedPull, lastControl = 0, lastPullSent = 0;
    let typedLetter = 0, desktopAim = 0, desktopCharge = null;
    let lastStatus, lastHigh, lastBonus, panelVisible = false;
    async function resetGrip(forceRelease = false) {
        if (resetting) {
            rejectGrab ||= forceRelease;
            return;
        }
        resetting = true;
        try {
            do {
                rejectGrab = false;
                if (forceRelease) {
                    try { await grab.ReleaseGrab(); }
                    catch (error) { console.warn("Arcade Roll-Up grip release", error); }
                }
                gripBody.velocity = vector(0,0,0);
                await grab.SetLocalPosition(vector(home.x,home.y,home.z));
                gripBody.velocity = vector(0,0,0);
                forceRelease = rejectGrab;
            } while (forceRelease);
        } finally {
            resetting = false;
        }
    }
    function readPull(pos) {
        if (!hold || !pos) return;
        hold.start ??= {x:pos.x,z:pos.z};
        Object.assign(hold, slingshotPull(hold.start,pos));
    }
    const viewState = () => room?.authority ? game.state : room?.latest?.state;
    function requestGrab() {
        if (!room) return false;
        if (room.authority) return room.action("grab") === "held";
        const state = viewState();
        if (!state || state.flight || state.holding ||
            (state.player && state.player !== me() && (!state.initials || state.shots !== 3))) return false;
        report(room.action("grab"));
        return state.player === me() && Boolean(state.initials);
    }
    function handPosition() {
        const hand = (hold?.left ? pose?.leftHand : pose?.rightHand)?.position;
        if (!hand || !cabinet) return hand;
        if (!origin) return undefined;
        const x = hand.x - origin.x, z = hand.z - origin.z;
        return { x:x*Math.cos(yaw)-z*Math.sin(yaw), z:x*Math.sin(yaw)+z*Math.cos(yaw) };
    }
    grab.On("grab", event => {
        if (hold) return;
        const id = me();
        if (resetting || !requestGrab()) {
            report(resetGrip(true));
            return;
        }
        const side = event.detail?.side;
        hold = { id, side, left:side === BS.HandSide.LEFT, power:0, aim:0, since:performance.now() };
        readPull(handPosition());
    });
    function finishHold(launch, forceRelease = false) {
        const released = hold;
        hold = undefined;
        if (released) {
            if (launch) report(room.action("release",released.power,released.aim));
            else report(room.action("cancel"));
        }
        report(resetGrip(forceRelease));
    }
    grab.On("drop", () => finishHold(true));
    scene.On("button-released", event => {
        const released = hold;
        if (!released || event.detail.button !== BS.ButtonType.GRIP ||
            event.detail.side !== released.side) return;
        // Give the native drop event first chance to finish this grab.
        setTimeout(() => {
            if (hold === released) finishHold(true,true);
        },150);
    });
    scene.On("pose-update", event => {
        pose = event.detail;
        if (hold) readPull(handPosition());
    });
    await grab.WatchTransform([BS.PN.localPosition], transform => {
        const p = transform.localPosition;
        if (hold && !handPosition()) readPull(p);
        if (!hold && !resetting && p && Math.hypot(p.x-home.x,p.y-home.y,p.z-home.z) > .04)
            report(resetGrip());
    });
    scene.On("key-press", event => {
        if (!desktopControls || !desktopSelected) return;
        const key = event.detail.key;
        const state = viewState();
        if (state?.player === me() && !state.initials) {
            if (cabinet) return;
            if (key >= BS.KeyCode.A && key <= BS.KeyCode.Z && typedLetter < 3) {
                draft[typedLetter] = key - BS.KeyCode.A;
                glyphs[typedLetter].text = initialsText()[typedLetter];
                typedLetter++;
            } else if (key === BS.KeyCode.Return && typedLetter === 3) report(room.action("confirm",initialsText()));
            return;
        }
        if (key === aimLeft) desktopAim = clamp(desktopAim-.06,-aimLimit,aimLimit);
        if (key === aimRight) desktopAim = clamp(desktopAim+.06,-aimLimit,aimLimit);
        if (key === shoot && desktopCharge === null && requestGrab())
            desktopCharge = performance.now();
    });
    scene.On("key-release", event => {
        if (!desktopControls || !desktopSelected) return;
        if (event.detail.key !== shoot || desktopCharge === null) return;
        const power = clamp((performance.now()-desktopCharge)/1350,0,1);
        desktopCharge = null;
        report(room.action("release",power,desktopAim));
    });
    let lastTime = performance.now(), remainder = 0, sending = false, sendingBall = false;
    const moveRings = createRingMotion();
    const moveBlocker = createBlockerMotion();
    let ringHeights = moveRings(0);
    room = createRoomSync(scene,() => performance.now(),{
        input(id,action,args) {
            if (!Array.isArray(args)) return;
            if (action === "grab") {
                const accepted = game.grab(id);
                if (accepted === "held") {
                    lastControl = performance.now();
                    sharedPull = undefined;
                }
                return accepted;
            }
            if (action === "confirm" && typeof args[0] === "string") return game.confirm(id,args[0]);
            if (action === "cancel") return game.cancel(id);
            if (game.state.holding !== id || !args.slice(0,2).every(Number.isFinite) || args.length < 2) return;
            const power = clamp(args[0],0,1), aim = clamp(args[1],-aimLimit,aimLimit);
            lastControl = performance.now();
            if (action === "release") {
                sharedPull = undefined;
                return game.release(id,power,aim);
            }
            if (action === "pull") sharedPull = {power,aim};
        },
        promoted(frame,present) {
            if (!frame) return;
            game.restore(frame.state);
            if (frame.state.player && !present.has(frame.state.player)) game.disconnect(frame.state.player);
            moveRings.restore(frame.ringMotion);
            moveBlocker.restore(frame.blockerMotion);
            ringHeights = frame.heights;
            blocker = frame.blocker;
            simulationTick = frame.tick;
            lastControl = performance.now();
            sharedPull = undefined;
        },
        sound:playSound
    });
    function authorityFrame() {
        const state = game.state;
        const pull = state.holding === me() ? hold : sharedPull;
        const ball = state.flight ? {x:state.flight.x,y:state.flight.y,z:state.flight.z} : (state.holding && pull ?
            {x:-pull.aim*.42,y:home.y-.042*pull.power,z:home.z-.20*pull.power} : home);
        return { tick:simulationTick, state, blocker, heights:ringHeights,
            ball, phase:state.flight ? "flight" : state.holding ? "hold" : "idle" };
    }
    function render(frame) {
        if (!frame) return;
        const {state,ball:p,blocker:x,heights} = frame;
        const line = (state.initials ? state.initials+"   " : "") + state.score+" POINTS\n"+
            (3-state.shots)+" BALLS LEFT\n"+(hold ? "POWER "+Math.round(hold.power*100)+"%" : state.result);
        if (line !== lastStatus) status.text = lastStatus = line;
        const board = "HIGH SCORES\n"+[0,1,2].map(i => {
            const row = state.leaders[i];
            return (i+1)+"   "+(row ? row.initials+"   "+row.score : "---");
        }).join("\n");
        if (board !== lastHigh) high.text = lastHigh = board;
        if (state.bonus !== lastBonus) {
            lastBonus = state.bonus;
            markers.forEach((marker,i) => {
                marker.text = String(values[i]) + (i === state.bonus ? " ×2" : "");
                marker.color = i === state.bonus ? green : color(.95,.95,.98);
            });
        }
        const show = state.player === me() && !state.initials;
        if (show !== panelVisible) {
            panelVisible = panel.active = show;
            if (show) { typedLetter = 0; draft.fill(0); glyphs.forEach(glyph => { glyph.text = "A"; }); }
        }
        // Keep a stalled ring or blocker transform from holding up the ball.
        if (!sendingBall) {
            sendingBall = true;
            report(projectile.SetLocalPosition(vector(p.x,p.y,p.z))
                .finally(() => { sendingBall = false; }));
        }
        if (sending) return;
        sending = true;
        report(Promise.all([
            hazard.SetLocalPosition(vector(x,1.748,2.48)),
            ...ringAnchors.map((anchor,i) =>
                anchor.SetLocalPosition(vector((i-1)*spacing,heights[i],ringZ)))
        ]).finally(() => { sending = false; }));
    }
    let lastPublished = -8, publishing = false;
    setInterval(() => {
        const now = performance.now();
        room.update();
        if (hold && now-hold.since > 20000) finishHold(false,true);
        const elapsed = Math.min(.10,(now-lastTime)/1000);
        lastTime = now;
        if (!room.authority) {
            if (hold && now-lastPullSent >= 85) {
                lastPullSent = now;
                report(room.action("pull",hold.power,hold.aim));
                if (now-hold.since > 1000 && viewState()?.holding !== me()) finishHold(false,true);
            }
            render(room.sample());
            return;
        }
        const {player,holding} = game.state;
        if (player && player !== me() && !Object.values(scene.users ?? {}).some(user => user.id === player))
            game.disconnect(player);
        else if (holding && holding !== me() && now-lastControl > 2500)
            game.cancel(holding);
        remainder += elapsed;
        while (remainder >= fixedStep) {
            blocker = moveBlocker(blockerPace*fixedStep);
            const previousHeights = ringHeights;
            ringHeights = moveRings(fixedStep);
            simulationTick++;
            game.step(fixedStep,blocker,previousHeights,ringHeights);
            remainder -= fixedStep;
        }
        const frame = authorityFrame();
        if (!publishing && simulationTick-lastPublished >= 8) {
            lastPublished = simulationTick;
            publishing = true;
            report(Promise.resolve(room.publish({...frame,ringMotion:moveRings.checkpoint(),
                blockerMotion:moveBlocker.checkpoint()})).finally(() => { publishing = false; }));
        }
        render(frame);
    }, 1000/30);
    console.info("Arcade Roll-Up shared runtime ready");
}
})();

