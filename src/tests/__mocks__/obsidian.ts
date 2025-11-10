/**
 * Mock Obsidian API for testing
 */

export class App {
	vault: any;
	workspace: any;
}

export class Plugin {
	app: App;
	manifest: any;

	constructor(app: App, manifest: any) {
		this.app = app;
		this.manifest = manifest;
	}

	loadData(): Promise<any> {
		return Promise.resolve({});
	}

	saveData(_data: any): Promise<void> {
		return Promise.resolve();
	}
}

export class PluginSettingTab {
	app: App;
	plugin: Plugin;

	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
	}

	display(): void {}
	hide(): void {}
}

export class Notice {
	constructor(_message: string) {}
}

export class Modal {
	app: App;

	constructor(app: App) {
		this.app = app;
	}

	open(): void {}
	close(): void {}
	onOpen(): void {}
	onClose(): void {}
}

export class ItemView {
	app: App;

	constructor(_leaf: any) {
		this.app = new App();
	}

	getViewType(): string {
		return '';
	}

	getDisplayText(): string {
		return '';
	}

	onOpen(): Promise<void> {
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		return Promise.resolve();
	}
}

export class Setting {
	setName(_name: string): this {
		return this;
	}

	setDesc(_desc: string): this {
		return this;
	}

	addText(cb: (text: any) => any): this {
		cb({
			setPlaceholder: () => ({ setValue: () => ({ onChange: () => {} }) })
		});
		return this;
	}

	addToggle(cb: (toggle: any) => any): this {
		cb({
			setValue: () => ({ onChange: () => {} })
		});
		return this;
	}

	addDropdown(cb: (dropdown: any) => any): this {
		cb({
			addOption: () => ({ setValue: () => ({ onChange: () => {} }) })
		});
		return this;
	}

	addButton(cb: (button: any) => any): this {
		cb({
			setButtonText: () => ({ onClick: () => {} })
		});
		return this;
	}
}

export interface RequestUrlParam {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
	throw?: boolean;
}

export interface RequestUrlResponse {
	status: number;
	headers: Record<string, string>;
	arrayBuffer: ArrayBuffer;
	json: any;
	text: string;
}

export const requestUrl = async (
	_request: string | RequestUrlParam
): Promise<RequestUrlResponse> => {
	throw new Error('requestUrl should be mocked in tests');
};

export const normalizePath = (path: string): string => {
	return path.replace(/\\/g, '/');
};

export const moment = (_date?: any): any => {
	return {
		format: (_format: string) => new Date().toISOString()
	};
};

export class TFile {
	path: string;
	basename: string;
	extension: string;
	stat: any;

	constructor(path: string) {
		this.path = path;
		this.basename = path.split('/').pop() || '';
		this.extension = this.basename.split('.').pop() || '';
		this.stat = { ctime: Date.now(), mtime: Date.now() };
	}
}

export class TFolder {
	path: string;
	children: any[];

	constructor(path: string) {
		this.path = path;
		this.children = [];
	}
}
