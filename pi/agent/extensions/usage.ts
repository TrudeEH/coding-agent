import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type CodexAuth = {
	type?: string;
	access?: string;
	accountId?: string;
};

type AuthFile = {
	"openai-codex"?: CodexAuth;
};

type CodexUsage = {
	email?: string;
	plan_type?: string;
	rate_limit?: {
		allowed?: boolean;
		limit_reached?: boolean;
		primary_window?: UsageWindow;
		secondary_window?: UsageWindow;
	};
	code_review_rate_limit?: unknown;
	credits?: {
		has_credits?: boolean;
		unlimited?: boolean;
		overage_limit_reached?: boolean;
		balance?: string;
		approx_local_messages?: [number, number];
		approx_cloud_messages?: [number, number];
	};
	spend_control?: {
		reached?: boolean;
		individual_limit?: unknown;
	};
	rate_limit_reached_type?: string | null;
};

type UsageWindow = {
	used_percent?: number;
	limit_window_seconds?: number;
	reset_after_seconds?: number;
	reset_at?: number;
};

function formatTokens(n: number | null | undefined): string {
	if (n == null) return "?";
	if (n < 1000) return `${n}`;
	if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
	return `${(n / 1_000_000).toFixed(2)}M`;
}

function formatMoney(n: number | null | undefined): string {
	if (n == null || !Number.isFinite(n)) return "$0.0000";
	return `$${n.toFixed(4)}`;
}

function formatDuration(seconds: number | null | undefined): string {
	if (seconds == null || !Number.isFinite(seconds)) return "?";
	const s = Math.max(0, Math.round(seconds));
	const days = Math.floor(s / 86400);
	const hours = Math.floor((s % 86400) / 3600);
	const minutes = Math.floor((s % 3600) / 60);
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
}

function formatWindow(label: string, window: UsageWindow | undefined): string | null {
	if (!window) return null;
	const used = window.used_percent == null ? "?" : `${window.used_percent}%`;
	const windowLength = formatDuration(window.limit_window_seconds);
	const reset = formatDuration(window.reset_after_seconds);
	return `${label}: ${used} used in ${windowLength} window, resets in ${reset}`;
}

async function readCodexAuth(): Promise<CodexAuth | null> {
	const path = join(homedir(), ".pi", "agent", "auth.json");
	const raw = await readFile(path, "utf8");
	const auth = JSON.parse(raw) as AuthFile;
	return auth["openai-codex"] ?? null;
}

async function fetchCodexUsage(signal?: AbortSignal): Promise<CodexUsage> {
	const auth = await readCodexAuth();
	if (!auth?.access) throw new Error("No openai-codex OAuth token found. Run /login openai-codex first.");

	const response = await fetch("https://chatgpt.com/backend-api/codex/usage", {
		signal,
		headers: {
			Authorization: `Bearer ${auth.access}`,
			"OpenAI-Account": auth.accountId ?? "",
			"User-Agent": "pi-usage-extension",
		},
	});

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(`Codex usage request failed: HTTP ${response.status}${body ? ` ${body.slice(0, 160)}` : ""}`);
	}

	return (await response.json()) as CodexUsage;
}

function formatCodexUsage(usage: CodexUsage): string[] {
	const lines = [
		`Codex subscription: ${usage.plan_type ?? "unknown plan"}${usage.email ? ` (${usage.email})` : ""}`,
		`Allowed now: ${usage.rate_limit?.allowed === false ? "no" : "yes"}${usage.rate_limit?.limit_reached ? " (limit reached)" : ""}`,
	];

	const primary = formatWindow("Primary limit", usage.rate_limit?.primary_window);
	const secondary = formatWindow("Secondary limit", usage.rate_limit?.secondary_window);
	if (primary) lines.push(primary);
	if (secondary) lines.push(secondary);

	if (usage.credits) {
		const creditState = usage.credits.unlimited
			? "unlimited"
			: usage.credits.has_credits
				? `balance ${usage.credits.balance ?? "?"}`
				: "none";
		lines.push(`Credits: ${creditState}${usage.credits.overage_limit_reached ? " (overage limit reached)" : ""}`);
	}

	if (usage.spend_control?.reached) lines.push("Spend control: reached");
	if (usage.rate_limit_reached_type) lines.push(`Limit type: ${usage.rate_limit_reached_type}`);
	return lines;
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("usage", {
		description: "Show Codex subscription quota plus current Pi session token/cost usage",
		handler: async (_args, ctx) => {
			let turns = 0;
			let input = 0;
			let output = 0;
			let cacheRead = 0;
			let cacheWrite = 0;
			let totalTokens = 0;
			let cost = 0;

			for (const entry of ctx.sessionManager.getBranch()) {
				if (entry.type !== "message" || entry.message.role !== "assistant") continue;
				const message = entry.message as AssistantMessage;
				if (!message.usage) continue;

				turns++;
				input += message.usage.input ?? 0;
				output += message.usage.output ?? 0;
				cacheRead += message.usage.cacheRead ?? 0;
				cacheWrite += message.usage.cacheWrite ?? 0;
				totalTokens += message.usage.totalTokens ?? 0;
				cost += message.usage.cost?.total ?? 0;
			}

			const context = ctx.getContextUsage();
			const contextLine = context
				? `Context: ${formatTokens(context.tokens)} / ${formatTokens(context.contextWindow)}${
						context.percent == null ? "" : ` (${context.percent.toFixed(1)}%)`
					}`
				: "Context: unavailable until a model response is recorded";

			const lines: string[] = [];
			try {
				lines.push(...formatCodexUsage(await fetchCodexUsage(ctx.signal)));
			} catch (error) {
				lines.push(`Codex subscription: unavailable (${error instanceof Error ? error.message : String(error)})`);
			}

			lines.push(
				"",
				`Pi session: ${ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "no model"}`,
				`Assistant turns: ${turns}`,
				`Tokens: ${formatTokens(totalTokens)} total (in ${formatTokens(input)}, out ${formatTokens(output)}, cache read ${formatTokens(cacheRead)}, cache write ${formatTokens(cacheWrite)})`,
				`Estimated API-style cost: ${formatMoney(cost)}`,
				contextLine,
			);

			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}
