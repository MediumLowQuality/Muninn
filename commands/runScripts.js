const fs = require('fs');
const settings = require('./serverSettings');
const requires = Object.fromEntries(Object.keys(require('./scriptRequirements')).map(key => [key, require(require('./scriptRequirements')[key])]));;
const argDef = (level) => `msg,args${level >= 0 && level <= 3? ',settings': ''}${level === 0? ',requires': ''}`; //level 0 scripts can have access to other modules
let rawScriptsArray = require('./scripts');
const gitPull = require('./gitPull');
const access = settings.groups.accessDescriptors;

let scripts = {
	'new': {
		level: 0,
		exec(msg, args){
			const origChannel = msg.channel;
			if(args.length === 0) {
				origChannel.send('Name required for new function.');
				return;
			}
			let name = args.shift().toLowerCase();
			if(args.length === 0) {
				origChannel.send('Body required for new function.');
				return;
			}
			if(name in scripts) {
				origChannel.send(`${name} already has a script defined.`);
			}
			let level = isNaN(parseInt(args[0]))? 0 : parseInt(args.shift());
			if(args.length === 0) {
				origChannel.send('Body required for new function.');
				return;
			}
			let body = args.join(' ');
			scripts[name] = {level, exec: new Function(argDef(level), body)};
			origChannel.send(`${name} added.`);
			rawScriptsArray.push({name, level, body});
			fs.promises.writeFile('commands/scripts.json', JSON.stringify(rawScriptsArray, null, '\t'), 'utf8')
			.then(() => origChannel.send('Scripts updated.'))
			.catch((e) => origChannel.send('Error encountered. Update failed.')
				.then(() => process.log(e)));
		},
		help: 'Defines a new script for Muninn. Syntax is `$new <script name> [level] <script body>`.'
	},
	set: {
		level: 0,
		exec(msg, args) {
			const origChannel = msg.channel;
			if(args.length === 0){
				origChannel.send('You must specify script name to set. Scripts unchanged.');
				return;
			}
			let scriptName = args.shift().toLowerCase();
			if(scriptName in scripts) {
				if(args.length === 0){
					origChannel.send('You must specify property name to set. Properties unchanged.');
					return;
				}
				let key = args.shift().toLowerCase();
				if(args.length === 0){
					origChannel.send('You must specify a value. Properties unchanged.');
					return;
				}
				let specialScript = !rawScriptsArray.map(script => script.name).includes(scriptName);
				let value = args.join(' ');
				if(key === 'level'){
					value = parseInt(value);
					if(isNaN(value)) return origChannel.send('Level must be an int. Properties unchanged.');
					scripts[scriptName].level = value;
					if(specialScript) return origChannel.send('Level updated.');
				} else if (specialScript) {
					origChannel.send(`You cannot set the name or body of ${scriptName}. Scripts unchanged.`);
					return;
				}
				let script = rawScriptsArray.find(script => script.name === scriptName);
				if(key === 'name') delete scripts[scriptName];
				script[key] = value;
				scripts[script.name] = {level: script.level, exec: new Function(argDef(script.level), script.body)};
				fs.promises.writeFile('commands/scripts.json', JSON.stringify(rawScriptsArray, null, '\t'), 'utf8')
				.then(() => origChannel.send('Scripts updated.'))
				.catch((e) => origChannel.send('Error encountered. Update failed.')
					.then(() => process.log(e)));
			} else {
				origChannel.send(`${scriptName} is not the name of a script.`);
			}
		},
		help: 'Sets a script property, such as the name, security, function, or help string. Syntax is `$set <script name> <property> <value>`.'
	},
	list: {
		level: -1,
		exec(msg, args) {
			const origChannel = msg.channel;
			const server = msg.guild;
			let requestLevel = 0;
			if(args.length > 0 && parseInt(args[0]) !== undefined) {
				requestLevel = parseInt(args[0]);
				requestLevel = requestLevel < 0? 0: requestLevel;
				if(requestLevel > securityLevels.length) requestLevel = securityLevels.findIndex(func => func(msg.member));
			} else {
				requestLevel = securityLevels.findIndex(func => func(msg.member));
			}
			let scriptNames = Object.keys(scripts);
			let scriptsList = scriptNames
				.filter(name => (scripts[name].level === -1 || scripts[name].level >= requestLevel)
					&& (scripts[name].enabled === undefined || scripts[name].enabled(server)))
				.sort((a, b) => scripts[a].level - scripts[b].level)
				.map(scriptName => {
					let script = scripts[scriptName];
					let level = script.level;
					level = level < 0? securityLevels.length: level;
					level = level >= securityLevels.length? securityLevels.length: level;
					let message = '`$' + scriptName + '`' + `: Restricted to ${access[level]}.${script.help? ' '+script.help:''}`;
					return message;
				}).join('\r\n');
			let message = `The following scripts are available${requestLevel !== 0?' for ' + access[requestLevel].replace(' only', ''):''}:\r\n${scriptsList}`;
			origChannel.send(message);
		},
		help: 'Displays a list of all scripts Muninn has available.'
	},
	dump: {
		level: 0,
		enabled: () => true,
		exec(msg, args, settings, requires) {
			if(args.length === 0) {
				msg.channel.send('Dumping supports `facts`, `settings`, and `scripts`.');
				return;
			}
			const origChannel = msg.channel;
			const server = origChannel.guild;
			if(!server.available) return;
			const SevenZ = requires.SevenZ;
			const backslash = /\\/g;
			let dirs = {};
			dirs.commandDir = __dirname.replace(backslash, '/');
			dirs.bot = dirs.commandDir.substring(0, dirs.commandDir.lastIndexOf('/'));
			dirs.facts = dirs.commandDir + '/facts/*';
			dirs.settings = dirs.commandDir + '/settings/*';
			const standardOptions = {
				$bin: process.env.SEVENZ,
				workingDir: dirs.bot,
				recursive: true
			}
			let target = args[0];
			if(target === 'facts' || target == 'settings') {
				origChannel.send('Archiving (this may take a second)...');
				SevenZ.add(`${target}.7z`, dirs[target], standardOptions)
				.once('end', () => {
					origChannel.send(`This is the current set of ${target}.`,
						{files: [ `${dirs.bot}/${target}.7z` ]}
					).then(() => requires.fs.promises.unlink(`${dirs.bot}/${target}.7z`))
					.catch((e) => process.log(e));
				});
			} else if (target === 'scripts') {
				origChannel.send(`This is the current set of ${target}.`, 
					{files: [ `${dirs.commandDir}/scripts.json`]}
				).catch((e) => process.log(e));
			} else {
				origChannel.send('Dumping only supports `facts`, `settings`, and `scripts` at this time.');
			}
		},
		help: 'Dump is used to transfer files created and changed by Muninn that are not included in Muninn\'s Github repo.'
	},
	pull: {
		level: 0,
		exec(msg, args, settings, requires) {
			if(args.length === 0) {
				gitPull.clone().then(() => msg.channel.send('Repo clone completed.'));
			} else if (args[0] === 'repo') {
				gitPull.clone().then(() => msg.channel.send('Repo clone completed.'));
			}
		},
		help: 'Pull will clone data from the interwebs over this instance of Muninn.'
	}
};
rawScriptsArray.forEach(script => {
	let name = script.name.toLowerCase();
	let setting = script.setting;
	scripts[name] = {
		level: script.level !== undefined ? script.level: -1,
		exec: new Function(argDef(script.level), script.body)
	};
	if(script.help) scripts[name].help = script.help;
	if(script.setting) scripts[name].enabled = (server) => process.serverSettings.has(server) && process.serverSettings.get(server)[setting];
});
const securityLevels = [ // ascending security
	(member) => process.isAdmin(member.id), //bot admin only
	(member) => settings.groups.isAllowedToSet(member.guild, settings.groups.ADMIN, member), //server admin+ only only
	(member) => settings.groups.isAllowedToSet(member.guild, settings.groups.MODERATORS, member), //moderators+ only
	(member) => settings.groups.isAllowedToSet(member.guild, settings.groups.HAS_BOT_ACCESS, member) //all users with bot access
];
process.getSecurityLevel = (member) => securityLevels.findIndex(test => test(member));

module.exports = {
	name: 'munscript',
	description: 'Runs scripts that are not large enough to qualify as full commands.',
	alias(command, args, msg) {
		if(command.startsWith('$')){
			args.unshift(command.substring(1));
			command = 'munscript';
		}
		return [command, args, msg];
	},
	execute(msg, args) {
		const origChannel = msg.channel;
		const server = origChannel.guild;
		if(!server.available) return;
		if(args.filter(str => str.length > 0).length === 0) args = ['list'];
		let scriptName = args.shift().toLowerCase();
		if(scriptName in scripts) {
			let script = scripts[scriptName];
			let isAllowed = (script.level < 0 //script access never defined
				|| script.level >= securityLevels.length)? //script is even more accessible than I've bothered restricting
				true: securityLevels[script.level](msg.member);
			if(isAllowed){
				let serverSettings = process.serverSettings.has(server.id)? process.serverSettings.get(server.id) : {};
				scripts[scriptName].exec(msg, args, serverSettings, requires);
			} else {
				origChannel.send('You do not have access to that script.');
			}
		}
	}
};