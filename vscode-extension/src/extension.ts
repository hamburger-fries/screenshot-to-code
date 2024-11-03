import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('screenshot-to-code.generateComponent', async (uri: vscode.Uri) => {
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

    context.subscriptions.push(disposable);
}

export function deactivate() {}
