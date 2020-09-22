import vscode from 'vscode';
import Log, { IDescriptor } from '../../Log';

import ArgTreeItem from './tree-items/ArgTreeItem';
import LogTreeItem from './tree-items/LogTreeItem';
import PathTreeItem from './tree-items/PathTreeItem';
import PropTreeItem from './tree-items/PropTreeItem';
import settings from '../../Settings';
import { setEmitFlags } from 'typescript';
// import logger from '../Logger';

interface IPathLog {
	[key: string]: IPathLog | Log[];
}

type MaybeLog = vscode.TreeItem | undefined;

class Sidebar implements vscode.TreeDataProvider<vscode.TreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<MaybeLog> = new vscode.EventEmitter<
		MaybeLog
	>();
	readonly onDidChangeTreeData: vscode.Event<MaybeLog> = this._onDidChangeTreeData.event;
	private sortedLogs: IPathLog = {};

	constructor() {
		settings.on('update', this.refresh);
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	// TODO vscode need Promise, but TreeDataProvider Thenable
	async getChildren(parentElement: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
		if (parentElement) {
			if (parentElement instanceof PathTreeItem) {
				const { value } = parentElement;

				if (parentElement)
					if (Array.isArray(value)) {
						// logs
						return Promise.resolve(
							value.map((log: Log) => {
								const first = log.args[0];
								const preview = log.getPreview(first);
								return log.args.length > 1
									? new LogTreeItem(log)
									: new ArgTreeItem(log, preview);
							})
						);
					}

				// include dirs
				return Promise.resolve(
					Object.keys(value).map((path) => new PathTreeItem(path, value[path]))
				);
			}

			if (parentElement instanceof LogTreeItem) {
				const preview = parentElement.log.preview;
				return Promise.resolve(
					preview.map((arg) => new ArgTreeItem(parentElement.log, arg))
				);
			}

			if (parentElement instanceof ArgTreeItem || parentElement instanceof PropTreeItem) {
				const id = parentElement.preview.objectId;
				if (id) {
					try {
						const response = await parentElement.log.getProps(parentElement.preview);
						if (response) {
							return Promise.resolve(
								response
									.filter(({ descriptor }) => {
										const { showEnumerable } = settings.editor;

										if (showEnumerable) {
											return true;
										}

										return descriptor.enumerable;
									})
									.sort((a, b) => {
										if (a.name.startsWith('__')) return 1;
										if (b.name.startsWith('__')) return -1;
										return a.name > b.name ? 1 : -1;
									})
									.map(
										({ name, preview, descriptor }) =>
											new PropTreeItem(
												parentElement.log,
												name,
												preview,
												Object.keys(descriptor)
													.map((key) => `${key}: ${descriptor[key as keyof IDescriptor]}`)
													.join('\n')
											)
									)
							);
						}
					} catch (err) {
						console.error(err);
					}
				}
			}

			return Promise.resolve([]);
		} else {
			// root dirs
			return Promise.resolve(
				Object.keys(this.clearEmptyFields(this.sortedLogs)).map(
					(el) => new PathTreeItem(el, this.sortedLogs[el])
				)
			);
		}
	}

	private clearEmptyFields(obj: IPathLog): IPathLog {
		return obj;
		Object.keys(obj).forEach((key) => {});
	}

	add = (log: Log) => {
		this.reduceLogByPath(log, this.sortedLogs);
		this.refresh();
	};

	reduceLogByPath(log: Log, logsContainer: IPathLog): IPathLog {
		const pathArr = log.originalPosition.source.split('/').filter((el) => el);

		return pathArr.reduce((obj, path, id, arr) => {
			const existLogs = obj[path];
			const isLast = !arr[id + 1];

			if (existLogs) {
				if (Array.isArray(existLogs)) {
					existLogs.push(log);
					return obj;
				}

				return existLogs;
			}

			if (!isLast) {
				const nextPathObj = {};
				obj[path] = nextPathObj;
				return nextPathObj;
			}

			obj[path] = [log];
			return obj;
		}, logsContainer);
	}

	private clearLogsInObject(obj: IPathLog) {
		Object.keys(obj).forEach((key) => {
			const value = obj[key];

			if (Array.isArray(value)) {
				obj[key] = [];
				return;
			}

			this.clearLogsInObject(value);
		});
	}

	reset = () => {
		this.clearLogsInObject(this.sortedLogs);
	};

	refresh = () => {
		this._onDidChangeTreeData.fire(undefined);
	};
}

export default Sidebar;
