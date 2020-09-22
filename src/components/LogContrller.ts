import vscode, { workspace, window } from 'vscode';

import Log from './Log';
import Sidebar from './ui/Sidebar/';
import Decorator from './ui/Decorator';

export default class LogController {
	private logs: Log[] = [];
	private sidebar: Sidebar;
	private decorator: Decorator;
	private listeners: vscode.Disposable[] = [];
	private isLoad = false;

	constructor() {
		this.sidebar = new Sidebar();
		this.listeners.push(
			vscode.window.registerTreeDataProvider('browser-console-view', this.sidebar)
		);

		this.decorator = new Decorator();
		workspace.onDidChangeTextDocument(
			() => this.decorator.onChange(this.logs),
			null,
			this.listeners
		);

		window.onDidChangeActiveTextEditor(
			() => this.decorator.onChange(this.logs),
			null,
			this.listeners
		);

		workspace.onWillSaveTextDocument(this.onUpdate, null, this.listeners);
	}

	onLog = (log: Log) => {
		this.logs.push(log);

		if (this.isLoad) {
			this.sidebar.add(log);
			this.decorator.onChange([log]);
		}
	};

	onUpdate = () => {
		this.logs = [];
		this.sidebar.reset();
		this.decorator.reset();
		this.isLoad = false;
	};

	onLoad = () => {
		this.logs.forEach(this.sidebar.add);
		this.decorator.onChange(this.logs);
		this.isLoad = true;
	};

	removeListeners() {
		this.listeners.forEach((listener) => listener.dispose());
	}
}
