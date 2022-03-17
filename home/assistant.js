import { logger } from 'logger';

const RUN_FILE = '/run/assistant.txt';

const PRIORITIES = ['CSEC', 'I.I.I.I', 'run4theh111z', 'The-Cave', 'w0r1d_d43m0n'];

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
	const console = logger(ns);
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
	// ns.print(agenda.map(l=>l.join(', ')).join('\n'));
	// return

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

	const priorities = PRIORITIES.filter(p=>visited.includes(p)).map(target => backtrack(target)).flat();
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

		const immediateTarget = available
			.find(list=>list[list.length-1] === currentServer);

		if (immediateTarget)
			return immediateTarget;

	    available.sort((a,b)=>b.length-a.length) // Prefer long paths to save typing
		  .sort((a,b)=>(b[0]===currentServer)-(a[0]===currentServer))
		  .sort(byPriority);              // Story servers come first
		return available[0];
	}

	let wentOffPath = false;
	let previousTarget;

	let cachedCurrent;
	let cachedTarget;
	let cachedHostname;
	let cachedMessage;
	const getMessage = (server) => {
		if (server != null) {
			const [current, target] = server;
			const hostname = visited.find(hostname => ns.getServer(hostname).isConnectedTo);
			// ns.print(cachedCurrent + ' ' + current);
			// ns.print(cachedTarget + ' ' + target);
			// ns.print(cachedHostname + ' ' + hostname);
			if (current === cachedCurrent && target === cachedTarget && hostname === cachedHostname) {
				return cachedMessage;
			}
			cachedCurrent = current;
			cachedTarget = target;
			cachedHostname = hostname;
			let step = 0;
			const steps = [
				`connect ${current}`,
				`connect ${target}`,
				`backdoor`];
			if (ns.getServer(target).isConnectedTo) {
				if (!wentOffPath) {
					steps[0] = '';
					if (previousTarget == null) {
						steps[1] = '';
					}
				}
				step = 2;
				wentOffPath = false;
				previousTarget = target;
			} else if (ns.getServer(current).isConnectedTo) {
				if (!wentOffPath) {
					steps[0] = '';
				}
				step = 1;
			} else {
				wentOffPath = true;
				step = 0;
			}
			const lead = i=>i===step?'> ':'  ';
			return cachedMessage = steps.map((l,i) =>lead(i)+l).join('\n');
		} else if (agenda.length === 0) {
			return cachedMessage = 'All servers backdoored';
		} else {
			return cachedMessage = 'No backdoor for current level and programs';
		}
	}

	while (agenda.length > 0) {
		try {
			removeCompleted();
			ns.clearLog();
			const server = getNextTarget();
			const message = getMessage(server);
			ns.print(message);
			await ns.write(RUN_FILE, message, 'w');
		} catch (error) {
			console.error(error);
		} finally {
			await ns.sleep(50);
		}
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