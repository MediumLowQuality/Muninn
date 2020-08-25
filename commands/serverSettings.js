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
	let serverUsers = server.members.map(member => {
		return {
			id: member.id,
			username: member.user.username.toLowerCase(),
			tag: member.user.tag.toLowerCase(),
			displayname:  member.displayName.toLowerCase()
		};
	});
	let others = args.filter(arg => !isMention(arg)).map(arg => {
		let larg = arg.toLowerCase();
		let user = server.members.has(arg)? server.members.get(arg) :
			serverUsers.find(obj => larg === obj.username || larg === obj.tag || larg === obj.displayname);
		if(user) {
			users.push(user.id);
			return 0;
		}
		let role = server.roles.has(arg)? server.roles.get(arg) :
			server.roles.find(role => role.name.toLowerCase() === larg);
		if(role) {
			roles.push(role.id);
			return 0;
		}
		let channel = server.channels.has(arg)? server.channels.get(arg) :
			server.channels.find(channel => channel.name.toLowerCase() === larg);
		if(channel) {
			channels.push(channel.id);
		}
		return arg;
	}).filter(arg => arg !== 0);
	return {users, roles, channels, others};
}
function isMemberInGroup(keys, member){
	let server = member.guild;
	let authorID = `u${member.id}`;
	let rolesID = member.roles.keyArray().map(id => `r${id}`);
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
const ADMIN = 'serverAdmin';
const MODERATORS = ['serverAdmin', 'moderator'];
const HAS_BOT_ACCESS = ['serverAdmin', 'moderator', 'botSupport'];
function isAllowedToSet(server, allowedGroup, member){
	return (process.isAdmin(member.id) || server.ownerID === member.id || isMemberInGroup(allowedGroup, member));
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
	'serverAdmin': {
		type: 'id',
		help: 'Has full access to server on the bot.',
		allowedToSet: (server, member) => isAllowedToSet(server, ADMIN, member),
		set: (settings, argsObject, initialValue) => {
			if(initialValue === undefined || !Array.isArray(initialValue)) initialValue = [];
			let {users, roles} = argsObject;
			users = users.filter(user => !initialValue.includes(user)).map(id => `u${id}`);
			roles = roles.filter(role => !initialValue.includes(role)).map(id => `r${id}`);
			settings.serverAdmin = initialValue.concat([...users, ...roles]);
		},
		rejectChange: '`serverAdmin` can only be set by bot administrator, the server owner, or current server admin. Settings not changed.'
	},
	'moderator': {
		type: 'id',
		help: 'Can set server settings and use moderation commands on the bot.',
		allowedToSet: (server, member) => isAllowedToSet(server, ADMIN, member),
		set: (settings, argsObject, initialValue) => {
			if(initialValue === undefined || !Array.isArray(initialValue)) initialValue = [];
			let {users, roles} = argsObject;
			users = users.filter(user => !initialValue.includes(user));
			roles = roles.filter(role => !initialValue.includes(role));
			settings.moderator = initialValue.concat([...users, ...roles]);
		},
		rejectChange: '`moderator` can only be set by bot administrator, the server owner, or current server admin. Settings not changed.'
	},
	'botSupport': {
		type: 'id',
		help: 'For users who run the bot but do not have moderation access.',
		allowedToSet: (server, member) => isAllowedToSet(server, MODERATORS, member),
		set: (settings, argsObject, initialValue) => {
			if(initialValue === undefined || !Array.isArray(initialValue)) initialValue = [];
			let {users, roles} = argsObject;
			users = users.filter(user => !initialValue.includes(user));
			roles = roles.filter(role => !initialValue.includes(role));
			settings.botSupport = initialValue.concat([...users, ...roles]);
		},
		rejectChange: '`botSupport` must be set by a user with `moderator` or higher access. Settings not changed.'
	},
	'defaultName': {
		type: 'string',
		help: 'The server\'s usual name. Used to reset the server name and generate server branded embeds. Recommended to set with server name in quotes.',
		allowedToSet: (server, member) => isAllowedToSet(server, HAS_BOT_ACCESS, member),
		set: (settings, argsObject) => {
			settings.defaultName = [argsObject.others[0]];
		},
		rejectChange: standardNoBotAccess
	},
	'defaultColor': {
		type: 'color',
		help: 'The server\'s color. Used to generate server branded embeds.',
		allowedToSet: (server, member) => isAllowedToSet(server, HAS_BOT_ACCESS, member),
		set: (settings, argsObject) => {
			settings.defaultColor = [argsObject.others[0]];
		},
		rejectChange: standardNoBotAccess
	}
};
const settingsNames = Object.keys(supportedSettings);
const flags = ['-help', '-list', '-init'];

function settingToString(server, setting, type){
	if(type === 'id') {
		let dataType = setting.charAt(0);
		setting = setting.substring(1);
		switch(dataType) {
			case 'u': return server.members.get(setting).displayName;
			case 'r': return server.roles.get(setting).name;
			case 'c': return server.channels.get(setting).name;
			default: return setting;
		}
	} else if(type === 'color') {
		return `#${setting} (https://www.wolframalpha.com/input/?i=%23${setting})`
	}
	return setting;
}

function writeSettings(server, logChannel){
	let settings = process.serverSettings.get(server.id);
	settings = Object.assign({}, settings);
	settings['_server'] = server.id;
	fs.promises.writeFile(`${__dirname}/settings/${server.id}.json`, JSON.stringify(settings, null, '\t'), 'utf8').then(() => logChannel.send('Settings saved.')).catch(() => logChannel.send('Settings failed to save.'));
}

module.exports = {
	name: 'munset',
	description: 'Set Muninn\'s server specific variables with this command. Use `munset -help` for more information.',
	allowedChannels: ['console'],
	allowedUsers: (args, msg, groups) => isAllowedToSet(msg.guild, HAS_BOT_ACCESS, msg.member),
	execute(msg, args){
		const origChannel = msg.channel;
		const server = origChannel.guild;
		if(!server.available) return;
		let hasSettings = process.serverSettings.has(server.id);
		let settings = hasSettings? process.serverSettings.get(server.id) : {};
		if(args.length === 0){
			let message = 'This command is used to set server specific variables for other commands. For syntax and flags, use `munset -help`. To view all settings and which settings you have set, use `munset -list`.'
			if(!hasSettings) message += '\r\nThis server has no settings yet. To initialize the admin and moderator to default values, use `munset -init`.';
			return;
		}
		if(args[0].toLowerCase() === '-help') {
			args.shift();
			if(args.length === 0){
				let message = 'Valid syntax for this command is `munset [flags] <setting> <user or role>`. For example,';
				message += `\r\nmunset serverAdmin ${msg.member}\r\n`
				message += 'This command supports several additional flags.\r\n`-init` will automatically make the server owner the serverAdmin and fill moderator with a role named moderator, if there is one. Other settings will not be given a default value.';
				origChannel.send(message);
				return;
			} else {
				let setting = args.shift().toLowerCase();
				setting = settingsNames.find(name => name.toLowerCase() === setting);
				if(setting !== undefined) {
					origChannel.send(`${backtickWrap(setting)}: ${supportedSettings[setting].help}`);
					return;
				}
			}
		}
		if(args[0].toLowerCase() === '-list') {
			args.shift();
			if(args.length === 0){
				let settingsList = settingsNames.map(setting => {
					let message = `${backtickWrap(setting)}: ${supportedSettings[setting].help}`;
					let type = supportedSettings[setting].type;
					if(setting in settings) message += ' Value: ' + settings[setting].map(setting => settingToString(server, setting, type)).join(', ');
					return message;
				});
				let message = settingsList.join('\r\n');
				origChannel.send(message);
				return;
			}
		}
		if(args[0].toLowerCase() === '-init') {
			if(settings === undefined) {
				settings = {};
				process.serverSettings.set(server.id, settings);
			}
			settings.serverAdmin = [`u${server.ownerID}`];
			let moderator = server.roles.find(role => role.name.toLowerCase() === 'moderator');
			if(moderator !== null) settings.moderator = [`r${moderator}`];
			writeSettings(server, origChannel);
			return;
		}
		if(settingsNames.map(name => name.toLowerCase()).includes(args[0].toLowerCase())){
			let setting = args.shift().toLowerCase();
			setting = settingsNames.find(name => name.toLowerCase() === setting);
			if(args.length === 0 && setting !== undefined) {
				let settingType = supportedSettings[setting].type;
				origChannel.send(`${backtickWrap(setting)}: ${settings[setting].map(setting => settingToString(server, setting, settingType)).join(', ')}`);
				return;
			}
			if(setting !== undefined){
				let settingDef = supportedSettings[setting];
				let member = msg.member;
				if(settingDef.allowedToSet(server, member)){
					settingDef.set(settings, parseArgs(server, args));
					let settingType = settingDef.type;
					origChannel.send(`New ${backtickWrap(setting)}: ${settings[setting].map(setting => settingToString(server, setting, settingType)).join(', ')}`);
					writeSettings(server, origChannel);
					return;
				} else {
					origChannel.send(settingDef.rejectChange);
					return;
				}
			}
		}
	},
	groups: {
		isMemberInGroup,
		isAllowedToSet,
		ADMIN,
		MODERATORS,
		HAS_BOT_ACCESS
	}
};