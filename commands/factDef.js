const {readFile, writeFile, existsSync} = require('fs');
const flags = {
	'-override': 'override',
	'-delete': 'deleteFact',
	'-global': 'global',
	'-json': 'JSONparse'
};
module.exports = {
	name: 'factdef',
	description: 'Defines facts for factlookup command.',
	allowedChannels: (server, channel) => {
		if(process.serverSettings.has(server)) {
			let settings = process.serverSettings.get(server);
			if(settings['facts enabled'] === undefined) return true;
			return settings['facts enabled'];
		}
		return true;
	},
	allowedUsers: (args, msg, groups) => {
		let server = msg.guild.id;
		if(process.serverSettings.has(server)) {
			let settings = process.serverSettings.get(server);
			let level = settings['facts set access'];
			if(level === undefined || level === -1) return true;
			let userLevel = process.getSecurityLevel(msg.member);
			return userLevel >= 0 && userLevel < level;
		}
		return true;
	},
	alias(command, args, msg) {
		if(command.startsWith('!')){
			if(args.map(arg => arg.toLowerCase()).includes('is')) {
				let override = false;
				args.unshift(command.substring(1));
				if(args[0].toLowerCase() === 'no') {//overriding
					override = true;
					args.shift();
				}
				let isIndex = args.findIndex(arg => arg.toLowerCase() === 'is');
				let key = args.slice(0, isIndex).join(' ');
				args = args.slice(isIndex + 1);
				args.unshift(key);
				if(override) args.unshift('-override');
				command = 'factdef';
			} else if(command === '!delete'){
				command = 'factdef';
				args.unshift('-delete');
			} else {
				args.unshift(command.substring(1));
				command = 'factlookup';
			}
		}
		return [command, args, msg];
	},
	execute(msg, args) {
		const origChannel = msg.channel;
		const server = origChannel.guild;
		if(!server.available) return;
		const options = Object.fromEntries(Object.keys(flags).map(key => [key, false]));
		if(args.length === 0) return;
		let firstArg = args[0].toLowerCase();
		while (firstArg in flags) {
			if (firstArg === '-global') {
				if(process.isAdmin(msg.author.id)){
					options.global = true;
				} else {
					origChannel.send('You do not have permission to change a global fact.');
				}
			} else {
				let key = flags[firstArg];
				options[key] = true;
			}
			args.shift();
			if(args.length === 0) return;
			firstArg = args[0].toLowerCase();
		}
		if(args.length === 0) return;
		let factsFile = options.global? 'global':server.id;
		let factsPath = `${__dirname}/facts/${factsFile}.json`;
		function handleFact(factsObj){
			let key = args.shift().toLowerCase();
			if(key === '') return;
			let fact = args.join(' ');
			if(options.JSONparse) {
				try{
					fact = JSON.parse(fact);
				} catch (e) {
					origChannel.send('Invalid format.');
				}
			}
			if (options.deleteFact) {
				fact = factsObj[key];
				let backupKey = `${key} ${args.join(' ')}`
				if(factsObj[backupKey] !== undefined){
					key = backupKey;
					fact = factsObj[backupKey];
				}
				delete factsObj[key];
				origChannel.send(`${key}: ${fact} removed.`);
				writeFile(factsPath, JSON.stringify(factsObj, null, '\t'), 'utf8', (err) => {if(err) throw err;});
			} else if(factsObj[key] === undefined || options.override === true) {
				factsObj[key] = fact;
				origChannel.send(`${key}: ${fact} ${options.override?'changed.':'added.'}`);
				writeFile(factsPath, JSON.stringify(factsObj, null, '\t'), 'utf8', (err) => {if(err) throw err;});
			} else {
				origChannel.send(`${key} already has a fact defined.`);
			}
		}
		if(existsSync(factsPath)){
			readFile(factsPath, (err, facts) => {
				if (err) throw err;
				facts = JSON.parse(facts);
				handleFact(facts);
			});
		} else {
			let facts = {};
			handleFact(facts);
		}
	},
};
