import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { HeatmapView, HEATMAP_VIEW_TYPE } from './HeatmapView';
import { WordCountService } from './WordCountService';

// Settings Interface
interface HeatmapSettings {
    colorThresholds: number[];
    showDayLabels: boolean;
    showMonthLabels: boolean;
    dailyNoteOnClick: boolean;
    customColor: string;
    excludedFolders: string;
    trackingMode: 'words' | 'tasks';
}

const DEFAULT_SETTINGS: HeatmapSettings = {
    colorThresholds: [100, 500, 1000, 2000],
    showDayLabels: false,
    showMonthLabels: false,
    dailyNoteOnClick: false,
    customColor: '',
    excludedFolders: '',
    trackingMode: 'words'
}

export default class HeatmapPlugin extends Plugin {
    settings: HeatmapSettings;
    service: WordCountService;

    async onload() {
        await this.loadSettings();

        this.service = new WordCountService(this.app, this);

        // Register the View
        this.registerView(
            HEATMAP_VIEW_TYPE,
            (leaf) => new HeatmapView(leaf, this, this.service)
        );

        // Add Ribbon Icon
        this.addRibbonIcon('flame', 'Open Heatmap', () => {
            this.activateView();
        });

        // Add Command
        this.addCommand({
            id: 'open-heatmap-view',
            name: 'Open Heatmap',
            callback: () => {
                this.activateView();
            }
        });

        // Add Settings Tab
        this.addSettingTab(new HeatmapSettingTab(this.app, this));
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(HEATMAP_VIEW_TYPE);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Our view could not be found in the workspace, create a new leaf
            // in the right sidebar
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: HEATMAP_VIEW_TYPE, active: true });
        }

        // "Reveal" the leaf in case it is in a collapsed sidebar
        workspace.revealLeaf(leaf);
    }

    onunload() {

    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    refreshViews() {
        this.app.workspace.getLeavesOfType(HEATMAP_VIEW_TYPE).forEach(leaf => {
            if (leaf.view instanceof HeatmapView) {
                leaf.view.loadData();
            }
        });
    }
}

class HeatmapSettingTab extends PluginSettingTab {
    plugin: HeatmapPlugin;

    constructor(app: App, plugin: HeatmapPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'YAOH Settings' });

        new Setting(containerEl)
            .setName('Tracking Mode')
            .setDesc('Choose whether to track written words or completed tasks (- [x]).')
            .addDropdown(drop => drop
                .addOption('words', 'Word Count')
                .addOption('tasks', 'Completed Tasks')
                .setValue(this.plugin.settings.trackingMode)
                .onChange(async (value: 'words' | 'tasks') => {
                    this.plugin.settings.trackingMode = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshViews();
                }));

        new Setting(containerEl)
            .setName('Open Daily Note on Click')
            .setDesc('If enabled, clicking a cell will attempt to open the Daily Note for that date instead of searching.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.dailyNoteOnClick)
                .onChange(async (value) => {
                    this.plugin.settings.dailyNoteOnClick = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshViews();
                }));

        new Setting(containerEl)
            .setName('Show Day Labels')
            .setDesc('Show Mon/Wed/Fri on the left side.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showDayLabels)
                .onChange(async (value) => {
                    this.plugin.settings.showDayLabels = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshViews();
                }));

        new Setting(containerEl)
            .setName('Show Month Labels')
            .setDesc('Show month names along the top.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showMonthLabels)
                .onChange(async (value) => {
                    this.plugin.settings.showMonthLabels = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshViews();
                }));

        new Setting(containerEl)
            .setName('Custom Base Color')
            .setDesc('Leave blank to use your theme\'s accent color, or enter a valid CSS color (e.g., #40c463, rgb(0, 200, 0), red) to customize the gradient base.')
            .addText(text => text
                .setPlaceholder('Theme accent')
                .setValue(this.plugin.settings.customColor)
                .onChange(async (value) => {
                    this.plugin.settings.customColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshViews();
                }));

        new Setting(containerEl)
            .setName('Excluded Folders')
            .setDesc('Comma-separated list of folders to exclude from word counting (e.g. Templates, Assets/Images).')
            .addText(text => text
                .setPlaceholder('Templates, Assets')
                .setValue(this.plugin.settings.excludedFolders)
                .onChange(async (value) => {
                    this.plugin.settings.excludedFolders = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshViews();
                }));

        containerEl.createDiv({ text: 'Define the word count thresholds for each intensity level.' });

        new Setting(containerEl)
            .setName('Level 1 (Low Intensity)')
            .setDesc('Minimum words to reach level 1')
            .addText(text => text
                .setPlaceholder('100')
                .setValue(String(this.plugin.settings.colorThresholds[0]))
                .onChange(async (value) => {
                    const val = parseInt(value);
                    if (!isNaN(val)) {
                        this.plugin.settings.colorThresholds[0] = val;
                        await this.plugin.saveSettings();
                        this.plugin.refreshViews();
                    }
                }));

        new Setting(containerEl)
            .setName('Level 2 (Moderate Intensity)')
            .setDesc('Minimum words to reach level 2')
            .addText(text => text
                .setPlaceholder('500')
                .setValue(String(this.plugin.settings.colorThresholds[1]))
                .onChange(async (value) => {
                    const val = parseInt(value);
                    if (!isNaN(val)) {
                        this.plugin.settings.colorThresholds[1] = val;
                        await this.plugin.saveSettings();
                        this.plugin.refreshViews();
                    }
                }));

        new Setting(containerEl)
            .setName('Level 3 (High Intensity)')
            .setDesc('Minimum words to reach level 3')
            .addText(text => text
                .setPlaceholder('1000')
                .setValue(String(this.plugin.settings.colorThresholds[2]))
                .onChange(async (value) => {
                    const val = parseInt(value);
                    if (!isNaN(val)) {
                        this.plugin.settings.colorThresholds[2] = val;
                        await this.plugin.saveSettings();
                        this.plugin.refreshViews();
                    }
                }));

        new Setting(containerEl)
            .setName('Level 4 (Extreme Intensity)')
            .setDesc('Minimum words to reach level 4')
            .addText(text => text
                .setPlaceholder('2000')
                .setValue(String(this.plugin.settings.colorThresholds[3]))
                .onChange(async (value) => {
                    const val = parseInt(value);
                    if (!isNaN(val)) {
                        this.plugin.settings.colorThresholds[3] = val;
                        await this.plugin.saveSettings();
                        this.plugin.refreshViews();
                    }
                }));
    }
}
