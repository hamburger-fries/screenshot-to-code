import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

class SettingsPanel {
    private static currentPanel: vscode.WebviewPanel | undefined;

    public static createOrShow(context: vscode.ExtensionContext) {
        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel.reveal(columnToShowIn);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'happyDayzSettings',
            'Happy Dayz Settings',
            columnToShowIn || vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

        SettingsPanel.currentPanel = panel;
        panel.webview.html = SettingsPanel.getWebviewContent();

        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.type) {
                    case 'saveApiKey':
                        await context.secrets.store('openai-api-key', message.value);
                        vscode.window.showInformationMessage('OpenAI API key has been saved successfully');
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        panel.onDidDispose(
            () => {
                SettingsPanel.currentPanel = undefined;
            },
            null,
            context.subscriptions
        );
    }

    private static getWebviewContent() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Happy Dayz Settings</title>
            <style>
                body {
                    padding: 20px;
                    color: var(--vscode-foreground);
                    font-family: var(--vscode-font-family);
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                }
                .form-group {
                    margin-bottom: 20px;
                }
                label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: bold;
                }
                input {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--vscode-input-border);
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                }
                .base-url {
                    padding: 8px;
                    background: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-textBlockQuote-border);
                    margin-bottom: 8px;
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    cursor: pointer;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .note {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>OpenAI Configuration</h2>
                
                <div class="form-group">
                    <label>Base URL:</label>
                    <div class="base-url">${OPENAI_BASE_URL}</div>
                    <div class="note">This is the preset OpenAI API endpoint</div>
                </div>

                <div class="form-group">
                    <label for="apiKey">API Key:</label>
                    <input type="password" id="apiKey" placeholder="sk-..." />
                    <div class="note">Your API key will be securely stored in VS Code's secret storage</div>
                    <button onclick="saveApiKey()">Save API Key</button>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function saveApiKey() {
                    const apiKey = document.getElementById('apiKey').value;
                    if (!apiKey) {
                        vscode.postMessage({ type: 'error', message: 'API key is required' });
                        return;
                    }
                    if (!apiKey.startsWith('sk-')) {
                        vscode.postMessage({ type: 'error', message: 'API key should start with sk-' });
                        return;
                    }
                    vscode.postMessage({ type: 'saveApiKey', value: apiKey });
                    document.getElementById('apiKey').value = '';
                }
            </script>
        </body>
        </html>`;
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Register settings command
    let openSettingsCommand = vscode.commands.registerCommand('happy-dayz.openSettings', () => {
        SettingsPanel.createOrShow(context);
    });

    // Register the main component generation command
    let generateCommand = vscode.commands.registerCommand('happy-dayz.generateComponent', async (uri: vscode.Uri) => {
        // First check if API key is set
        const apiKey = await context.secrets.get('openai-api-key');
        if (!apiKey) {
            const response = await vscode.window.showErrorMessage(
                'OpenAI API key not found. Would you like to set it now?',
                'Yes',
                'No'
            );
            if (response === 'Yes') {
                SettingsPanel.createOrShow(context);
                return;
            } else {
                return;
            }
        }

        try {
            if (!uri) {
                // If no URI is provided (command palette usage), show file picker
                const files = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        'Images': ['png', 'jpg', 'jpeg', 'gif']
                    }
                });
                
                if (!files || files.length === 0) {
                    return;
                }
                
                uri = files[0];
            }

            // Read the image file
            const imageBuffer = fs.readFileSync(uri.fsPath);
            const base64Image = imageBuffer.toString('base64');

            // Create component name from file name
            const fileName = path.basename(uri.fsPath, path.extname(uri.fsPath));
            const componentName = fileName
                .split('-')
                .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
                .join('');

            // Generate React component template
            const componentContent = `import React from 'react';

export const ${componentName}: React.FC = () => {
    return (
        <div className="container p-4 mx-auto">
            {/* Generated component from screenshot */}
            <div className="p-6 bg-white rounded-lg shadow-lg">
                <h1 className="mb-4 text-2xl font-bold">Generated Component</h1>
                {/* Add your Tailwind CSS styled elements here */}
            </div>
        </div>
    );
};

export default ${componentName};
`;

            // Get the workspace folder
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }

            // Create components directory if it doesn't exist
            const componentsDir = path.join(workspaceFolder.uri.fsPath, 'components');
            if (!fs.existsSync(componentsDir)) {
                fs.mkdirSync(componentsDir, { recursive: true });
            }

            // Write the component file
            const componentPath = path.join(componentsDir, `${componentName}.tsx`);
            fs.writeFileSync(componentPath, componentContent);

            // Open the generated component
            const document = await vscode.workspace.openTextDocument(componentPath);
            await vscode.window.showTextDocument(document);

            vscode.window.showInformationMessage(`Component ${componentName} generated successfully!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Error generating component: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });

    context.subscriptions.push(openSettingsCommand, generateCommand);
}

export function deactivate() {}
