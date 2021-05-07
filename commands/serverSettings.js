const fs = require('fs');
const Discord = require('discord.js');
function isMention(str){
	if(str.startsWith('<@!') && str.endsWith('>')) return 'user';
	if(str.startsWith('<@&') && str.endsWith('>')) return 'role';
	if(str.startsWith('<@') && str.endsWith('>')) return 'user';
	if(str.startsWith('<#') && str.endsWith('>')) return 'channel';
	return false;
}
function extractSnowflake(str){
	if(str.startsWith('<@!')) return str.substring(3, str.length - 1);
	if(str.startsWith('<@&')) return str.substring(3, str.length - 1);
	if(str.startsWith('<@')) return str.substring(2, str.length - 1);
	if(str.startsWith('<#')) return str.substring(2, str.length - 1);
	return str;
}
function parseArgs(server, args){
	let users = args.filter(arg => isMention(arg) === 'user').map(arg => extractSnowflake(arg));
	let roles = args.filter(arg => isMention(arg) === 'role').map(arg => extractSnowflake(arg));
	let channels = args.filter(arg => isMention(arg) === 'channel').map(arg => extractSnowflake(arg));
	let serverUsers = server.members.cache.map(member => {
		return {
			id: member.id,
			username: member.user.username.toLowerCase(),
			tag: member.user.tag.toLowerCase(),
			displayname:  member.displayName.toLowerCase()
		};
	});
	let others = args.filter(arg => !isMention(arg)).map(arg => {
		let larg = arg.toLowerCase();
		let user = server.members.cache.has(arg)? server.members.cache.get(arg) :
			serverUsers.find(obj => larg === obj.username || larg === obj.tag || larg === obj.displayname);
		if(user) {
			users.push(user.id);
			return 0;
		}
		let role = server.roles.cache.has(arg)? server.roles.cache.get(arg) :
			server.roles.cache.find(role => role.name.toLowerCase() === larg);
		if(role) {
			roles.push(role.id);
			return 0;
		}
		let channel = server.channels.cache.has(arg)? server.channels.cache.get(arg) :
			server.channels.cache.find(channel => channel.name.toLowerCase() === larg);
		if(channel) {
			channels.push(channel.id);
		}
		return arg;
	}).filter(arg => arg !== 0);
	return {server, users, roles, channels, others};
}
function isMemberInGroup(keys, member){
	let server = member.guild;
	let authorID = `u${member.id}`;
	let rolesID = member.roles.cache.keyArray().map(id => `r${id}`);
	let settings = process.serverSettings.has(server.id)? process.serverSettings.get(server.id) : undefined;
	if(settings === undefined) return false;
	let checkKey = (key) => {
		let setting = key in settings? settings[key] : undefined;
		if(setting === undefined) return false;
		return setting.includes(authorID) || rolesID.some(role => setting.includes(role));
	};
	if(Array.isArray(keys)) return keys.some(checkKey);
	return checkKey(keys);
}
const backtickWrap = (str) => '`'+str+'`';
//commonly used groups in allowedToSet
const ADMIN = 'Server Admin';
const MODERATORS = ['Server Admin', 'Moderator'];
const HAS_BOT_ACCESS = ['Server Admin', 'Moderator', 'Bot Support'];
const accessDescriptors = ['VictorF only', 'server admin only', 'moderators only', 'users with bot access'];
accessDescriptors.push('any user');
function isAllowedToSet(server, allowedGroup, member){
	return (process.isAdmin(member.id) || server.ownerID === member.id || isMemberInGroup(allowedGroup, member));
}
function standardAccessIsAllowedToSet(server, member, initialValue){ //anyone with access can set this value, unless the access has been set higher than theirs.
	return isAllowedToSet(server, ADMIN, member)
		|| (isAllowedToSet(server, MODERATORS, member) && initialValue === 2)
		|| (isAllowedToSet(server, HAS_BOT_ACCESS, member) && (initialValue === -1 || initialValue === undefined || initialValue <= 3));
}

const standardNoBotAccess = 'You do not have access to editing server settings.'

