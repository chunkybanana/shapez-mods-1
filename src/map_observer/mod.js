import { globalConfig } from "core/config";
import { Camera } from "game/camera";
import { keyToKeyCode } from "game/key_action_mapper";
import { THEMES } from "game/theme";
import { Mod } from "mods/mod";
import { StorageImplElectron } from "platform/electron/storage";
import info from "./mod.json";
import { MapObserverSettingsState } from "./settings";
import settingsCSS from "./settings.less";
import { internalUpdateZooming } from "./smooth_zoom";

const defaultSettings = {
    minZoom: 0.6,
    useHotkeys: false,
    smoothZoom: true,
    smoothZoomSpeed: 1,
    customizeGrid: false,
    gridBackground: "#1a2b19",
    gridForeground: "#243d23"
};

const vanillaThemeMapColors = {};

class MapObserver extends Mod {
    init() {
        this.modInterface.registerCss(settingsCSS);

        this.storage = new StorageImplElectron(this.app);
        this.settingsFile = this.metadata.id + "_settings.json";
        this.saveSettings = () => this.saveCustomSettings();

        const settingsPromise = this.prepareSettings();
        const appBootedPromise = new Promise((resolve) => {
            this.signals.appBooted.add(resolve);
        });

        this.modInterface.registerIngameKeybinding({
            id: "map_observer_toggle",
            keyCode: keyToKeyCode("U"),
            translation: "Toggle Map View",
            handler: this.toggleMapView.bind(this)
        });

        this.modInterface.registerIngameKeybinding({
            id: "map_observer_set_min_zoom",
            keyCode: keyToKeyCode("I"),
            translation: "Zoom out as much as possible in Regular View",
            handler: this.toggleMinZoom.bind(this)
        });

        const mod = this;
        this.modInterface.replaceMethod(
            Camera,
            "internalUpdateZooming",
            function (srcMethod, [now, dt]) {
                if (!mod.settings.smoothZoom) {
                    return srcMethod(now, dt);
                }

                internalUpdateZooming.call(
                    this,
                    dt * mod.settings.smoothZoomSpeed
                );
            }
        );

        Promise.all([settingsPromise, appBootedPromise]).then(
            this.onReady.bind(this)
        );
    }

    async prepareSettings() {
        this.settings = defaultSettings;

        try {
            // Manually read settings from the file
            const stored = await this.storage.readFileAsync(this.settingsFile);
            this.settings = JSON.parse(stored);

            // Set missing settings keys
            for (const key in defaultSettings) {
                if (!(key in this.settings)) {
                    this.settings[key] = defaultSettings[key];
                }
            }
        } catch (err) {
            // Settings file doesn't exist yet (or is corrupt)
            const data = this.serializeSettings(this.settings);
            await this.storage.writeFileAsync(this.settingsFile, data);
        }
    }

    async onReady() {
        // Store vanilla theme colors so we can disable the customization
        for (const theme in THEMES) {
            vanillaThemeMapColors[theme] = {
                background: THEMES[theme].map.background,
                grid: THEMES[theme].map.grid
            };
        }

        this.modInterface.registerGameState(MapObserverSettingsState);
        this.setConfig();
        console.log("booted", this.settings);
    }

    async saveCustomSettings() {
        const data = this.serializeSettings(this.settings);
        await this.storage.writeFileAsync(this.settingsFile, data);
    }

    serializeSettings(data) {
        return JSON.stringify(data, undefined, 2);
    }

    setConfig() {
        // This is a "single line" mod, but it's useful for some people.
        globalConfig.mapChunkOverviewMinZoom = this.settings.minZoom;

        if (this.settings.useHotkeys) {
            // Start with map view off
            globalConfig.mapChunkOverviewMinZoom = 0;
        }

        if (this.settings.customizeGrid) {
            // Set our customized colors
            for (const theme in THEMES) {
                THEMES[theme].map.background = this.settings.gridBackground;
                THEMES[theme].map.grid = this.settings.gridForeground;
            }
        } else {
            // Restore vanilla colors
            for (const theme in THEMES) {
                const vanilla = vanillaThemeMapColors[theme];
                THEMES[theme].map.background = vanilla.background;
                THEMES[theme].map.grid = vanilla.grid;
            }
        }
    }

    toggleMapView() {
        if (!this.settings.useHotkeys) {
            return;
        }

        const current = globalConfig.mapChunkOverviewMinZoom;
        if (current == 0) {
            // Force map view
            globalConfig.mapChunkOverviewMinZoom = Infinity;
        } else {
            // Force normal view
            globalConfig.mapChunkOverviewMinZoom = 0;
        }
    }

    /**
     * @param {import("game/root").GameRoot} root
     */
    toggleMinZoom(root) {
        if (!Number.isFinite(globalConfig.mapChunkOverviewMinZoom)) {
            // Only map view can be used
            return;
        }

        root.camera.desiredZoom = globalConfig.mapChunkOverviewMinZoom;
    }
}

registerMod(MapObserver, info);
