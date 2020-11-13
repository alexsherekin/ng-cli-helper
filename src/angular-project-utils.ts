import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {ComponentConfig, ComponentSettings} from './interfaces/component.config';
import {Logger} from './logger';
import {TerminalUtils} from './terminal-utils';

const logger = Logger.getInstance('Angular Project Reader');

type AngularComponentType = 'Component' | 'Directive' | 'Service' | 'Module' | 'Pipe';

export class AngularProjectReader {
	private componentConfig = vscode.workspace.getConfiguration("ng-cli-helper.component") as unknown as (undefined | ComponentConfig);

	/**
	 * returns a promise that resolves to the angular.json file if it exists else undefined
	 */
	public async getAngularJSONFile(): Promise<undefined | vscode.Uri> {
		// check if work space has a angular.json file
		const angularJsonFiles = await vscode.workspace.findFiles("**/angular.json", "**/node_modules/**");

		if (!angularJsonFiles || angularJsonFiles.length === 0) {
			logger.debug(`no angular.json file found in workspace`);
			return Promise.resolve(undefined);
		}

		logger.debug(`angular.json file found in workspace at [${angularJsonFiles[0].fsPath}]`);
		return Promise.resolve(angularJsonFiles[0]);
	}

	/**
	 * @description returns the path to be used in the cli command and project context to run the cli
	 *  based on the folder on
	 * which the user has clicked after reading the project config from angular.json provided
	 * @param angularJsonFile
	 * @param folderPath
	 */
	public async getCLIPathBasedOnUserClick(angularJsonFile: vscode.Uri, folderPath: string): Promise<{path: string, project: string}> {
		// read the angular.json file
		const angularJSONFileContents = await this.readFile(angularJsonFile.fsPath, true);
		// get project src root from selected folder
		const projectSrcRoot = this.getProjectSourceRootFromPath(folderPath);
		// get project with projectSrcRoot
		const project = this.getProjectNameWithSrcRoot(angularJSONFileContents, projectSrcRoot);
		// get path to be used in cli command
		const commandPath = this.getCliCommandPathFromFullPath(folderPath);
		return {path: commandPath, project: project};
	}

	/**
	 * generates a component of given type at given path
	 */
	public generateAngularComponent(type: AngularComponentType, path: string, project: string, addRouting: boolean = true) {
		switch (type) {
			case "Component": {
				TerminalUtils.createTerminal('ng Helper', `ng g c ${path} ${this.getProjectParam(project)} ${this.getComponentParams()}`);
				break;
			}
			case "Module":
				if (addRouting) {
					TerminalUtils.createTerminal('ng Helper', `ng g m --routing="true" ${path} ${this.getProjectParam(project)}`);
				} else {
					TerminalUtils.createTerminal('ng Helper', `ng g m ${path} ${this.getProjectParam(project)}`);
				}
				break;
			case "Service":
				TerminalUtils.createTerminal('ng Helper', `ng g s ${path} ${this.getProjectParam(project)}`);
				break;
			case "Directive":
				TerminalUtils.createTerminal('ng Helper', `ng g d ${path} ${this.getProjectParam(project)}`);
				break;
			case "Pipe":
				TerminalUtils.createTerminal('ng Helper', `ng g p ${path} ${this.getProjectParam(project)}`);
				break;
		}
	}

	/**
	 * checks for the project param passed and returns a project param that can be passed to cli
	 * if empty project param was passed return empty string
	 */
	private getProjectParam(projectName: string): string {
		if (projectName && projectName !== '') {
			return `--project="${projectName}"`;
		}
		return '';
	}

	private getComponentParams(): string {
		const settings: Partial<ComponentSettings> = {
			"change-detection": this.componentConfig?.get("change-detection"),
			"display-block": this.componentConfig?.get("display-block"),
			"inline-template": this.componentConfig?.get("inline-template"),
			"inline-style": this.componentConfig?.get("inline-style"),
			"prefix": this.componentConfig?.get("prefix"),
			"style": this.componentConfig?.get("style"),
			"view-encapsulation": this.componentConfig?.get("view-encapsulation"),
		};

		return Object.entries(settings)
			.filter(entries => !!entries[1])
			.map(entries => `--${entries[0]}=${entries[1]}`)
			.join(" ");
	}

