import { App, TFile } from 'obsidian';
// @ts-ignore
import moment from 'moment';

import HeatmapPlugin from './main';

export class WordCountService {
    app: App;
    plugin: HeatmapPlugin;

    constructor(app: App, plugin: HeatmapPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async getWordCounts(): Promise<Map<string, number>> {
        const files = this.app.vault.getMarkdownFiles();
        const dailyCounts = new Map<string, number>();

        const excludedList = this.plugin.settings.excludedFolders
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const file of files) {
            // Check if file is in excluded folder
            const isExcluded = excludedList.some(folder => file.path === folder || file.path.startsWith(folder + '/'));
            if (isExcluded) continue;

            const content = await this.app.vault.read(file);
            const wordCount = this.countWords(content);

            // Use modification time as the "date"
            const date = moment(file.stat.mtime).format('YYYY-MM-DD');

            const currentCount = dailyCounts.get(date) || 0;
            dailyCounts.set(date, currentCount + wordCount);
        }

        return dailyCounts;
    }

    countWords(text: string): number {
        // Strip frontmatter
        const withoutFrontmatter = text.replace(/^---\n[\s\S]*?\n---\n/, '');
        // Strip codeblocks
        const withoutCodeBlocks = withoutFrontmatter.replace(/```[\s\S]*?```/g, '');
        // Simple regex for word count. 
        return withoutCodeBlocks.split(/\s+/).filter(w => w.length > 0).length;
    }
}
