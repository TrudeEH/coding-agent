/**
 * /ssh command for pi.
 *
 * Usage:
 *   /ssh user@host
 *   /ssh user@host:/remote/path
 *   /ssh off
 *   /ssh status
 *
 * When enabled, read/write/edit/bash and user ! commands are executed on the
 * remote host over ssh while keeping pi itself running locally.
 */

import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	type BashOperations,
	createBashTool,
	createEditTool,
	createReadTool,
	createWriteTool,
	type EditOperations,
	type ReadOperations,
	type WriteOperations,
} from "@earendil-works/pi-coding-agent";

type SshState = { remote: string; remoteCwd: string } | null;

function shq(value: string): string {
	return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function parseTarget(input: string): { remote: string; remoteCwd?: string } {
	const arg = input.trim();
	if (!arg) throw new Error("Usage: /ssh user@host[:/path] | off | status");

	// Treat only a colon followed by /, ~, or . as a remote path separator.
	// This avoids breaking ssh aliases/options containing ':' accidentally.
	const match = arg.match(/^(.+?):([/~.].*)$/);
	if (!match) return { remote: arg };
	return { remote: match[1]!, remoteCwd: match[2]! };
}

function sshExec(remote: string, command: string, signal?: AbortSignal): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const child = spawn("ssh", [remote, command], { stdio: ["ignore", "pipe", "pipe"] });
		const chunks: Buffer[] = [];
		const errChunks: Buffer[] = [];
		const onAbort = () => child.kill();

		child.stdout.on("data", (data) => chunks.push(Buffer.from(data)));
		child.stderr.on("data", (data) => errChunks.push(Buffer.from(data)));
		child.on("error", reject);
		signal?.addEventListener("abort", onAbort, { once: true });
		child.on("close", (code) => {
			signal?.removeEventListener("abort", onAbort);
			if (signal?.aborted) reject(new Error("aborted"));
			else if (code !== 0) {
				const stderr = Buffer.concat(errChunks).toString().trim();
				const stdout = Buffer.concat(chunks).toString().trim();
				const detail = stderr || stdout || `command exited with status ${code}: ${command}`;
				reject(new Error(`SSH failed (${code}): ${detail}`));
			} else resolve(Buffer.concat(chunks));
		});
	});
}

function makePathMapper(remoteCwd: string, localCwd: string) {
	return (p: string) => {
		if (p === localCwd) return remoteCwd;
		if (p.startsWith(`${localCwd}/`)) return `${remoteCwd}${p.slice(localCwd.length)}`;
		return p;
	};
}

function createRemoteReadOps(remote: string, remoteCwd: string, localCwd: string): ReadOperations {
	const toRemote = makePathMapper(remoteCwd, localCwd);
	return {
		readFile: (p) => sshExec(remote, `cat -- ${shq(toRemote(p))}`),
		access: (p) => sshExec(remote, `test -r ${shq(toRemote(p))}`).then(() => {}),
		detectImageMimeType: async (p) => {
			try {
				const out = await sshExec(remote, `file --mime-type -b -- ${shq(toRemote(p))}`);
				const mime = out.toString().trim();
				return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime) ? mime : null;
			} catch {
				return null;
			}
		},
	};
}

function createRemoteWriteOps(remote: string, remoteCwd: string, localCwd: string): WriteOperations {
	const toRemote = makePathMapper(remoteCwd, localCwd);
	return {
		writeFile: async (p, content) => {
			const b64 = Buffer.from(content).toString("base64");
			await sshExec(remote, `base64 -d > ${shq(toRemote(p))} <<'PI_SSH_EOF'\n${b64}\nPI_SSH_EOF`);
		},
		mkdir: (dir) => sshExec(remote, `mkdir -p -- ${shq(toRemote(dir))}`).then(() => {}),
	};
}

function createRemoteEditOps(remote: string, remoteCwd: string, localCwd: string): EditOperations {
	const read = createRemoteReadOps(remote, remoteCwd, localCwd);
	const write = createRemoteWriteOps(remote, remoteCwd, localCwd);
	return { readFile: read.readFile, access: read.access, writeFile: write.writeFile };
}

