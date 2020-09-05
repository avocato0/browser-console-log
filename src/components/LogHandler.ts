import vscode, { workspace, window } from 'vscode';

import config from '../config';
import Log, { Position } from './Log';
import { link } from 'fs';

export interface DecoratorContainer {
	path: string;
	decorator: vscode.TextEditorDecorationType;
}

export default class LogHandler {
	private logs: Log[] = [];
	private decorators: DecoratorContainer[] = [];
	private rootPathCache: vscode.Uri | undefined;
	private activeEditor: vscode.TextEditor | undefined = window.activeTextEditor;

	constructor(context: vscode.ExtensionContext) {
		workspace.onDidChangeTextDocument(
			(editor) => {
				if (this.decorators.length && editor.document.isDirty) {
					this.resetFile(editor.document.uri.path);
				}

				if (!editor.document.isDirty) {
					this.showLogsInText(this.logs);
				}
			},
			null,
			context.subscriptions
		);

		window.onDidChangeActiveTextEditor(
			(editor) => {
				this.activeEditor = editor;
				this.showLogsInText(this.logs);
			},
			null,
			context.subscriptions
		);

		workspace.onWillSaveTextDocument(this.reset, null, context.subscriptions);
	}

	private get rootPath(): vscode.Uri {
		if (!this.rootPathCache) {
			const path = workspace.rootPath;

			if (!path) {
				throw Error('Workspase is empty!');
			}

			this.rootPathCache = vscode.Uri.file(workspace.rootPath as string);
		}
		return this.rootPathCache;
	}

	private getDecorator(contentText: string) {
		return window.createTextEditorDecorationType({
			isWholeLine: true,
			border: '1px solid red',
			after: { margin: '0 0 0 1rem', contentText, color: 'red' },
		});
	}

	private getRange(line: number) {
		line = +line - 1;
		return new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, 0));
	}

	private getPathOfRoot(path: string): string {
		return vscode.Uri.joinPath(this.rootPath, path).path;
	}

	add = (log: Log) => {
		this.logs.push(log);
		this.showLogsInText([log]);
	};

	reset = () => {
		this.decorators = this.decorators.filter(({ decorator }) => {
			decorator.dispose();
		});
		this.logs = [];
	};

	resetFile = (path: string) => {
		this.decorators = this.decorators.filter(({ decorator, path: logPath }) => {
			if (logPath !== path) {
				return true;
			}

			decorator.dispose();
		});
		this.logs = this.logs.filter(
			({ originalPosition }) => path !== this.getPathOfRoot(originalPosition.source)
		);
	};

	private showLogsInText(logs: Log[]) {
		if (!this.activeEditor || this.activeEditor.document.isDirty) {
			return;
		}

		const documentPath = (this.activeEditor as vscode.TextEditor).document.uri.path;

		logs.forEach((log) => {
			const absolutLogPath = this.getPathOfRoot(log.originalPosition.source);

			if (documentPath !== absolutLogPath) {
				return;
			}

			const decorator = this.getDecorator(log.preview);
			const range = [this.getRange(log.originalPosition.line)];
			(this.activeEditor as vscode.TextEditor).setDecorations(decorator, range);

			this.decorators.push({
				decorator,
				path: absolutLogPath,
			});
		});
	}
}