process.serverSettings = new Discord.Collection();
let settingsFiles = fs.promises.readdir('./commands/settings', {encoding: 'utf8', withFileTypes: true})
	.then(dir => dir.filter(dirent => dirent.isFile())
		.map(dirent => dirent.name)
		.map(filename => fs.promises.readFile(`./commands/settings/${filename}`, 'utf8')
			.then(file => {
				try{
					let settings = JSON.parse(file);
					let server = settings['_server'];
					delete settings['_server'];
					process.serverSettings.set(server, settings);
					return server;
				} catch(e) {
					console.log(e);
					return "";
				}
			}))
	).then(files => Promise.all(files))
	.then(settings => console.log(`Server settings loaded.`))
	.catch(e => console.log(e));

const supportedSettings = {
	'Server Admin': {
		type: 'id',
		help: 'Has full access to server on the bot.',
		allowedToSet: (server, member, initialValue) => isAllowedToSet(server, ADMIN, member),
		set: (settings, argsObject, initialValue) => {
			if(initialValue === undefined || !Array.isArray(initialValue)) initialValue = [];
			let {users, roles} = argsObject;
			users = users.filter(user => !initialValue.includes(user)).map(id => `u${id}`);
			roles = roles.filter(role => !initialValue.includes(role)).map(id => `r${id}`);
			settings['Server Admin'] = initialValue.concat([...users, ...roles]);
		},
		rejectChange: '`Server Admin` can only be set by bot administrator, the server owner, or current server admin. Settings not changed.'
	},
	'Moderator': {
		type: 'id',
		help: 'Can set server settings and use moderation commands on the bot.',
		allowedToSet: (server, member, initialValue) => isAllowedToSet(server, ADMIN, member),
		set: (settings, argsObject, initialValue) => {
			if(initialValue === undefined || !Array.isArray(initialValue)) initialValue = [];
			let {users, roles} = argsObject;
			users = users.filter(user => !initialValue.includes(user)).map(id => `u${id}`);;
			roles = roles.filter(role => !initialValue.includes(role)).map(id => `r${id}`);;
			settings.Moderator = initialValue.concat([...users, ...roles]);
		},
		rejectChange: '`moderator` can only be set by bot administrator, the server owner, or current server admin. Settings not changed.'
	},
	'Bot Support': {
		type: 'id',
		help: 'For users who run the bot but do not have moderation access.',
		allowedToSet: (server, member, initialValue) => isAllowedToSet(server, MODERATORS, member),
		set: (settings, argsObject, initialValue) => {
			if(initialValue === undefined || !Array.isArray(initialValue)) initialValue = [];
			let {users, roles} = argsObject;
			users = users.filter(user => !initialValue.includes(user)).map(id => `u${id}`);
			roles = roles.filter(role => !initialValue.includes(role)).map(id => `r${id}`);
			settings['Bot Support'] = initialValue.concat([...users, ...roles]);
		},
		rejectChange: '`Bot Support` must be set by a user with `moderator` or higher access. Settings not changed.'
	},
	'console': {
		type: 'string',
		help: 'The server\'s console channel for bots. If a value is set for this channel, commands that only work in channels named console will work in this channel instead.',
		allowedToSet: (server, member, initialValue) => isAllowedToSet(server, ADMIN, member),
		set: (settings, argsObject, initialValue) => {
			if(initialValue === undefined || !Array.isArray(initialValue)) initialValue = [];
			let {server, channels, others} = argsObject;
			channels = channels.map(channel => server.channels.cache.get(channel).name.toLowerCase()).filter(name => !initialValue.includes(name));
			others = others.map(channel => channel.toLowerCase()).filter(name => !initialValue.includes(name));
			settings.console = initialValue.concat([...channels, ...others]);
		},
		rejectChange: '`console` can only be set by `Server Admin` or server owner.'
	},
	'default name': {
		type: 'string',
		help: 'The server\'s usual name. Used to reset the server name and generate server branded embeds. Recommended to set with server name in double quotes.',
		allowedToSet: (server, member, initialValue) => isAllowedToSet(server, HAS_BOT_ACCESS, member),
		set: (settings, argsObject) => {
			settings['default name'] = [argsObject.others[0]];
		}
	},
	'default color': {
		type: 'color',
		help: 'The server\'s color. Used to generate server branded embeds.',
		allowedToSet: (server, member, initialValue) => isAllowedToSet(server, HAS_BOT_ACCESS, member),
		set: (settings, argsObject) => {
			settings['default color'] = argsObject.others[0];
		}
	},
	'facts enabled': {
		type: 'bool',
		help: 'Whether or not Muninn will respond to fact commands on this server. All values that do not begin with the word false will be interpreted as true.',
		allowedToSet: (server, member, initialValue) => isAllowedToSet(server, HAS_BOT_ACCESS, member),
		set: (settings, argsObject) => {
			let enable = argsObject.others[0].toLowerCase().trim() !== 'false';
			settings['facts enabled'] = enable;
		}
	},
	'facts include global facts': {
		type: 'bool',
		help: 'Whether facts include all global facts, or only server-specific ones.',
		allowedToSet: (server, member, initialValue) => isAllowedToSet(server, HAS_BOT_ACCESS, member),
		set: (settings, argsObject) => {
			let include = argsObject.others[0].toLowerCase().trim() !== 'false';
			settings['facts include global facts'] = include;
		}
	},
	'facts set access': {
		type: 'access',
		help: 'What degree of bot access is required to set facts on Muninn.\r\n Set -1 for all users, 0 for server admin only, 1 for moderators, and 2 for any user given bot access.',
		allowedToSet: standardAccessIsAllowedToSet,
		set: (settings, argsObject, initialValue) => {
			let num = parseInt(argsObject.others[0]);
			if(num >= 0) num += 1;//0 is victor only
			if(num > 3) num = -1;
			settings['facts set access'] = num;
		}
	},
	'facts get access': {
		type: 'access',
		help: 'What degree of bot access is required to retrieve facts. Values are same as set.',
		allowedToSet: standardAccessIsAllowedToSet,
		set: (settings, argsObject, initialValue) => {
			let num = parseInt(argsObject.others[0]);
			if(num >= 0) num += 1;
			if(num > 3) num = -1;
			settings['facts get access'] = num;
		}
	}
};
const settingsNames = Object.keys(supportedSettings);
const flags = ['-help', '-list', '-init', '-replace', '-clear'];

