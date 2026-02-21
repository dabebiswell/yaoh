import { App, TFile } from 'obsidian';
// @ts-ignore
import moment from 'moment';

export class WordCountService {
    app: App;

    constructor(app: App) {
        this.app = app;
    }

    async getWordCounts(): Promise<Map<string, number>> {
        const files = this.app.vault.getMarkdownFiles();
        const dailyCounts = new Map<string, number>();

        for (const file of files) {
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
