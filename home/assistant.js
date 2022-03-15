const RUN_FILE = '/run/assistant.txt';

const PRIORITIES = ['CSEC', 'I.I.I.I', 'run4theh111z', 'The-Cave'];

/** @param {NS} ns **/
const usage = (ns) => {
	const script = ns.getScriptName();
	return `Usage:\n` +
		`  ./${script}\n` +
		`  ./${script} service\n` +
		`  ./${script} help\n`;
}

/** @param {NS} ns **/
const runDaemon = async (ns) => {
	const visited = ["home"];
	const agenda = [];
	for (let i = 0; i < visited.length; i++) {
		let entrypoint = visited[i];
		ns.scan(entrypoint).forEach(target => {
			if (!visited.includes(target)) {
				visited.push(target);
				agenda.push([entrypoint, target])
			}
		});
	}

	// Get shortest array of manual server hops to end target
	const backtrack = (end) => {
		const server = ns.getServer(end);
		if (server.purchasedByPlayer || server.backdoorInstalled)
			return [end];
		const [entrypoint] = agenda.find(([, target]) => target === end);
		const path = backtrack(entrypoint);
		path.push(end);
		return path;
	}

	const priorities = PRIORITIES.map(target => backtrack(target)).flat();
	const byPriority = (a,b)=>priorities.includes(b[b.length-1])-priorities.includes(a[a.length-1]);

	const removeCompleted = () => {
		for (let i = 0; i < agenda.length; i++) {
			const [, target] = agenda[i];
			const server = ns.getServer(target);
			if (server.purchasedByPlayer || server.backdoorInstalled) {
				agenda.splice(i, 1);
				i--;
			}
		}
	};

	const getNextTarget = () => {
		const currentServer = visited.find(hostname => ns.getServer(hostname).isConnectedTo);
		const skill = ns.getHackingLevel();
		const available = agenda.filter(([entry, target]) => {
			const { hasAdminRights, requiredHackingSkill } = ns.getServer(target);
			const canApproach = ns.getServer(entry).hasAdminRights;
			const canBackdoor = hasAdminRights && requiredHackingSkill <= skill;
			return canApproach && canBackdoor;
		}).map(([,t])=>backtrack(t))      // Convert each edge to a path
		  .sort((a,b)=>b.length-a.length) // Prefer long paths to save typing
		  .sort((a,b)=>(b[0]===currentServer)-(a[0]===currentServer))
		  .sort((a,b)=>(b[b.length-1]===currentServer)-(a[a.length-1]===currentServer))
		  .sort(byPriority);              // Story servers come first
		return available[0];
	}

	let previousEntrypoint;
	const getMessage = (server) => {
		if (server != null) {
			const [current, target] = server;
			let step = 0;
			const steps = [
				`connect ${current}`,
				`connect ${target}`,
				`backdoor`];
			if (ns.getServer(target).isConnectedTo) {
				previousEntrypoint = current;
				step = 2;
			} else if (ns.getServer(current).isConnectedTo) {
				step = 1;
			} else if (ns.getServer(previousEntrypoint).isConnectedTo) {
				steps.shift();
				step = 0;
			} else {
				step = 0;
			}
			const lead = i=>i===step?'> ':'  ';
			return steps.map((l,i) =>lead(i)+l).join('\n');
		} else if (agenda.length === 0) {
			return 'All servers backdoored';
		} else {
			return 'No backdoor for current level and programs';
		}
	}

	while (agenda.length > 0) {
		removeCompleted();
		const server = getNextTarget();
		const message = getMessage(server);
		ns.clearLog();
		ns.print(message);
		await ns.write(RUN_FILE, message, 'w');
		await ns.sleep(50);
	}
}

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog('ALL');
	const [param] = ns.args;
	if (param == null) {
		const currentTarget = await ns.read(RUN_FILE);
		ns.tprint(currentTarget);
		return;
	} else if (param === 'service') {
		await runDaemon(ns);
		return;
	} else if (param === 'help') {
		ns.tprint(usage(ns));
		return;
	} else {
		throw new Error(`Unrecognized parameter ${param}.\n${usage(ns)}`);
	}
}