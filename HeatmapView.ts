import { ItemView, WorkspaceLeaf, App, Notice, TFile } from 'obsidian';
import { WordCountService } from './WordCountService';
import HeatmapPlugin from './main';
// @ts-ignore
import moment from 'moment';

export const HEATMAP_VIEW_TYPE = 'yaoh-view';

export class HeatmapView extends ItemView {
    service: WordCountService;
    plugin: HeatmapPlugin;

    renderId: number = 0;
    cachedData: Map<string, number> | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: HeatmapPlugin, service: WordCountService) {
        super(leaf);
        this.plugin = plugin;
        this.service = service;
    }

    getViewType() {
        return HEATMAP_VIEW_TYPE;
    }

    getDisplayText() {
        return "Yet Another Obsidian Heatmap";
    }

    getIcon() {
        return "flame";
    }

    resizeObserver: ResizeObserver | null = null;

    async onOpen() {
        this.resizeObserver = new ResizeObserver(() => {
            this.regenerateHeatmap();
        });
        this.resizeObserver.observe(this.containerEl);
        this.loadData();
    }

    async loadData() {
        this.renderId++;
        const currentId = this.renderId;

        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('heatmap-container');

        // Show Loading UI
        const loadingContainer = container.createDiv({ cls: 'heatmap-loading-container' });
        loadingContainer.createDiv({ cls: 'heatmap-spinner' });
        loadingContainer.createDiv({ text: "Updating heatmap..." });

        // Fetch data
        const data = await this.service.getWordCounts();

        // Check for stale request
        if (this.renderId !== currentId) {
            return;
        }

        this.cachedData = data;
        this.regenerateHeatmap();
    }

    regenerateHeatmap() {
        if (!this.cachedData) {
            return;
        }

        const container = this.containerEl.children[1];
        container.empty();

        // Render Heatmap
        this.renderGrid(container, this.cachedData);
    }

    renderGrid(container: Element, data: Map<string, number>) {
        // Calculate available width
        // Assume minimal padding/gap
        const containerWidth = this.containerEl.clientWidth - 20; // -20 for padding

        const showDayLabels = this.plugin.settings.showDayLabels;
        const showMonthLabels = this.plugin.settings.showMonthLabels;
        console.log('HeatmapView: Rendering. DailyNoteOnClick:', this.plugin.settings.dailyNoteOnClick);

        const axisWidth = showDayLabels ? 25 : 0; // 20px + margin
        const weekWidth = 12; // 10px + 2px gap

        // Calculate weeks per row
        // Ensure at least 1 week to avoid infinite loops if container is tiny
        const weeksPerRow = Math.max(1, Math.floor((containerWidth - axisWidth) / weekWidth));

        const gridEl = container.createDiv({ cls: 'heatmap-grid' });

        // Rolling Year Calculation
        const today = moment();
        const oneYearAgo = moment().subtract(1, 'year');

        // Align to previous Sunday
        let currentLoopDate = moment(oneYearAgo).startOf('week');
        let lastMonth = "";

        // Collect all weeks first to make chunking easier
        const allWeeks: moment.Moment[] = [];
        const loopDate = moment(currentLoopDate);
        while (loopDate.isBefore(today) || loopDate.isSame(today, 'day')) {
            allWeeks.push(moment(loopDate));
            loopDate.add(1, 'week');
        }

        // Render Rows
        for (let i = 0; i < allWeeks.length; i += weeksPerRow) {
            const rowWeeks = allWeeks.slice(i, i + weeksPerRow);
            const rowEl = gridEl.createDiv({ cls: 'heatmap-row' });

            // --- Day Labels (Left Axis) for THIS row ---
            if (showDayLabels) {
                const axisEl = rowEl.createDiv({ cls: 'heatmap-axis-y' });

                // Spacer for Month Label alignment
                if (showMonthLabels) {
                    axisEl.createDiv({ cls: 'heatmap-month-label spacer' });
                }

                // 7 Days
                const days = ["", "Mon", "", "Wed", "", "Fri", ""];
                days.forEach(day => {
                    axisEl.createDiv({ cls: 'heatmap-day-label', text: day });
                });
            }

            // Render Weeks in this Row
            rowWeeks.forEach(weekStart => {
                const weekEl = rowEl.createDiv({ cls: 'heatmap-week' });

                // --- Month Label (Top Axis) ---
                if (showMonthLabels) {
                    const currentMonth = weekStart.format('MMM');
                    // Only show label if it changed since the LAST week (even across rows)
                    const labelText = (currentMonth !== lastMonth) ? currentMonth : "";
                    weekEl.createDiv({ cls: 'heatmap-month-label', text: labelText });

                    if (labelText) lastMonth = currentMonth;
                }

                // 7 Days per week
                const dayLoop = moment(weekStart);
                for (let d = 0; d < 7; d++) {
                    const dateStr = dayLoop.format('YYYY-MM-DD');
                    const counts = data.get(dateStr) || 0;

                    let intensity = 0;
                    if (counts > 0) {
                        const thresholds = this.plugin.settings.colorThresholds;
                        if (counts <= thresholds[0]) intensity = 1;
                        else if (counts <= thresholds[1]) intensity = 2;
                        else if (counts <= thresholds[2]) intensity = 3;
                        else intensity = 4;
                    }

                    const cell = weekEl.createDiv({
                        cls: `heatmap-cell intensity-${intensity}`,
                        attr: {
                            'aria-label': `${dateStr}: ${counts} words`,
                            'data-date': dateStr
                        }
                    });

                    // --- Click Interaction ---
                    if (this.plugin.settings.dailyNoteOnClick) {
                        cell.style.cursor = 'pointer';
                        cell.addEventListener('click', async () => {
                            const date = moment(dateStr);

                            // Try to get Daily Note settings
                            let format = 'YYYY-MM-DD';
                            let folder = '';

                            try {
                                // @ts-ignore
                                const dailyNotesPlugin = this.plugin.app.internalPlugins.getPluginById('daily-notes');
                                if (dailyNotesPlugin && dailyNotesPlugin.instance && dailyNotesPlugin.instance.options) {
                                    format = dailyNotesPlugin.instance.options.format || 'YYYY-MM-DD';
                                    folder = dailyNotesPlugin.instance.options.folder || '';
                                }
                            } catch (e) {
                                console.log('Obsidian Heatmap: Could not access Daily Notes settings, using defaults.');
                            }

                            const fileName = date.format(format);
                            const filePath = folder ? `${folder}/${fileName}.md` : `${fileName}.md`;

                            const file = this.plugin.app.vault.getAbstractFileByPath(filePath);

                            if (file instanceof TFile) {
                                await this.plugin.app.workspace.getLeaf().openFile(file);
                            } else {
                                new Notice(`No daily note found for ${dateStr}`);
                            }
                        });
                    } else {
                        cell.style.cursor = 'default';
                    }

                    dayLoop.add(1, 'day');
                }
            });
        }
    }

    async onClose() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }
}
