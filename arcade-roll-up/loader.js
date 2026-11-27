(() => {
    "use strict";
    const source = document.currentScript?.src;
    if (!source || window.arcadeRollUpLoaderStarted) return;
    window.arcadeRollUpLoaderStarted = true;
    const manifestUrl = new URL("./manifest.json", source);

    function vectorAttribute(element, attribute, fallback) {
        const raw = element.getAttribute(attribute);
        if (!raw) return fallback;
        const values = raw.trim().split(/\s+/).map(Number);
        if (values.length !== 3 || !values.every(Number.isFinite))
            throw new Error("Invalid Arcade Roll-Up " + attribute);
        return values;
    }

    async function mount() {
        const placement = document.querySelector('bs-snippet[name="arcade-roll-up"]');
        if (!placement) return;
        const response = await fetch(manifestUrl, {cache:"no-store"});
        if (!response.ok) throw new Error("Release manifest returned HTTP " + response.status);
        const manifest = await response.json();
        if (manifest.schema !== 1 || typeof manifest.version !== "string" ||
            !/^\d+\.\d+\.\d+(?:-[a-z\d.-]+)?$/i.test(manifest.version))
            throw new Error("Invalid Arcade Roll-Up release manifest");
        const base = new URL("./releases/" + manifest.version + "/", manifestUrl);
        const scene = BS.Scene.GetInstance();
        await scene.WaitForUnityLoaded();
        const position = vectorAttribute(placement,"position",[0,0,0]);
        const rotation = vectorAttribute(placement,"rotation",[0,0,0]);
        if (rotation[0] || rotation[2]) throw new Error("Arcade Roll-Up supports Y rotation only");
        const root = new BS.GameObject({
            name:"Arcade Roll-Up snippet placement",
            localPosition:new BS.Vector3(...position),
            localEulerAngles:new BS.Vector3(...rotation)
        });
        await root.Async();
        try {
            await root.AddComponent(new BS.AssetBundle(
                new URL("arcade-roll-up-windows.bundle",base).href, "", "",
                new URL("arcade-roll-up-android.bundle",base).href));
            await root.AddComponent(new BS.KitItem("assets/arcade roll-up cabinet.prefab"));
            let cabinet;
            for (let attempt=0; !cabinet && attempt<40; attempt++) {
                cabinet = await root.Find("Arcade Roll-Up Cabinet(Clone)") ??
                    await root.Find("Arcade Roll-Up Cabinet");
                if (!cabinet) await new Promise(resolve => setTimeout(resolve,100));
            }
            if (!cabinet) throw new Error("Could not find the loaded Arcade Roll-Up cabinet");
            await new Promise((resolve,reject) => {
                const script = document.createElement("script");
                script.src = new URL("arcade-roll-up.js",base).href;
                script.dataset.arcadeRollUpMode = "snippet";
                script.onload = resolve;
                script.onerror = () => reject(new Error("Could not load the Arcade Roll-Up runtime"));
                document.head.append(script);
            });
            await window.ArcadeRollUpStart(cabinet);
        } catch (error) {
            root.Destroy();
            throw error;
        }
    }

    const start = () => mount().catch(error => console.error("Arcade Roll-Up snippet",error));
    if (window.BS?.Scene) start();
    else window.addEventListener("bs-loaded",start,{once:true});
})();