	/**
	 * @description returns the path to be used in cli command from full selected folder path
	 */
	private getCliCommandPathFromFullPath(folderPath: string): string {
		let commandPath = folderPath.substring(folderPath.indexOf('app') + 3);
		commandPath = this.removeLeadingAndTrailingSlashes(commandPath);
		logger.debug(`returning command path as [${commandPath}] for path [${folderPath}]`);
		return commandPath;
	}

	/**
	 * @description returns string after removing any leading and trailing slashes
	 * // TODO find better approach
	 */
	private removeLeadingAndTrailingSlashes(rawString: string): string {
		if (rawString.length === 0) {
			return '';
		}
		logger.debug(`removing slashes from ${rawString}`);
		rawString = path.normalize(rawString);
		rawString = rawString.startsWith('\\') || rawString.startsWith('/') ? rawString.substring(1) : rawString;
		rawString = rawString.endsWith('\\') || rawString.endsWith('/') ? rawString.substring(0, rawString.length - 1) : rawString;
		logger.debug(`returning path after normalizing [${rawString}]`);
		return rawString;
	}

	/**
	 * returns the name of the project which as given projectSrcRoot and empty if reuired project is default
	 * project
	 */
	private getProjectNameWithSrcRoot(angularJSONContents: any, srcRoot: string): string {
		// get projects
		const projects = angularJSONContents.projects;
		logger.debug(`the projects in this workspace are`, projects);
		// get default project name
		const defaultProject = angularJSONContents.defaultProject;
		logger.debug(`default project for this project is [${defaultProject}]`);
		// get required project
		const requiredProject = Object.keys(projects).find(projectName => {
			logger.debug(`checking project [${projectName}] which has a srcRoot of [${projects[projectName].sourceRoot}]`);
			return this.arePathsEqual(projects[projectName].sourceRoot, srcRoot);
		});
		if (!requiredProject) {
			console.error(`No project found with source root [${srcRoot}]`);
			throw new Error('no project found with given srcRootPath');
		}
		logger.debug(`the required project is [${requiredProject}]`);
		if (requiredProject === defaultProject) {
			logger.debug(`the selected project is default project`);
			return '';
		}
		return requiredProject;
	}

	/**
	 * checks if two paths are equal
	 */
	private arePathsEqual(path1: string, path2: string): boolean {
		return path.normalize(path1).replace(/\\/g, '/') === path.normalize(path2).replace(/\\/g, '/');
	}

	/**
	 * returs the project soure root path from the given path
	 */
	private getProjectSourceRootFromPath(folderPath: string): string {
		if (!vscode.workspace.workspaceFolders) {
			return '';
		}

		logger.debug(`calculating project src path for [${folderPath}]`);
		const workSpaceFolderPath = vscode.workspace.workspaceFolders[0];
		logger.debug(`work space root is [${workSpaceFolderPath.uri.fsPath}]`);
		// remove workspace root path
		folderPath = folderPath.substring(workSpaceFolderPath.uri.fsPath.length);
		// remove path appearing after app
		folderPath = folderPath.substring(0, folderPath.indexOf('app'));
		// remove trailing and leading slashes if any
		folderPath = this.removeLeadingAndTrailingSlashes(folderPath);
		logger.debug(`project src calculated is [${folderPath}]`);
		return folderPath;
	}

	/**
	 * reads a file from the given path and returns the content
	 */
	private async readFile(filePath: string, asJson: boolean): Promise<Object>;
	private async readFile(filePath: string, asJson: boolean = false): Promise<string> {
		return new Promise((resolve) => {
			fs.readFile(path.normalize(filePath), (err, data) => {
				if (data) {
					if (asJson) {
						resolve(JSON.parse(data.toString()));
					} else {
						resolve(data.toString());
					}
				}
			});
		});
	}
}