function createRemoteBashOps(remote: string, remoteCwd: string, localCwd: string): BashOperations {
	const toRemote = makePathMapper(remoteCwd, localCwd);
	return {
		exec: (command, cwd, { onData, signal, timeout }) =>
			new Promise((resolve, reject) => {
				const remoteCommand = `cd -- ${shq(toRemote(cwd))} && ${command}`;
				const child = spawn("ssh", [remote, remoteCommand], { stdio: ["ignore", "pipe", "pipe"] });
				let timedOut = false;
				const timer = timeout ? setTimeout(() => { timedOut = true; child.kill(); }, timeout * 1000) : undefined;
				const onAbort = () => child.kill();

				child.stdout.on("data", onData);
				child.stderr.on("data", onData);
				child.on("error", (err) => { if (timer) clearTimeout(timer); reject(err); });
				signal?.addEventListener("abort", onAbort, { once: true });
				child.on("close", (code) => {
					if (timer) clearTimeout(timer);
					signal?.removeEventListener("abort", onAbort);
					if (signal?.aborted) reject(new Error("aborted"));
					else if (timedOut) reject(new Error(`timeout:${timeout}`));
					else resolve({ exitCode: code ?? 1 });
				});
			}),
	};
}

export default function (pi: ExtensionAPI) {
	const localCwd = process.cwd();
	let sshState: SshState = null;

	const localRead = createReadTool(localCwd);
	const localWrite = createWriteTool(localCwd);
	const localEdit = createEditTool(localCwd);
	const localBash = createBashTool(localCwd);

	function statusText() {
		return sshState ? `SSH: ${sshState.remote}:${sshState.remoteCwd}` : "SSH: off";
	}

	pi.registerCommand("ssh", {
		description: "Run pi tools on a remote host over SSH: /ssh user@host[:/path], /ssh off, /ssh status",
		handler: async (args, ctx) => {
			const arg = args.trim();
			if (!arg || arg === "status") {
				ctx.ui.notify(statusText(), "info");
				return;
			}
			if (["off", "disable", "local"].includes(arg.toLowerCase())) {
				sshState = null;
				ctx.ui.setStatus("ssh", "");
				ctx.ui.notify("SSH mode disabled; tools are local again", "info");
				return;
			}

			const target = parseTarget(arg);
			const remoteCwd = target.remoteCwd ?? (await sshExec(target.remote, "pwd")).toString().trim();
			// Validate that the directory exists and is accessible. Do not require it
			// to be writable: read-only repos/directories are still useful.
			await sshExec(target.remote, `cd -- ${shq(remoteCwd)} && pwd >/dev/null`);
			sshState = { remote: target.remote, remoteCwd };
			ctx.ui.setStatus("ssh", ctx.ui.theme.fg("accent", statusText()));
			ctx.ui.notify(`SSH mode enabled: ${target.remote}:${remoteCwd}`, "success");
		},
	});

	pi.registerTool({
		...localRead,
		async execute(id, params, signal, onUpdate) {
			const s = sshState;
			return s
				? createReadTool(localCwd, { operations: createRemoteReadOps(s.remote, s.remoteCwd, localCwd) }).execute(id, params, signal, onUpdate)
				: localRead.execute(id, params, signal, onUpdate);
		},
	});

	pi.registerTool({
		...localWrite,
		async execute(id, params, signal, onUpdate) {
			const s = sshState;
			return s
				? createWriteTool(localCwd, { operations: createRemoteWriteOps(s.remote, s.remoteCwd, localCwd) }).execute(id, params, signal, onUpdate)
				: localWrite.execute(id, params, signal, onUpdate);
		},
	});

	pi.registerTool({
		...localEdit,
		async execute(id, params, signal, onUpdate) {
			const s = sshState;
			return s
				? createEditTool(localCwd, { operations: createRemoteEditOps(s.remote, s.remoteCwd, localCwd) }).execute(id, params, signal, onUpdate)
				: localEdit.execute(id, params, signal, onUpdate);
		},
	});

	pi.registerTool({
		...localBash,
		async execute(id, params, signal, onUpdate) {
			const s = sshState;
			return s
				? createBashTool(localCwd, { operations: createRemoteBashOps(s.remote, s.remoteCwd, localCwd) }).execute(id, params, signal, onUpdate)
				: localBash.execute(id, params, signal, onUpdate);
		},
	});

	pi.on("user_bash", () => {
		const s = sshState;
		if (!s) return;
		return { operations: createRemoteBashOps(s.remote, s.remoteCwd, localCwd) };
	});

	pi.on("before_agent_start", (event) => {
		const s = sshState;
		if (!s) return;
		return {
			systemPrompt: event.systemPrompt.replace(
				`Current working directory: ${localCwd}`,
				`Current working directory: ${s.remoteCwd} (via SSH: ${s.remote})`,
			),
		};
	});
}
