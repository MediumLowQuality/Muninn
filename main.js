require('dotenv').config();
const Discord = require('discord.js');
const init = require('./init');
const botCommands = require('./commands');
const {commandAllowedInChannel, commandAllowedByUser} = require('./commands/commandPermissions');
const util = require('util');
const ADMIN = process.env.ADMIN;
const AUXADMIN = process.env.AUXADMIN;
const BOT = process.env.BOT;
const baseServer = process.env.BASESERVER;
const munLog = process.env.LOGCHANNEL;
let bot = undefined;
process.isAdmin = (id) => (id === process.env.ADMIN || id === process.env.AUXADMIN);

function initializeBot(){
	if(bot !== undefined) return bot;
	
	bot = new Discord.Client({intents: init.intents});
	bot.commands = new Discord.Collection();
	bot.commandAliases = [];
	bot.console = new Discord.Collection();
	Object.keys(botCommands).map(key => {
		bot.commands.set(botCommands[key].name, botCommands[key]);
		if(botCommands[key].alias !== undefined) bot.commandAliases.push(botCommands[key].alias);
	});
	return bot;
}

function loggedIn(){
	console.info(`Logged in as ${bot.user.tag}!`);
	bot.guilds.fetch(baseServer).then(server => {
		const logChannel = server.channels.resolve(munLog);
		process.log = (str) => logChannel.send(typeof str === 'string'? str: util.format(str))
		.catch(error => console.log(`${str} failed to send.\r\n${error}`));
	});
	let settings = process.serverSettings.settings,
	ids = Object.keys(settings).filter(setting => settings[setting] === 'id');
	process.serverSettings.map((settingsObj, key) => {
		let idsToCache = ids.filter(id => id in settingsObj)
			.map(id => settingsObj[id]).flat(),
			users = idsToCache.filter(id => id.startsWith('u'))
				.map(id => id.substring(1)),
			roles = idsToCache.filter(id => id.startsWith('r'))
				.map(id => id.substring(1)),
			channels = idsToCache.filter(id => id.startsWith('c'))
				.map(id => id.substring(1));
		process.bot.guilds.fetch(key).then((server) => {
			console.log(`${server.name} cached.`);
			if(users.length > 0){
				users.map(userId => {
					server.members.fetch(userId)
					.then((member) => console.log(`Cached ${member.displayName} from ${server.name}.`))
					.catch(error => {
						process.log(`Settings error: user ${id} not found in ${server.name}. Removing from settings.`);
						ids.filter(id => id in settingsObj).forEach(setting => {
							settingsObj[setting] = settingsObj[setting].filter(id => !id.endsWith(userId));
						});
					});
				});
			}
			if(roles.length > 0){
				server.roles.fetch().then(() => {
					console.log(`Roles from ${server.name} cached.`);
					let unfoundRoles = roles.filter(role => !server.roles.cache.has(role));
					if(unfoundRoles.length > 0){
						process.log(`Settings error: role${(unfoundRoles.length > 1?'s ':' ') + unfoundRoles.join(', ')} not found. Removing from settings.`);
						unfoundRoles.forEach(roleId => {
							ids.filter(id => id in settingsObj).forEach(setting => {
								settingsObj[setting] = settingsObj[setting].filter(id => !id.endsWith(roleId));
							});
						});
					}
				});
			}
		});
	});
	[...bot.guilds.cache.keys()].forEach(id => {
		let consoleChannels = [];
		if(process.serverSettings.has(id) && process.serverSettings.get(id).console) {
			let server = bot.guilds.fetch(id);
			consoleChannels = process.serverSettings.get(id).console;
		} else {
			consoleChannels = ['console'];
		}
		bot.console.set(id, consoleChannels);
	});
}

function handleMessage(msg){
	const chan = msg.channel.name.toLowerCase();
	const server = msg.guild.id;
	const author = msg.author.id;
	if(author === BOT) return;
	if(!msg.content || msg.content === "") return;
	let args = msg.content.trim()//message body, removing extra spaces and such
		.split(/(?<!\\)"/).map(s => s.trim())//split around quotes, such that phrases in quotes are in odd indices, but don't match escaped quotes
		.map((chunk, index) => index % 2 === 0? chunk.split(/ +/): chunk)//return quoted phrases as is, split others around spaces
		.flat().filter(s => s !== "")//condense nested arrays to one array and remove empty strings
		.map(arg => arg.replace(/\\"/, '"'));//replace \" with "
	if(args[0].startsWith('?')) {
		if(!args[0].toLowerCase().endsWith(process.env.WHO.toLowerCase())){
			return; //filter out commands by bot name
		} else args.shift();
	}
	let command = args.shift().toLowerCase();
	
	
	//some messages can trigger the bot to run a command in non-standard ways
	[command, args] = bot.commandAliases.reduce((commandArgs, alias) => alias(...commandArgs), [command, args, msg]);
	
	if (!bot.commands.has(command)) return;
	let botCommand = bot.commands.get(command);
	// for commands that need access to other commands
	if (botCommand.metacommand) args.unshift(bot.commands);
	//whitelists
	if(!commandAllowedInChannel(botCommand, server, chan) 
		|| !commandAllowedByUser(botCommand, author, args, msg)) return;
	process.log(`(${process.env.WHO}) ${msg.author.tag} called command in ${msg.guild.name.replace(/\s/g, '-')}/${msg.channel.name}:\r\n ${command}${args.length > 0? ' with args "' + args.join(' ') + '"' :''}`);
	//cooldown handling - NEEDS TO BE SERVER SPECIFIC
	if(botCommand.cooldown !== undefined) {
		let now = Date.now();
		if(botCommand.lastCall !== undefined && !process.isAdmin(author)){
			let timeSinceLastCall = now - botCommand.lastCall;
			if(timeSinceLastCall < botCommand.cooldown){
				let timeLeft = (botCommand.cooldown - timeSinceLastCall)/1000.0;
				if(timeLeft > 1.0) msg.channel.send(`That command is on cooldown for ${timeLeft.toFixed(1)} seconds.`);
				return;
			}
		} else {
			botCommand.lastCall = now;
		}
	}

	try {
		botCommand.execute(msg, args);
	} catch (error) {
		console.error(error);
		msg.reply(`Error: ${error}`);
	}
}

module.exports = {
	initializeBot,
	loggedIn,
	handleMessage
};
/*
  'raffle' command needs to be reworked to not specifically target the 'premium-raffle' channel.
]*/