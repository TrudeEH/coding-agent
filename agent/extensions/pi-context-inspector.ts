import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type SourceInfo = {
	path?: string;
	source?: string;
	scope?: string;
	origin?: string;
	baseDir?: string;
};

type SkillInfo = {
	name?: string;
	description?: string;
	path?: string;
	location?: string;
	sourceInfo?: SourceInfo;
};

type PromptOptions = {
	skills?: SkillInfo[];
	contextFiles?: Array<string | { path?: string; file?: string; content?: string }>;
	promptGuidelines?: string[];
	appendSystemPrompt?: string | string[];
	[key: string]: unknown;
};

let lastPromptOptions: PromptOptions | null = null;

function linesForList(title: string, rows: string[]): string[] {
	const divider = "─".repeat(Math.max(12, title.length + 8));
	return [title, divider, ...(rows.length ? rows : ["  none"]), ""];
}

function formatReport(pi: ExtensionAPI): string {
	const activeNames = new Set(pi.getActiveTools());
	const activeTools = pi.getAllTools()
		.filter((tool) => activeNames.has(tool.name))
		.sort((a, b) => a.name.localeCompare(b.name));
	const skills = (lastPromptOptions?.skills ?? []).slice().sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

	const out: string[] = [];
	out.push("/pi — LLM-visible tools", "");

	out.push(...linesForList(
		`Tool calls (${activeTools.length})`,
		activeTools.map((tool) => `  ${tool.name}`),
	));

	out.push(...linesForList(
		`Skills injected into the prompt (${skills.length})`,
		skills.map((skill) => `  ${skill.name ?? "(unnamed)"}`),
	));

	return out.join("\n");
}

export default function (pi: ExtensionAPI) {
	pi.on("before_agent_start", (event) => {
		lastPromptOptions = (event.systemPromptOptions ?? null) as PromptOptions | null;
	});

	pi.registerCommand("pi", {
		description: "List tools currently loaded into the LLM context.",
		handler: async (_args, ctx) => {
			await ctx.ui.editor("/pi — LLM-visible tools", formatReport(pi));
		},
	});
}