function settingToString(server, setting, type){
	if(Array.isArray(setting)) return setting.map(setting => settingToString(server, setting, type)).join(', ');
	if(type === 'id') {
		let dataType = setting.charAt(0);
		setting = setting.substring(1);
		switch(dataType) {
			case 'u': return server.members.cache.get(setting).displayName;
			case 'r': return server.roles.cache.get(setting).name;
			case 'c': return server.channels.cache.get(setting).name;
			default: return setting;
		}
	} else if(type === 'color') {
		return `#${setting}`;
	} else if(type === 'access') {
		if(setting < 0) return accessDescriptors[accessDescriptors.length - 1];
		return accessDescriptors[setting];
	}
	return setting;
}

function writeSettings(server, logChannel){
	let settings = process.serverSettings.get(server.id);
	settings = Object.assign({}, settings);
	settings['_server'] = server.id;
	fs.promises.writeFile(`${__dirname}/settings/${server.id}.json`, JSON.stringify(settings, null, '\t'), 'utf8').then(() => logChannel.send('Settings saved.')).catch(() => logChannel.send('Settings failed to save.'));
}

process.serverSettings.settings = Object.fromEntries(
	Object.keys(supportedSettings).map(name => [name, supportedSettings[name].type])
);
module.exports = {
	name: 'munset',
	description: 'Set Muninn\'s server specific variables with this command. Use `munset -help` for more information.',
	allowedChannels: ['console'],
	allowedUsers: (args, msg, groups) => isAllowedToSet(msg.guild, HAS_BOT_ACCESS, msg.member),
	execute(msg, args){
		const origChannel = msg.channel;
		const server = origChannel.guild;
		if(!server.available) return;
		server.members.fetch();
		server.roles.fetch();
		let hasSettings = process.serverSettings.has(server.id);
		let settings = hasSettings? process.serverSettings.get(server.id) : {};
		if(args.length === 0){
			let message = 'This command is used to set server specific variables for other commands. For syntax and flags, use `munset -help`. To view all settings and which settings you have set, use `munset -list`.'
			if(!hasSettings) message += '\r\nThis server has no settings yet. To initialize the admin and moderator to default values, use `munset -init`.';
			return origChannel.send(message);
		}
		let commandFlags = [];
		while(args.length > 0 && flags.includes(args[0].toLowerCase())){
			commandFlags.push(args.shift().toLowerCase());
		}
		if(commandFlags.includes('-help')) {
			if(args.length === 0){
				let message = 'Valid syntax for this command is `munset [flags] <setting> [setting specific flags] <user or role>`. For example,';
				message += `\r\nmunset Server Admin ${msg.member}\r\n`
				message += 'This command supports several additional flags.\r\n`-init` will automatically make the server owner the Server Admin and fill moderator with a role named moderator, if there is one. Other settings will not be given a default value.';
				return origChannel.send(message);
			} else {
				let setting = args.shift().toLowerCase();
				setting = settingsNames.find(name => name.toLowerCase() === setting);
				if(setting !== undefined) {
					return origChannel.send(`${backtickWrap(setting)}: ${supportedSettings[setting].help}`);
				}
				return;
			}
		}
		if(commandFlags.includes('-list')) {
			if(args.length === 0){
				let settingsList = settingsNames.map(setting => {
					let message = `${backtickWrap(setting)}: ${supportedSettings[setting].help}`;
					let type = supportedSettings[setting].type;
					if(setting in settings) {
						message += ' Value ' + settingToString(server, settings[setting], type);
					}
					return message;
				});
				let message = settingsList.join('\r\n');
				origChannel.send(message);
				return;
			}
		}
		if(commandFlags.includes('-init') && args.length === 0) {
			if(settings === undefined) {
				settings = {};
				process.serverSettings.set(server.id, settings);
			}
			settings['Server Admin'] = [`u${server.ownerID}`];
			let moderator = server.roles.cache.findKey(role => role.name.toLowerCase() === 'moderator');
			if(moderator !== null) settings.Moderator = [`r${moderator}`];
			writeSettings(server, origChannel);
			return;
		}
		let setting = args.shift().toLowerCase();
		while(!settingsNames.find(name => name.toLowerCase() === setting) && args.length > 0){
			setting += ' ' + args.shift().toLowerCase();
		}
		setting = settingsNames.find(name => name.toLowerCase() === setting);
		if(!setting) return origChannel.send('No matching setting found.');
		if(setting !== undefined){
			let settingDef = supportedSettings[setting];
			let settingType = settingDef.type;
			if(args.length === 0 && !commandFlags.includes('-init') && !commandFlags.includes('-clear')) {
				return origChannel.send(`${backtickWrap(setting)}: ${settingToString(server, settings[setting], settingType)}`);
			}
			let member = msg.member;
			if(settingDef.allowedToSet(server, member, settings[setting])){
				if(commandFlags.includes('-clear')) {
					let initialValue = settings[setting];
					delete settings[setting];
					writeSettings(server, origChannel);
					return origChannel.send(`Setting ${backtickWrap(setting)} (${settingToString(server, settings[setting], settingType)}) cleared.`);
				}
				let initialValue = commandFlags.includes('-replace')? undefined: settings[setting];
				settingDef.set(settings, parseArgs(server, args), initialValue);
				origChannel.send(`New ${backtickWrap(setting)}: ${settingToString(server, settings[setting], settingType)}`);
				writeSettings(server, origChannel);
				if(setting === 'console') process.bot.console.set(server.id, settings.console);
				return;
			} else {
				let rejectChange = settingDef.rejectChange || standardNoBotAccess;
				origChannel.send(rejectChange);
				return;
			}
		}
	},
	groups: {
		isMemberInGroup,
		isAllowedToSet,
		parseArgs,
		ADMIN,
		MODERATORS,
		HAS_BOT_ACCESS,
		accessDescriptors
	}
};