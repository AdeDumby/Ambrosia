import { BrowserWindow, app } from "electron";
import path from "node:path";
//#region electron/main.ts
function createWindow() {
	const win = new BrowserWindow({
		width: 1e3,
		height: 700,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
	else win.loadFile(path.join(app.getAppPath(), "dist/index.html"));
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
//#endregion
export {};
